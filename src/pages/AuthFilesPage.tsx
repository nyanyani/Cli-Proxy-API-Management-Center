import {
  useCallback,
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { animate } from 'motion/mini';
import type { AnimationPlaybackControlsWithThen } from 'motion-dom';
import { useInterval } from '@/hooks/useInterval';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import {
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  GEMINI_CLI_CONFIG,
  KIMI_CONFIG,
  type QuotaConfig,
} from '@/components/quota';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { IconFilterAll } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { copyToClipboard } from '@/utils/clipboard';
import {
  DEFAULT_CARD_PAGE_SIZE,
  MIN_CARD_PAGE_SIZE,
  QUOTA_PROVIDER_TYPES,
  clampCardPageSize,
  getAuthFileIcon,
  getTypeColor,
  getTypeLabel,
  hasAuthFileStatusMessage,
  isRuntimeOnlyAuthFile,
  normalizeProviderKey,
  parsePriorityValue,
  type QuotaProviderType,
  type ResolvedTheme,
} from '@/features/authFiles/constants';
import { AuthFileCard } from '@/features/authFiles/components/AuthFileCard';
import { AuthFileModelsModal } from '@/features/authFiles/components/AuthFileModelsModal';
import { AuthFilesPrefixProxyEditorModal } from '@/features/authFiles/components/AuthFilesPrefixProxyEditorModal';
import { OAuthExcludedCard } from '@/features/authFiles/components/OAuthExcludedCard';
import { OAuthModelAliasCard } from '@/features/authFiles/components/OAuthModelAliasCard';
import { useAuthFilesData } from '@/features/authFiles/hooks/useAuthFilesData';
import { useAuthFilesModels } from '@/features/authFiles/hooks/useAuthFilesModels';
import { useAuthFilesOauth } from '@/features/authFiles/hooks/useAuthFilesOauth';
import { useAuthFilesPrefixProxyEditor } from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { useAuthFilesStatusBarCache } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import { apiCallApi, authFilesApi, getApiCallErrorMessage } from '@/services/api';
import type { ApiCallRequest } from '@/services/api';
import {
  isAuthFilesSortMode,
  readAuthFilesUiState,
  readPersistedAuthFilesCompactMode,
  writeAuthFilesUiState,
  writePersistedAuthFilesCompactMode,
  type AuthFilesSortMode,
} from '@/features/authFiles/uiState';
import { useAuthStore, useNotificationStore, useThemeStore } from '@/stores';
import { useQuotaStore } from '@/stores/useQuotaStore';
import type { AuthFileItem } from '@/types';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { getStatusFromError, resolveAuthProvider } from '@/utils/quota';
import styles from './AuthFilesPage.module.scss';

const easePower3Out = (progress: number) => 1 - (1 - progress) ** 4;
const easePower2In = (progress: number) => progress ** 3;
const BATCH_BAR_BASE_TRANSFORM = 'translateX(-50%)';
const BATCH_BAR_HIDDEN_TRANSFORM = 'translateX(-50%) translateY(56px)';
const DEFAULT_REGULAR_PAGE_SIZE = DEFAULT_CARD_PAGE_SIZE;
const DEFAULT_COMPACT_PAGE_SIZE = DEFAULT_CARD_PAGE_SIZE;
const AUTH_FILE_PROBE_STATE_KEY = 'authFilesPage.probeStatus';
const PROBE_CONCURRENCY = 4;

type ProbeStatus = 'idle' | 'loading' | 'success' | 'error' | 'skipped';

type AuthFileProbeState = {
  status: ProbeStatus;
  statusCode?: number;
  message?: string;
  checkedAt?: number;
};

type ProbeTarget = {
  file: AuthFileItem;
  authIndex: string;
};

type ProbeQuotaConfig = QuotaConfig<unknown, unknown>;

type FailedProbeQuotaTarget = {
  file: AuthFileItem;
  message: string;
  status?: number;
};

const QUOTA_CONFIGS: ProbeQuotaConfig[] = [
  CLAUDE_CONFIG as ProbeQuotaConfig,
  ANTIGRAVITY_CONFIG as ProbeQuotaConfig,
  CODEX_CONFIG as ProbeQuotaConfig,
  GEMINI_CLI_CONFIG as ProbeQuotaConfig,
  KIMI_CONFIG as ProbeQuotaConfig,
];

type TernaryFilter = 'all' | 'yes' | 'no';
type RuntimeFilter = 'all' | 'file' | 'runtime';
type ProbeFilter =
  | 'all'
  | 'success'
  | 'error'
  | 'auth-error'
  | '401'
  | '403'
  | 'usage-limit'
  | 'skipped'
  | 'unprobed';

const escapeWildcardSearchSegment = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildWildcardSearch = (value: string): RegExp | null => {
  if (!value.includes('*')) return null;
  const pattern = value.split('*').map(escapeWildcardSearchSegment).join('.*');
  return new RegExp(pattern, 'i');
};

const readProbeState = (): Record<string, AuthFileProbeState> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(AUTH_FILE_PROBE_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, AuthFileProbeState>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeProbeState = (state: Record<string, AuthFileProbeState>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_FILE_PROBE_STATE_KEY, JSON.stringify(state));
};

const normalizeProbeProvider = (file: AuthFileItem) =>
  normalizeProviderKey(String(file.type ?? file.provider ?? 'unknown'));

const hasTextField = (file: AuthFileItem, key: string) =>
  typeof file[key] === 'string' && String(file[key]).trim().length > 0;

const hasHeadersField = (file: AuthFileItem) => {
  const headers = file.headers ?? file['headers'];
  return Boolean(headers && typeof headers === 'object' && Object.keys(headers).length > 0);
};

const matchesTernary = (filter: TernaryFilter, value: boolean) =>
  filter === 'all' || (filter === 'yes' ? value : !value);

const getUsageLimitText = (value: unknown, seen = new WeakSet<object>()): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => getUsageLimitText(item, seen)).join(' ');
  if (typeof value !== 'object') return '';
  if (seen.has(value)) return '';
  seen.add(value);

  const record = value as Record<string, unknown>;
  return Object.values(record)
    .map((item) => getUsageLimitText(item, seen))
    .filter(Boolean)
    .join(' ');
};

const hasUsageLimitReached = (value: unknown) => {
  const normalizedMessage = getUsageLimitText(value).toLowerCase();
  return (
    normalizedMessage.includes('usage_limit_reached') ||
    normalizedMessage.includes('usage limit has been reached')
  );
};

const parseMinNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const readCount = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(value)) return value.length;
  return 0;
};

const buildProbeRequest = (file: AuthFileItem, authIndex: string): ApiCallRequest | null => {
  const provider = normalizeProbeProvider(file);

  if (provider === 'claude') {
    return {
      authIndex,
      method: 'GET',
      url: 'https://api.anthropic.com/api/oauth/profile',
      header: {
        Authorization: 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
      },
    };
  }

  if (provider === 'codex') {
    return {
      authIndex,
      method: 'GET',
      url: 'https://chatgpt.com/backend-api/wham/usage',
      header: {
        Authorization: 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
        'User-Agent': 'codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal',
      },
    };
  }

  if (provider === 'kimi') {
    return {
      authIndex,
      method: 'GET',
      url: 'https://api.kimi.com/coding/v1/usages',
      header: { Authorization: 'Bearer $TOKEN$' },
    };
  }

  if (provider === 'gemini-cli') {
    return {
      authIndex,
      method: 'POST',
      url: 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
      header: {
        Authorization: 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({}),
    };
  }

  if (provider === 'antigravity') {
    return {
      authIndex,
      method: 'POST',
      url: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
      header: {
        Authorization: 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity/1.11.5 windows/amd64',
      },
      data: JSON.stringify({ project: 'bamboo-precept-lgxtn' }),
    };
  }

  if (provider === 'gemini' || provider === 'aistudio') {
    return {
      authIndex,
      method: 'GET',
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      header: { 'x-goog-api-key': '$TOKEN$' },
    };
  }

  if (provider === 'qwen') {
    return {
      authIndex,
      method: 'GET',
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      header: { Authorization: 'Bearer $TOKEN$' },
    };
  }

  if (provider === 'xai') {
    return {
      authIndex,
      method: 'GET',
      url: 'https://api.x.ai/v1/models',
      header: { Authorization: 'Bearer $TOKEN$' },
    };
  }

  return null;
};

const getProbeQuotaConfig = (file: AuthFileItem): ProbeQuotaConfig | null => {
  return QUOTA_CONFIGS.find((config) => config.filterFn(file)) ?? null;
};

const setQuotaForFiles = (config: ProbeQuotaConfig, files: AuthFileItem[]) => {
  const setter = useQuotaStore.getState()[config.storeSetter] as (
    updater: (prev: Record<string, unknown>) => Record<string, unknown>
  ) => void;

  setter((prev) => {
    const next = { ...prev };
    files.forEach((file) => {
      next[file.name] = config.buildLoadingState();
    });
    return next;
  });
};

const setQuotaResult = (
  config: ProbeQuotaConfig,
  file: AuthFileItem,
  updater: (config: ProbeQuotaConfig) => unknown
) => {
  const setter = useQuotaStore.getState()[config.storeSetter] as (
    updater: (prev: Record<string, unknown>) => Record<string, unknown>
  ) => void;

  setter((prev) => ({
    ...prev,
    [file.name]: updater(config),
  }));
};

const refreshQuotaCacheForProbeResults = async (
  successfulTargets: ProbeTarget[],
  failedTargets: FailedProbeQuotaTarget[],
  t: ReturnType<typeof useTranslation>['t']
): Promise<FailedProbeQuotaTarget[]> => {
  const groupedTargets = new Map<ProbeQuotaConfig, AuthFileItem[]>();
  const quotaFailures: FailedProbeQuotaTarget[] = [];

  failedTargets.forEach(({ file, message, status }) => {
    const config = getProbeQuotaConfig(file);
    if (!config) return;
    setQuotaResult(config, file, (quotaConfig) => quotaConfig.buildErrorState(message, status));
  });

  successfulTargets.forEach(({ file }) => {
    const config = getProbeQuotaConfig(file);
    if (!config) return;
    const files = groupedTargets.get(config) ?? [];
    files.push(file);
    groupedTargets.set(config, files);
  });

  const quotaTargets = Array.from(groupedTargets.entries()).flatMap(([config, files]) => {
    setQuotaForFiles(config, files);
    return files.map((file) => ({ config, file }));
  });

  await runLimited(quotaTargets, PROBE_CONCURRENCY, async ({ config, file }) => {
    try {
      const data = await config.fetchQuota(file, t);
      setQuotaResult(config, file, (quotaConfig) => quotaConfig.buildSuccessState(data));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.unknown_error');
      const status = getStatusFromError(err);
      quotaFailures.push({ file, message, status });
      setQuotaResult(config, file, (quotaConfig) => quotaConfig.buildErrorState(message, status));
    }
  });

  return quotaFailures;
};

const runLimited = async <T,>(items: T[], limit: number, worker: (item: T) => Promise<void>) => {
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    })
  );
};

export function AuthFilesPage() {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme: ResolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const pageTransitionLayer = usePageTransitionLayer();
  const isCurrentLayer = pageTransitionLayer ? pageTransitionLayer.status === 'current' : true;
  const navigate = useNavigate();

  const [filter, setFilter] = useState<'all' | string>('all');
  const [problemOnly, setProblemOnly] = useState(false);
  const [noIssueOnly, setNoIssueOnly] = useState(false);
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [authErrorOnly, setAuthErrorOnly] = useState(false);
  const [probeResultFilter, setProbeResultFilter] = useState<ProbeFilter>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<RuntimeFilter>('all');
  const [authIndexFilter, setAuthIndexFilter] = useState<TernaryFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TernaryFilter>('all');
  const [noteFilter, setNoteFilter] = useState<TernaryFilter>('all');
  const [prefixFilter, setPrefixFilter] = useState<TernaryFilter>('all');
  const [proxyFilter, setProxyFilter] = useState<TernaryFilter>('all');
  const [headersFilter, setHeadersFilter] = useState<TernaryFilter>('all');
  const [successMinInput, setSuccessMinInput] = useState('');
  const [failureMinInput, setFailureMinInput] = useState('');
  const [sizeMinKbInput, setSizeMinKbInput] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSizeByMode, setPageSizeByMode] = useState({
    regular: DEFAULT_REGULAR_PAGE_SIZE,
    compact: DEFAULT_COMPACT_PAGE_SIZE,
  });
  const [pageSizeInput, setPageSizeInput] = useState('9');
  const [pageInput, setPageInput] = useState('1');
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('list');
  const [sortMode, setSortMode] = useState<AuthFilesSortMode>('default');
  const [probeState, setProbeState] = useState<Record<string, AuthFileProbeState>>({});
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeProgress, setProbeProgress] = useState({ done: 0, total: 0 });
  const [batchActionBarVisible, setBatchActionBarVisible] = useState(false);
  const [uiStateHydrated, setUiStateHydrated] = useState(false);
  const floatingBatchActionsRef = useRef<HTMLDivElement>(null);
  const batchActionAnimationRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const previousSelectionCountRef = useRef(0);
  const selectionCountRef = useRef(0);

  const {
    files,
    selectedFiles,
    selectionCount,
    loading,
    error,
    uploading,
    deleting,
    deletingAll,
    statusUpdating,
    batchStatusUpdating,
    fileInputRef,
    loadFiles,
    handleUploadClick,
    handleFileChange,
    handleDelete,
    handleDeleteAll,
    handleDownload,
    handleStatusToggle,
    toggleSelect,
    selectAllVisible,
    invertVisibleSelection,
    deselectAll,
    batchDownload,
    batchSetStatus,
    batchDelete,
  } = useAuthFilesData();
  const antigravityQuota = useQuotaStore((state) => state.antigravityQuota);
  const claudeQuota = useQuotaStore((state) => state.claudeQuota);
  const codexQuota = useQuotaStore((state) => state.codexQuota);
  const geminiCliQuota = useQuotaStore((state) => state.geminiCliQuota);
  const kimiQuota = useQuotaStore((state) => state.kimiQuota);

  const statusBarCache = useAuthFilesStatusBarCache(files);

  const {
    excluded,
    excludedError,
    modelAlias,
    modelAliasError,
    allProviderModels,
    loadExcluded,
    loadModelAlias,
    deleteExcluded,
    deleteModelAlias,
    handleMappingUpdate,
    handleDeleteLink,
    handleToggleFork,
    handleRenameAlias,
    handleDeleteAlias,
  } = useAuthFilesOauth({ viewMode, files });

  const {
    modelsModalOpen,
    modelsLoading,
    modelsList,
    modelsFileName,
    modelsFileType,
    modelsError,
    showModels,
    closeModelsModal,
  } = useAuthFilesModels();

  const {
    prefixProxyEditor,
    prefixProxyUpdatedText,
    prefixProxyDirty,
    openPrefixProxyEditor,
    closePrefixProxyEditor,
    handlePrefixProxyChange,
    handlePrefixProxySave,
  } = useAuthFilesPrefixProxyEditor({
    disableControls: connectionStatus !== 'connected',
    loadFiles,
  });

  const disableControls = connectionStatus !== 'connected';
  const normalizedFilter = normalizeProviderKey(String(filter));
  const quotaFilterType: QuotaProviderType | null = QUOTA_PROVIDER_TYPES.has(
    normalizedFilter as QuotaProviderType
  )
    ? (normalizedFilter as QuotaProviderType)
    : null;
  const pageSize = compactMode ? pageSizeByMode.compact : pageSizeByMode.regular;

  useEffect(() => {
    const persistedCompactMode = readPersistedAuthFilesCompactMode();
    if (typeof persistedCompactMode === 'boolean') {
      setCompactMode(persistedCompactMode);
    }

    const persisted = readAuthFilesUiState();
    if (persisted) {
      if (typeof persisted.filter === 'string' && persisted.filter.trim()) {
        setFilter(normalizeProviderKey(persisted.filter));
      }
      if (typeof persisted.problemOnly === 'boolean') {
        setProblemOnly(persisted.problemOnly);
      }
      if (typeof persisted.noIssueOnly === 'boolean') {
        setNoIssueOnly(persisted.noIssueOnly);
      }
      if (typeof persisted.disabledOnly === 'boolean') {
        setDisabledOnly(persisted.disabledOnly);
      }
      if (typeof persisted.enabledOnly === 'boolean') {
        setEnabledOnly(persisted.enabledOnly);
      }
      if (typeof persisted.authErrorOnly === 'boolean') {
        setAuthErrorOnly(persisted.authErrorOnly);
        if (persisted.authErrorOnly) setProbeResultFilter('auth-error');
      } else if (typeof persisted.unauthorizedOnly === 'boolean') {
        setAuthErrorOnly(persisted.unauthorizedOnly);
        if (persisted.unauthorizedOnly) setProbeResultFilter('auth-error');
      }
      if (
        persisted.probeResultFilter === 'success' ||
        persisted.probeResultFilter === 'error' ||
        persisted.probeResultFilter === 'auth-error' ||
        persisted.probeResultFilter === '401' ||
        persisted.probeResultFilter === '403' ||
        persisted.probeResultFilter === 'usage-limit' ||
        persisted.probeResultFilter === 'skipped' ||
        persisted.probeResultFilter === 'unprobed'
      ) {
        setProbeResultFilter(persisted.probeResultFilter);
        setAuthErrorOnly(['auth-error', '401', '403'].includes(persisted.probeResultFilter));
      }
      if (persisted.runtimeFilter === 'file' || persisted.runtimeFilter === 'runtime') {
        setRuntimeFilter(persisted.runtimeFilter);
      }
      if (persisted.authIndexFilter === 'yes' || persisted.authIndexFilter === 'no') {
        setAuthIndexFilter(persisted.authIndexFilter);
      }
      if (persisted.priorityFilter === 'yes' || persisted.priorityFilter === 'no') {
        setPriorityFilter(persisted.priorityFilter);
      }
      if (persisted.noteFilter === 'yes' || persisted.noteFilter === 'no') {
        setNoteFilter(persisted.noteFilter);
      }
      if (persisted.prefixFilter === 'yes' || persisted.prefixFilter === 'no') {
        setPrefixFilter(persisted.prefixFilter);
      }
      if (persisted.proxyFilter === 'yes' || persisted.proxyFilter === 'no') {
        setProxyFilter(persisted.proxyFilter);
      }
      if (persisted.headersFilter === 'yes' || persisted.headersFilter === 'no') {
        setHeadersFilter(persisted.headersFilter);
      }
      if (typeof persisted.successMinInput === 'string') {
        setSuccessMinInput(persisted.successMinInput);
      }
      if (typeof persisted.failureMinInput === 'string') {
        setFailureMinInput(persisted.failureMinInput);
      }
      if (typeof persisted.sizeMinKbInput === 'string') {
        setSizeMinKbInput(persisted.sizeMinKbInput);
      }
      if (typeof persistedCompactMode !== 'boolean' && typeof persisted.compactMode === 'boolean') {
        setCompactMode(persisted.compactMode);
      }
      if (typeof persisted.search === 'string') {
        setSearch(persisted.search);
      }
      if (typeof persisted.page === 'number' && Number.isFinite(persisted.page)) {
        setPage(Math.max(1, Math.round(persisted.page)));
      }
      const legacyPageSize =
        typeof persisted.pageSize === 'number' && Number.isFinite(persisted.pageSize)
          ? clampCardPageSize(persisted.pageSize)
          : null;
      const regularPageSize =
        typeof persisted.regularPageSize === 'number' && Number.isFinite(persisted.regularPageSize)
          ? clampCardPageSize(persisted.regularPageSize)
          : (legacyPageSize ?? DEFAULT_REGULAR_PAGE_SIZE);
      const compactPageSize =
        typeof persisted.compactPageSize === 'number' && Number.isFinite(persisted.compactPageSize)
          ? clampCardPageSize(persisted.compactPageSize)
          : (legacyPageSize ?? DEFAULT_COMPACT_PAGE_SIZE);
      setPageSizeByMode({
        regular: regularPageSize,
        compact: compactPageSize,
      });
      if (isAuthFilesSortMode(persisted.sortMode)) {
        setSortMode(persisted.sortMode);
      }
    }

    setProbeState(readProbeState());
    setUiStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!uiStateHydrated) return;

    writeAuthFilesUiState({
      filter,
      problemOnly,
      noIssueOnly,
      disabledOnly,
      enabledOnly,
      authErrorOnly,
      probeResultFilter,
      runtimeFilter,
      authIndexFilter,
      priorityFilter,
      noteFilter,
      prefixFilter,
      proxyFilter,
      headersFilter,
      successMinInput,
      failureMinInput,
      sizeMinKbInput,
      compactMode,
      search,
      page,
      pageSize,
      regularPageSize: pageSizeByMode.regular,
      compactPageSize: pageSizeByMode.compact,
      sortMode,
    });
    writePersistedAuthFilesCompactMode(compactMode);
  }, [
    compactMode,
    disabledOnly,
    enabledOnly,
    failureMinInput,
    filter,
    headersFilter,
    authIndexFilter,
    noteFilter,
    noIssueOnly,
    page,
    pageSize,
    pageSizeByMode,
    prefixFilter,
    priorityFilter,
    problemOnly,
    proxyFilter,
    probeResultFilter,
    runtimeFilter,
    search,
    sizeMinKbInput,
    sortMode,
    successMinInput,
    authErrorOnly,
    uiStateHydrated,
  ]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  const setCurrentModePageSize = useCallback(
    (next: number) => {
      setPageSizeByMode((current) =>
        compactMode ? { ...current, compact: next } : { ...current, regular: next }
      );
    },
    [compactMode]
  );

  const commitPageSizeInput = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setPageSizeInput(String(pageSize));
      return;
    }

    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      setPageSizeInput(String(pageSize));
      return;
    }

    const next = clampCardPageSize(value);
    setCurrentModePageSize(next);
    setPageSizeInput(String(next));
    setPage(1);
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    setPageSizeInput(rawValue);

    const trimmed = rawValue.trim();
    if (!trimmed) return;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;

    const rounded = Math.round(parsed);
    if (rounded < MIN_CARD_PAGE_SIZE) return;

    setCurrentModePageSize(rounded);
    setPage(1);
  };

  const handleSortModeChange = useCallback(
    (value: string) => {
      if (!isAuthFilesSortMode(value) || value === sortMode) return;
      setSortMode(value);
      setPage(1);
      void loadFiles().catch(() => {});
    },
    [loadFiles, sortMode]
  );

  const handleHeaderRefresh = useCallback(async () => {
    await Promise.all([loadFiles(), loadExcluded(), loadModelAlias()]);
  }, [loadFiles, loadExcluded, loadModelAlias]);

  useHeaderRefresh(handleHeaderRefresh);

  useEffect(() => {
    if (!isCurrentLayer) return;
    loadFiles();
    loadExcluded();
    loadModelAlias();
  }, [isCurrentLayer, loadFiles, loadExcluded, loadModelAlias]);

  useInterval(
    () => {
      void loadFiles().catch(() => {});
    },
    isCurrentLayer ? 240_000 : null
  );

  const existingTypes = useMemo(() => {
    const types = new Set<string>(['all']);
    files.forEach((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (type) types.add(type);
    });
    return Array.from(types);
  }, [files]);

  const filesMatchingStatusFilters = useMemo(() => {
    const successMin = parseMinNumber(successMinInput);
    const failureMin = parseMinNumber(failureMinInput);
    const sizeMinBytes = parseMinNumber(sizeMinKbInput);
    const minBytes = sizeMinBytes === null ? null : sizeMinBytes * 1024;

    return files.filter((file) => {
      const probe = probeState[file.name];
      const provider = normalizeProviderKey(resolveAuthProvider(file));
      const quotaState =
        provider === 'antigravity'
          ? antigravityQuota[file.name]
          : provider === 'claude'
            ? claudeQuota[file.name]
            : provider === 'codex'
              ? codexQuota[file.name]
              : provider === 'gemini-cli'
                ? geminiCliQuota[file.name]
                : provider === 'kimi'
                  ? kimiQuota[file.name]
                  : undefined;
      const isRuntime = isRuntimeOnlyAuthFile(file);
      if (problemOnly && !hasAuthFileStatusMessage(file)) return false;
      if (noIssueOnly && hasAuthFileStatusMessage(file)) return false;
      if (disabledOnly && file.disabled !== true) return false;
      if (enabledOnly && file.disabled === true) return false;
      if (
        authErrorOnly &&
        probeResultFilter === 'all' &&
        ![401, 403].includes(probe?.statusCode ?? 0)
      ) {
        return false;
      }
      if (probeResultFilter === 'success' && probe?.status !== 'success') return false;
      if (probeResultFilter === 'error' && probe?.status !== 'error') return false;
      if (probeResultFilter === '401' && probe?.statusCode !== 401) return false;
      if (probeResultFilter === '403' && probe?.statusCode !== 403) return false;
      if (
        probeResultFilter === 'usage-limit' &&
        !hasUsageLimitReached(file) &&
        !hasUsageLimitReached(probe) &&
        !hasUsageLimitReached(quotaState)
      )
        return false;
      if (probeResultFilter === 'skipped' && probe?.status !== 'skipped') return false;
      if (probeResultFilter === 'unprobed' && probe) return false;
      if (runtimeFilter === 'file' && isRuntime) return false;
      if (runtimeFilter === 'runtime' && !isRuntime) return false;
      if (
        !matchesTernary(
          authIndexFilter,
          normalizeAuthIndex(file['auth_index'] ?? file.authIndex) !== null
        )
      )
        return false;
      if (
        !matchesTernary(
          priorityFilter,
          parsePriorityValue(file.priority ?? file['priority']) !== undefined
        )
      )
        return false;
      if (!matchesTernary(noteFilter, hasTextField(file, 'note'))) return false;
      if (!matchesTernary(prefixFilter, hasTextField(file, 'prefix'))) return false;
      if (!matchesTernary(proxyFilter, hasTextField(file, 'proxy_url'))) return false;
      if (!matchesTernary(headersFilter, hasHeadersField(file))) return false;
      if (successMin !== null && readCount(file.success) < successMin) return false;
      if (failureMin !== null && readCount(file.failed) < failureMin) return false;
      if (minBytes !== null && (typeof file.size === 'number' ? file.size : 0) < minBytes)
        return false;
      return true;
    });
  }, [
    authErrorOnly,
    authIndexFilter,
    antigravityQuota,
    claudeQuota,
    codexQuota,
    disabledOnly,
    enabledOnly,
    failureMinInput,
    files,
    geminiCliQuota,
    headersFilter,
    kimiQuota,
    noteFilter,
    noIssueOnly,
    prefixFilter,
    priorityFilter,
    probeResultFilter,
    probeState,
    problemOnly,
    proxyFilter,
    runtimeFilter,
    sizeMinKbInput,
    successMinInput,
  ]);

  const sortOptions = useMemo(
    () => [
      { value: 'default', label: t('auth_files.sort_default') },
      { value: 'az', label: t('auth_files.sort_az') },
      { value: 'priority', label: t('auth_files.sort_priority') },
    ],
    [t]
  );

  const issueFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('auth_files.filter_any') },
      { value: 'problem', label: t('auth_files.problem_filter_only') },
      { value: 'no-issue', label: t('auth_files.no_issue_filter_only') },
    ],
    [t]
  );

  const disabledFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('auth_files.filter_any') },
      { value: 'enabled', label: t('auth_files.enabled_filter_only') },
      { value: 'disabled', label: t('auth_files.disabled_filter_only') },
    ],
    [t]
  );

  const probeFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('auth_files.filter_any') },
      { value: 'success', label: t('auth_files.probe_filter_success') },
      { value: 'error', label: t('auth_files.probe_filter_error') },
      { value: 'auth-error', label: t('auth_files.auth_error_filter_only') },
      { value: '401', label: '401' },
      { value: '403', label: '403' },
      { value: 'usage-limit', label: t('auth_files.usage_limit_filter_only') },
      { value: 'skipped', label: t('auth_files.probe_filter_skipped') },
      { value: 'unprobed', label: t('auth_files.probe_filter_unprobed') },
    ],
    [t]
  );

  const ternaryFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('auth_files.filter_any') },
      { value: 'yes', label: t('common.yes', { defaultValue: 'Yes' }) },
      { value: 'no', label: t('common.no', { defaultValue: 'No' }) },
    ],
    [t]
  );

  const runtimeFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('auth_files.filter_any') },
      { value: 'file', label: t('auth_files.runtime_filter_file') },
      { value: 'runtime', label: t('auth_files.runtime_filter_runtime') },
    ],
    [t]
  );

  const probeFilterValue: ProbeFilter = probeResultFilter;

  const handleProbeFilterChange = (value: string) => {
    const next = value as ProbeFilter;
    setProbeResultFilter(next);
    setAuthErrorOnly(['auth-error', '401', '403'].includes(next));
    setPage(1);
  };

  const advancedFilterCount = useMemo(
    () =>
      [
        runtimeFilter !== 'all',
        authIndexFilter !== 'all',
        priorityFilter !== 'all',
        noteFilter !== 'all',
        prefixFilter !== 'all',
        proxyFilter !== 'all',
        headersFilter !== 'all',
        successMinInput.trim().length > 0,
        failureMinInput.trim().length > 0,
        sizeMinKbInput.trim().length > 0,
      ].filter(Boolean).length,
    [
      authIndexFilter,
      failureMinInput,
      headersFilter,
      noteFilter,
      prefixFilter,
      priorityFilter,
      proxyFilter,
      runtimeFilter,
      sizeMinKbInput,
      successMinInput,
    ]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filesMatchingStatusFilters.length };
    filesMatchingStatusFilters.forEach((file) => {
      const type = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
      if (!type) return;
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [filesMatchingStatusFilters]);

  const normalizedSearch = search.trim();
  const wildcardSearch = useMemo(() => buildWildcardSearch(normalizedSearch), [normalizedSearch]);

  const filtered = useMemo(() => {
    const normalizedTerm = normalizedSearch.toLowerCase();

    return filesMatchingStatusFilters.filter((item) => {
      const type = normalizeProviderKey(String(item.type ?? item.provider ?? ''));
      const matchType = normalizedFilter === 'all' || type === normalizedFilter;
      const matchSearch =
        !normalizedSearch ||
        [item.name, item.type, item.provider].some((value) => {
          const content = (value || '').toString();
          return wildcardSearch
            ? wildcardSearch.test(content)
            : content.toLowerCase().includes(normalizedTerm);
        });
      return matchType && matchSearch;
    });
  }, [filesMatchingStatusFilters, normalizedFilter, normalizedSearch, wildcardSearch]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortMode === 'default') {
      copy.sort((a, b) => {
        const providerA = normalizeProviderKey(String(a.provider ?? a.type ?? 'unknown'));
        const providerB = normalizeProviderKey(String(b.provider ?? b.type ?? 'unknown'));
        const providerCompare = providerA.localeCompare(providerB);
        if (providerCompare !== 0) return providerCompare;
        return a.name.localeCompare(b.name);
      });
    } else if (sortMode === 'az') {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'priority') {
      copy.sort((a, b) => {
        const pa = parsePriorityValue(a.priority ?? a['priority']) ?? 0;
        const pb = parsePriorityValue(b.priority ?? b['priority']) ?? 0;
        return pb - pa; // 高优先级排前面
      });
    }
    return copy;
  }, [filtered, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(sorted.length, start + pageSize);
  const pageItems = sorted.slice(start, start + pageSize);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);
  const selectablePageItems = useMemo(
    () => pageItems.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [pageItems]
  );
  const selectableFilteredItems = useMemo(
    () => sorted.filter((file) => !isRuntimeOnlyAuthFile(file)),
    [sorted]
  );
  const selectedNames = useMemo(() => Array.from(selectedFiles), [selectedFiles]);
  const selectedHasStatusUpdating = useMemo(
    () => selectedNames.some((name) => statusUpdating[name] === true),
    [selectedNames, statusUpdating]
  );
  const batchStatusButtonsDisabled =
    disableControls ||
    selectedNames.length === 0 ||
    batchStatusUpdating ||
    selectedHasStatusUpdating;

  const commitPageInput = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      setPageInput(String(currentPage));
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(currentPage));
      return;
    }

    const next = Math.min(totalPages, Math.max(1, Math.round(parsed)));
    setPage(next);
    setPageInput(String(next));
  };

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    setPageInput(rawValue);

    const parsed = Number(rawValue.trim());
    if (!Number.isFinite(parsed)) return;
    const rounded = Math.round(parsed);
    if (rounded < 1 || rounded > totalPages) return;
    setPage(rounded);
  };

  const probeSummary = useMemo(() => {
    const entries = files.map((file) => probeState[file.name]).filter(Boolean);
    const authErrors = entries.filter((state) => [401, 403].includes(state.statusCode ?? 0)).length;
    const errors = entries.filter((state) => state.status === 'error').length;
    const success = entries.filter((state) => state.status === 'success').length;
    return { authErrors, errors, success, checked: entries.length };
  }, [files, probeState]);

  const updateProbeState = useCallback(
    (updater: (prev: Record<string, AuthFileProbeState>) => Record<string, AuthFileProbeState>) => {
      setProbeState((prev) => {
        const next = updater(prev);
        writeProbeState(next);
        return next;
      });
    },
    []
  );

  const probeCredentials = useCallback(async (targetNames?: Set<string>) => {
    if (probeRunning) return;

    setProbeRunning(true);
    setProbeProgress({ done: 0, total: 0 });

    try {
      const data = await authFilesApi.list();
      const targets: ProbeTarget[] = (data.files || [])
        .filter((file) => !targetNames || targetNames.has(file.name))
        .map((file) => ({
          file,
          authIndex: normalizeAuthIndex(file['auth_index'] ?? file.authIndex),
        }))
        .filter((entry): entry is ProbeTarget => Boolean(entry.authIndex));

      setProbeProgress({ done: 0, total: targets.length });

      if (targets.length === 0) {
        showNotification(t('auth_files.probe_no_targets'), 'warning');
        return;
      }

      updateProbeState((prev) => {
        const next = { ...prev };
        targets.forEach(({ file }) => {
          next[file.name] = { status: 'loading', checkedAt: Date.now() };
        });
        return next;
      });

      const successfulTargets: ProbeTarget[] = [];
      const failedTargets: FailedProbeQuotaTarget[] = [];

      await runLimited(targets, PROBE_CONCURRENCY, async ({ file, authIndex }) => {
        const checkedAt = Date.now();
        try {
          const request = buildProbeRequest(file, authIndex);
          if (!request) {
            updateProbeState((prev) => ({
              ...prev,
              [file.name]: {
                status: 'skipped',
                message: `Unsupported provider: ${normalizeProbeProvider(file)}`,
                checkedAt,
              },
            }));
            return;
          }

          const result = await apiCallApi.request(request);
          const ok = result.statusCode >= 200 && result.statusCode < 300;
          const message = ok ? 'OK' : getApiCallErrorMessage(result);
          if (ok) {
            successfulTargets.push({ file, authIndex });
          } else {
            failedTargets.push({ file, message, status: result.statusCode });
          }
          updateProbeState((prev) => ({
            ...prev,
            [file.name]: {
              status: ok ? 'success' : 'error',
              statusCode: result.statusCode,
              message,
              checkedAt,
            },
          }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : t('common.unknown_error');
          failedTargets.push({ file, message });
          updateProbeState((prev) => ({
            ...prev,
            [file.name]: {
              status: 'error',
              message,
              checkedAt,
            },
          }));
        } finally {
          setProbeProgress((prev) => ({ ...prev, done: Math.min(prev.total, prev.done + 1) }));
        }
      });

      const quotaFailures = await refreshQuotaCacheForProbeResults(successfulTargets, failedTargets, t);
      if (quotaFailures.length > 0) {
        updateProbeState((prev) => {
          const next = { ...prev };
          quotaFailures.forEach(({ file, message, status }) => {
            next[file.name] = {
              status: 'error',
              statusCode: status,
              message,
              checkedAt: Date.now(),
            };
          });
          return next;
        });
      }

      showNotification(t('auth_files.probe_complete'), 'success');
      await loadFiles();
    } finally {
      setProbeRunning(false);
    }
  }, [loadFiles, probeRunning, showNotification, t, updateProbeState]);

  const handleProbeAllCredentials = useCallback(() => probeCredentials(), [probeCredentials]);

  const handleProbeSelectedCredentials = useCallback(
    () => probeCredentials(new Set(selectedNames)),
    [probeCredentials, selectedNames]
  );

  const copyTextWithNotification = useCallback(
    async (text: string) => {
      const copied = await copyToClipboard(text);
      showNotification(
        copied
          ? t('notification.link_copied', { defaultValue: 'Copied to clipboard' })
          : t('notification.copy_failed', { defaultValue: 'Copy failed' }),
        copied ? 'success' : 'error'
      );
    },
    [showNotification, t]
  );

  const openExcludedEditor = useCallback(
    (provider?: string) => {
      const providerValue = (provider || (filter !== 'all' ? String(filter) : '')).trim();
      const params = new URLSearchParams();
      if (providerValue) {
        params.set('provider', providerValue);
      }
      const nextSearch = params.toString();
      navigate(`/auth-files/oauth-excluded${nextSearch ? `?${nextSearch}` : ''}`, {
        state: { fromAuthFiles: true },
      });
    },
    [filter, navigate]
  );

  const openModelAliasEditor = useCallback(
    (provider?: string) => {
      const providerValue = (provider || (filter !== 'all' ? String(filter) : '')).trim();
      const params = new URLSearchParams();
      if (providerValue) {
        params.set('provider', providerValue);
      }
      const nextSearch = params.toString();
      navigate(`/auth-files/oauth-model-alias${nextSearch ? `?${nextSearch}` : ''}`, {
        state: { fromAuthFiles: true },
      });
    },
    [filter, navigate]
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const actionsEl = floatingBatchActionsRef.current;
    if (!actionsEl) {
      document.documentElement.style.removeProperty('--auth-files-action-bar-height');
      return;
    }

    const updatePadding = () => {
      const height = actionsEl.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--auth-files-action-bar-height', `${height}px`);
    };

    updatePadding();
    window.addEventListener('resize', updatePadding);

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePadding);
    ro?.observe(actionsEl);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updatePadding);
      document.documentElement.style.removeProperty('--auth-files-action-bar-height');
    };
  }, [batchActionBarVisible, selectionCount]);

  useEffect(() => {
    selectionCountRef.current = selectionCount;
    if (selectionCount > 0) {
      setBatchActionBarVisible(true);
    }
  }, [selectionCount]);

  useLayoutEffect(() => {
    if (!batchActionBarVisible) return;
    const currentCount = selectionCount;
    const previousCount = previousSelectionCountRef.current;
    const actionsEl = floatingBatchActionsRef.current;
    if (!actionsEl) return;

    batchActionAnimationRef.current?.stop();
    batchActionAnimationRef.current = null;

    if (currentCount > 0 && previousCount === 0) {
      batchActionAnimationRef.current = animate(
        actionsEl,
        {
          transform: [BATCH_BAR_HIDDEN_TRANSFORM, BATCH_BAR_BASE_TRANSFORM],
          opacity: [0, 1],
        },
        {
          duration: 0.28,
          ease: easePower3Out,
          onComplete: () => {
            actionsEl.style.transform = BATCH_BAR_BASE_TRANSFORM;
            actionsEl.style.opacity = '1';
          },
        }
      );
    } else if (currentCount === 0 && previousCount > 0) {
      batchActionAnimationRef.current = animate(
        actionsEl,
        {
          transform: [BATCH_BAR_BASE_TRANSFORM, BATCH_BAR_HIDDEN_TRANSFORM],
          opacity: [1, 0],
        },
        {
          duration: 0.22,
          ease: easePower2In,
          onComplete: () => {
            if (selectionCountRef.current === 0) {
              setBatchActionBarVisible(false);
            }
          },
        }
      );
    }

    previousSelectionCountRef.current = currentCount;
  }, [batchActionBarVisible, selectionCount]);

  useEffect(
    () => () => {
      batchActionAnimationRef.current?.stop();
      batchActionAnimationRef.current = null;
    },
    []
  );

  const renderFilterTags = () => (
    <div className={styles.filterRail}>
      <div className={styles.filterTags}>
        {existingTypes.map((type) => {
          const isActive = normalizedFilter === type;
          const iconSrc = getAuthFileIcon(type, resolvedTheme);
          const color =
            type === 'all'
              ? { bg: 'var(--bg-tertiary)', text: 'var(--text-primary)' }
              : getTypeColor(type, resolvedTheme);
          const buttonStyle = {
            '--filter-color': color.text,
            '--filter-surface': color.bg,
            '--filter-active-text': resolvedTheme === 'dark' ? '#111827' : '#ffffff',
          } as CSSProperties;

          return (
            <button
              key={type}
              className={`${styles.filterTag} ${isActive ? styles.filterTagActive : ''}`}
              style={buttonStyle}
              onClick={() => {
                setFilter(type);
                setPage(1);
              }}
            >
              <span className={styles.filterTagLabel}>
                {type === 'all' ? (
                  <span className={`${styles.filterTagIconWrap} ${styles.filterAllIconWrap}`}>
                    <IconFilterAll className={styles.filterAllIcon} size={16} />
                  </span>
                ) : (
                  <span className={styles.filterTagIconWrap}>
                    {iconSrc ? (
                      <img src={iconSrc} alt="" className={styles.filterTagIcon} />
                    ) : (
                      <span className={styles.filterTagIconFallback}>
                        {getTypeLabel(t, type).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                )}
                <span className={styles.filterTagText}>{getTypeLabel(t, type)}</span>
              </span>
              <span className={styles.filterTagCount}>{typeCounts[type] ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const titleNode = (
    <div className={styles.titleWrapper}>
      <span>{t('auth_files.title_section')}</span>
      {files.length > 0 && <span className={styles.countBadge}>{files.length}</span>}
    </div>
  );

  const deleteAllButtonLabel = (() => {
    if (disabledOnly) {
      return t('auth_files.delete_filtered_result_button');
    }
    if (authErrorOnly) {
      return t('auth_files.delete_filtered_result_button');
    }
    if (problemOnly) {
      return normalizedFilter === 'all'
        ? t('auth_files.delete_problem_button')
        : t('auth_files.delete_problem_button_with_type', {
            type: getTypeLabel(t, normalizedFilter),
          });
    }
    return normalizedFilter === 'all'
      ? t('auth_files.delete_all_button')
      : `${t('common.delete')} ${getTypeLabel(t, normalizedFilter)}`;
  })();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('auth_files.title')}</h1>
        <p className={styles.description}>{t('auth_files.description')}</p>
      </div>

      <Card
        title={titleNode}
        extra={
          <div className={styles.headerActions}>
            <Button variant="secondary" size="sm" onClick={handleHeaderRefresh} disabled={loading}>
              {t('common.refresh')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => selectAllVisible(sorted)}
              disabled={loading || selectableFilteredItems.length === 0}
            >
              {t('auth_files.header_select_filtered')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={deselectAll}
              disabled={selectionCount === 0}
            >
              {t('auth_files.header_clear_selection')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => batchSetStatus(selectedNames, false)}
              disabled={batchStatusButtonsDisabled}
            >
              {t('auth_files.header_disable_selected')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleProbeSelectedCredentials()}
              disabled={disableControls || probeRunning || selectedNames.length === 0}
              loading={probeRunning && selectedNames.length > 0}
            >
              {t('auth_files.probe_selected_button')}
            </Button>
            <Button
              size="sm"
              onClick={handleUploadClick}
              disabled={disableControls || uploading}
              loading={uploading}
            >
              {t('auth_files.upload_button')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                handleDeleteAll({
                  filter,
                  problemOnly,
                  disabledOnly,
                  onResetFilterToAll: () => setFilter('all'),
                  onResetProblemOnly: () => setProblemOnly(false),
                  onResetDisabledOnly: () => setDisabledOnly(false),
                })
              }
              disabled={disableControls || loading || deletingAll || authErrorOnly}
              loading={deletingAll}
            >
              {deleteAllButtonLabel}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        }
      >
        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.filterSection}>
          {renderFilterTags()}

          <div className={styles.primaryFiltersPanel}>
            <div className={styles.primaryFilters}>
              <div className={styles.filterItem}>
                <label>{t('auth_files.search_label')}</label>
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t('auth_files.search_placeholder')}
                />
              </div>
              <div className={styles.filterItem}>
                <label>{t('auth_files.issue_filter_label')}</label>
                <Select
                  value={problemOnly ? 'problem' : noIssueOnly ? 'no-issue' : 'all'}
                  options={issueFilterOptions}
                  onChange={(value) => {
                    setProblemOnly(value === 'problem');
                    setNoIssueOnly(value === 'no-issue');
                    setPage(1);
                  }}
                  ariaLabel={t('auth_files.issue_filter_label')}
                  fullWidth
                />
              </div>
              <div className={styles.filterItem}>
                <label>{t('auth_files.disabled_filter_label')}</label>
                <Select
                  value={disabledOnly ? 'disabled' : enabledOnly ? 'enabled' : 'all'}
                  options={disabledFilterOptions}
                  onChange={(value) => {
                    setDisabledOnly(value === 'disabled');
                    setEnabledOnly(value === 'enabled');
                    setPage(1);
                  }}
                  ariaLabel={t('auth_files.disabled_filter_label')}
                  fullWidth
                />
              </div>
              <div className={styles.filterItem}>
                <label>{t('auth_files.probe_filter_label')}</label>
                <Select
                  value={probeFilterValue}
                  options={probeFilterOptions}
                  onChange={handleProbeFilterChange}
                  ariaLabel={t('auth_files.probe_filter_label')}
                  fullWidth
                />
              </div>
            </div>
          </div>

          <div className={styles.viewControlsPanel}>
            <div className={styles.viewControls}>
              <div className={styles.filterItem}>
                <label>{t('auth_files.sort_label')}</label>
                <Select
                  className={styles.sortSelect}
                  value={sortMode}
                  options={sortOptions}
                  onChange={handleSortModeChange}
                  ariaLabel={t('auth_files.sort_label')}
                  fullWidth
                />
              </div>
              <div className={styles.filterItem}>
                <label>{t('auth_files.page_size_label')}</label>
                <input
                  className={styles.pageSizeSelect}
                  type="number"
                  min={MIN_CARD_PAGE_SIZE}
                  step={1}
                  value={pageSizeInput}
                  aria-label={t('auth_files.page_size_label')}
                  onChange={handlePageSizeChange}
                  onBlur={(e) => commitPageSizeInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className={styles.filterItem}>
                <label>{t('auth_files.view_options_label')}</label>
                <div className={styles.viewToggleControl}>
                  <ToggleSwitch
                    checked={compactMode}
                    onChange={(value) => setCompactMode(value)}
                    ariaLabel={t('auth_files.compact_mode_label')}
                    label={
                      <span className={styles.filterToggleLabel}>
                        {t('auth_files.compact_mode_label')}
                      </span>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.advancedFiltersPanel}>
            <div className={styles.advancedFiltersHeader}>
              <div>
                <div className={styles.advancedFiltersTitle}>
                  {t('auth_files.advanced_filters_label')}
                </div>
                {advancedFilterCount > 0 && (
                  <span className={styles.advancedFiltersCount}>{advancedFilterCount}</span>
                )}
                <div className={styles.advancedFiltersHint}>
                  {t('auth_files.advanced_filters_hint')}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAdvancedFiltersOpen((value) => !value)}
              >
                {advancedFiltersOpen
                  ? t('auth_files.advanced_filters_collapse')
                  : t('auth_files.advanced_filters_expand')}
              </Button>
            </div>

            {advancedFiltersOpen && (
              <div className={styles.advancedFiltersGroup}>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.runtime_filter_label')}</label>
                  <Select
                    value={runtimeFilter}
                    options={runtimeFilterOptions}
                    onChange={(value) => {
                      setRuntimeFilter(value as RuntimeFilter);
                      setPage(1);
                    }}
                    ariaLabel={t('auth_files.runtime_filter_label')}
                    fullWidth
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.auth_index_filter_label')}</label>
                  <Select
                    value={authIndexFilter}
                    options={ternaryFilterOptions}
                    onChange={(value) => {
                      setAuthIndexFilter(value as TernaryFilter);
                      setPage(1);
                    }}
                    ariaLabel={t('auth_files.auth_index_filter_label')}
                    fullWidth
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.priority_filter_label')}</label>
                  <Select
                    value={priorityFilter}
                    options={ternaryFilterOptions}
                    onChange={(value) => {
                      setPriorityFilter(value as TernaryFilter);
                      setPage(1);
                    }}
                    ariaLabel={t('auth_files.priority_filter_label')}
                    fullWidth
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.note_filter_label')}</label>
                  <Select
                    value={noteFilter}
                    options={ternaryFilterOptions}
                    onChange={(value) => {
                      setNoteFilter(value as TernaryFilter);
                      setPage(1);
                    }}
                    ariaLabel={t('auth_files.note_filter_label')}
                    fullWidth
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.prefix_filter_label')}</label>
                  <Select
                    value={prefixFilter}
                    options={ternaryFilterOptions}
                    onChange={(value) => {
                      setPrefixFilter(value as TernaryFilter);
                      setPage(1);
                    }}
                    ariaLabel={t('auth_files.prefix_filter_label')}
                    fullWidth
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.proxy_filter_label')}</label>
                  <Select
                    value={proxyFilter}
                    options={ternaryFilterOptions}
                    onChange={(value) => {
                      setProxyFilter(value as TernaryFilter);
                      setPage(1);
                    }}
                    ariaLabel={t('auth_files.proxy_filter_label')}
                    fullWidth
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.headers_filter_label')}</label>
                  <Select
                    value={headersFilter}
                    options={ternaryFilterOptions}
                    onChange={(value) => {
                      setHeadersFilter(value as TernaryFilter);
                      setPage(1);
                    }}
                    ariaLabel={t('auth_files.headers_filter_label')}
                    fullWidth
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.success_min_filter_label')}</label>
                  <input
                    className={styles.pageSizeSelect}
                    type="number"
                    min={0}
                    step={1}
                    value={successMinInput}
                    onChange={(event) => {
                      setSuccessMinInput(event.currentTarget.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.failure_min_filter_label')}</label>
                  <input
                    className={styles.pageSizeSelect}
                    type="number"
                    min={0}
                    step={1}
                    value={failureMinInput}
                    onChange={(event) => {
                      setFailureMinInput(event.currentTarget.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className={styles.advancedFilterField}>
                  <label>{t('auth_files.size_min_filter_label')}</label>
                  <input
                    className={styles.pageSizeSelect}
                    type="number"
                    min={0}
                    step={1}
                    value={sizeMinKbInput}
                    onChange={(event) => {
                      setSizeMinKbInput(event.currentTarget.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.probePanel}>
            <div className={styles.probePanelHeader}>
              <div>
                <div className={styles.probePanelTitle}>{t('auth_files.probe_panel_label')}</div>
                <div className={styles.probePanelHint}>{t('auth_files.probe_panel_hint')}</div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleProbeAllCredentials()}
                disabled={disableControls || probeRunning}
                loading={probeRunning}
              >
                {probeRunning
                  ? t('auth_files.probe_progress', {
                      done: probeProgress.done,
                      total: probeProgress.total,
                    })
                  : t('auth_files.probe_all_button')}
              </Button>
            </div>

            {(probeRunning || probeSummary.checked > 0) && (
              <div className={styles.probeStatusPanel}>
                <div className={styles.probeStatusText}>
                  {probeRunning
                    ? t('auth_files.probe_progress_detail', {
                        done: probeProgress.done,
                        total: probeProgress.total,
                      })
                    : t('auth_files.probe_summary', {
                        checked: probeSummary.checked,
                        success: probeSummary.success,
                        errors: probeSummary.errors,
                        authErrors: probeSummary.authErrors,
                      })}
                </div>
                {probeRunning && probeProgress.total > 0 && (
                  <div className={styles.probeProgressTrack}>
                    <div
                      className={styles.probeProgressFill}
                      style={{
                        width: `${Math.round((probeProgress.done / probeProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.contentSection}>
          {loading ? (
            <div className={styles.hint}>{t('common.loading')}</div>
          ) : pageItems.length === 0 ? (
            <EmptyState
              title={t('auth_files.search_empty_title')}
              description={t('auth_files.search_empty_desc')}
            />
          ) : (
            <div
              className={`${styles.fileGrid} ${quotaFilterType ? styles.fileGridQuotaManaged : ''} ${compactMode ? styles.fileGridCompact : ''}`}
            >
              {pageItems.map((file) => (
                <AuthFileCard
                  key={file.name}
                  file={file}
                  compact={compactMode}
                  selected={selectedFiles.has(file.name)}
                  resolvedTheme={resolvedTheme}
                  disableControls={disableControls}
                  deleting={deleting}
                  statusUpdating={statusUpdating}
                  quotaFilterType={quotaFilterType}
                  statusBarCache={statusBarCache}
                  onShowModels={showModels}
                  onDownload={handleDownload}
                  onOpenPrefixProxyEditor={openPrefixProxyEditor}
                  onDelete={handleDelete}
                  onToggleStatus={handleStatusToggle}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}

          {!loading && sorted.length > pageSize && (
            <div className={styles.pagination}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                {t('auth_files.pagination_prev')}
              </Button>
              <div className={styles.pageInfo}>
                {t('auth_files.pagination_range_info', {
                  current: currentPage,
                  total: totalPages,
                  count: sorted.length,
                  start: start + 1,
                  end,
                })}
              </div>
              <label className={styles.paginationField}>
                <span>{t('auth_files.pagination_page_label')}</span>
                <input
                  className={styles.paginationInput}
                  type="number"
                  min={1}
                  max={totalPages}
                  step={1}
                  value={pageInput}
                  onChange={handlePageInputChange}
                  onBlur={(e) => commitPageInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
              >
                {t('auth_files.pagination_next')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <OAuthExcludedCard
        disableControls={disableControls}
        excludedError={excludedError}
        excluded={excluded}
        onAdd={() => openExcludedEditor()}
        onEdit={openExcludedEditor}
        onDelete={deleteExcluded}
      />

      <OAuthModelAliasCard
        disableControls={disableControls}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAdd={() => openModelAliasEditor()}
        onEditProvider={openModelAliasEditor}
        onDeleteProvider={deleteModelAlias}
        modelAliasError={modelAliasError}
        modelAlias={modelAlias}
        allProviderModels={allProviderModels}
        onUpdate={handleMappingUpdate}
        onDeleteLink={handleDeleteLink}
        onToggleFork={handleToggleFork}
        onRenameAlias={handleRenameAlias}
        onDeleteAlias={handleDeleteAlias}
      />

      <AuthFileModelsModal
        open={modelsModalOpen}
        fileName={modelsFileName}
        fileType={modelsFileType}
        loading={modelsLoading}
        error={modelsError}
        models={modelsList}
        excluded={excluded}
        onClose={closeModelsModal}
        onCopyText={copyTextWithNotification}
      />

      <AuthFilesPrefixProxyEditorModal
        disableControls={disableControls}
        editor={prefixProxyEditor}
        updatedText={prefixProxyUpdatedText}
        dirty={prefixProxyDirty}
        onClose={closePrefixProxyEditor}
        onCopyText={copyTextWithNotification}
        onSave={handlePrefixProxySave}
        onChange={handlePrefixProxyChange}
      />

      {batchActionBarVisible && typeof document !== 'undefined'
        ? createPortal(
            <div className={styles.batchActionContainer} ref={floatingBatchActionsRef}>
              <div className={styles.batchActionBar}>
                <div className={styles.batchActionLeft}>
                  <span className={styles.batchSelectionText}>
                    {t('auth_files.batch_selected', { count: selectionCount })}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => selectAllVisible(pageItems)}
                    disabled={selectablePageItems.length === 0}
                  >
                    {t('auth_files.batch_select_page')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => selectAllVisible(sorted)}
                    disabled={selectableFilteredItems.length === 0}
                  >
                    {t('auth_files.batch_select_filtered')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => invertVisibleSelection(pageItems)}
                    disabled={selectablePageItems.length === 0}
                  >
                    {t('auth_files.batch_invert_page')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    {t('auth_files.batch_deselect')}
                  </Button>
                </div>
                <div className={styles.batchActionRight}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void batchDownload(selectedNames)}
                    disabled={disableControls || selectedNames.length === 0}
                  >
                    {t('auth_files.batch_download')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => batchSetStatus(selectedNames, true)}
                    disabled={batchStatusButtonsDisabled}
                  >
                    {t('auth_files.batch_enable')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => batchSetStatus(selectedNames, false)}
                    disabled={batchStatusButtonsDisabled}
                  >
                    {t('auth_files.batch_disable')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => batchDelete(selectedNames)}
                    disabled={disableControls || selectedNames.length === 0}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
