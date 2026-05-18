/**
 * Generic quota section component.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { triggerHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useNotificationStore, useQuotaStore, useThemeStore } from '@/stores';
import type { AuthFileItem, ResolvedTheme } from '@/types';
import { getStatusFromError } from '@/utils/quota';
import { QuotaCard } from './QuotaCard';
import type { QuotaStatusState } from './QuotaCard';
import { useQuotaLoader } from './useQuotaLoader';
import type { QuotaConfig } from './quotaConfigs';
import { useGridColumns } from './useGridColumns';
import { IconRefreshCw } from '@/components/ui/icons';
import styles from '@/pages/QuotaPage.module.scss';

type QuotaUpdater<T> = T | ((prev: T) => T);

type QuotaSetter<T> = (updater: QuotaUpdater<T>) => void;

type ViewMode = 'paged' | 'all';

const MAX_SHOW_ALL_THRESHOLD = 30;
const MIN_ITEMS_PER_PAGE = 1;

interface QuotaPaginationState<T> {
  pageSize: number;
  totalPages: number;
  currentPage: number;
  pageItems: T[];
  setPageSize: (size: number) => void;
  setPage: (page: number) => void;
  goToPrev: () => void;
  goToNext: () => void;
  loading: boolean;
  loadingScope: 'page' | 'all' | null;
  setLoading: (loading: boolean, scope?: 'page' | 'all' | null) => void;
}

const useQuotaPagination = <T,>(
  items: T[],
  defaultPageSize = MAX_SHOW_ALL_THRESHOLD
): QuotaPaginationState<T> => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [loading, setLoadingState] = useState(false);
  const [loadingScope, setLoadingScope] = useState<'page' | 'all' | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize]
  );

  const currentPage = useMemo(() => Math.min(page, totalPages), [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(Math.max(MIN_ITEMS_PER_PAGE, Math.round(size)));
    setPage(1);
  }, []);

  const setSafePage = useCallback(
    (nextPage: number) => {
      setPage(Math.min(totalPages, Math.max(1, Math.round(nextPage))));
    },
    [totalPages]
  );

  const goToPrev = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const setLoading = useCallback((isLoading: boolean, scope?: 'page' | 'all' | null) => {
    setLoadingState(isLoading);
    setLoadingScope(isLoading ? (scope ?? null) : null);
  }, []);

  return {
    pageSize,
    totalPages,
    currentPage,
    pageItems,
    setPageSize,
    setPage: setSafePage,
    goToPrev,
    goToNext,
    loading,
    loadingScope,
    setLoading,
  };
};

interface QuotaSectionProps<TState extends QuotaStatusState, TData> {
  config: QuotaConfig<TState, TData>;
  files: AuthFileItem[];
  loading: boolean;
  disabled: boolean;
}

export function QuotaSection<TState extends QuotaStatusState, TData>({
  config,
  files,
  loading,
  disabled,
}: QuotaSectionProps<TState, TData>) {
  const { t } = useTranslation();
  const resolvedTheme: ResolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const setQuota = useQuotaStore((state) => state[config.storeSetter]) as QuotaSetter<
    Record<string, TState>
  >;

  /* Removed useRef */
  const [, gridRef] = useGridColumns(380); // Min card width 380px matches SCSS
  const [viewMode, setViewMode] = useState<ViewMode>('paged');
  const [showTooManyWarning, setShowTooManyWarning] = useState(false);
  const [pageInput, setPageInput] = useState('1');
  const [pageSizeInput, setPageSizeInput] = useState(String(MAX_SHOW_ALL_THRESHOLD));

  const filteredFiles = useMemo(
    () => files.filter((file) => config.filterFn(file)),
    [files, config]
  );
  const showAllAllowed = filteredFiles.length <= MAX_SHOW_ALL_THRESHOLD;
  const effectiveViewMode: ViewMode = viewMode === 'all' && !showAllAllowed ? 'paged' : viewMode;

  const {
    pageSize,
    totalPages,
    currentPage,
    pageItems,
    setPageSize,
    setPage,
    goToPrev,
    goToNext,
    loading: sectionLoading,
    setLoading,
  } = useQuotaPagination(filteredFiles);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    if (showAllAllowed) return;
    if (viewMode !== 'all') return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setViewMode('paged');
      setShowTooManyWarning(true);
    });

    return () => {
      cancelled = true;
    };
  }, [showAllAllowed, viewMode]);

  // Update page size based on view mode and columns
  useEffect(() => {
    if (effectiveViewMode === 'all') {
      setPageSize(Math.max(1, filteredFiles.length));
    } else {
      // Paged mode defaults to the same safe threshold used by Show All.
      setPageSize(MAX_SHOW_ALL_THRESHOLD);
    }
  }, [effectiveViewMode, filteredFiles.length, setPageSize]);

  const commitPageInput = (rawValue: string) => {
    const value = Number(rawValue.trim());
    if (!Number.isFinite(value)) {
      setPageInput(String(currentPage));
      return;
    }
    setPage(value);
  };

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    setPageInput(rawValue);
    const value = Number(rawValue.trim());
    if (!Number.isFinite(value) || value < 1 || value > totalPages) return;
    setPage(value);
  };

  const commitPageSizeInput = (rawValue: string) => {
    const value = Number(rawValue.trim());
    if (!Number.isFinite(value)) {
      setPageSizeInput(String(pageSize));
      return;
    }
    setPageSize(value);
  };

  const handlePageSizeInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    setPageSizeInput(rawValue);
    const value = Number(rawValue.trim());
    if (!Number.isFinite(value) || value < MIN_ITEMS_PER_PAGE) return;
    setPageSize(value);
  };

  const { quota, loadQuota } = useQuotaLoader(config);

  const pendingQuotaRefreshRef = useRef(false);
  const prevFilesLoadingRef = useRef(loading);

  const handleRefresh = useCallback(() => {
    pendingQuotaRefreshRef.current = true;
    void triggerHeaderRefresh();
  }, []);

  useEffect(() => {
    const wasLoading = prevFilesLoadingRef.current;
    prevFilesLoadingRef.current = loading;

    if (!pendingQuotaRefreshRef.current) return;
    if (loading) return;
    if (!wasLoading) return;

    pendingQuotaRefreshRef.current = false;
    const scope = effectiveViewMode === 'all' ? 'all' : 'page';
    const targets = effectiveViewMode === 'all' ? filteredFiles : pageItems;
    if (targets.length === 0) return;
    loadQuota(targets, scope, setLoading);
  }, [loading, effectiveViewMode, filteredFiles, pageItems, loadQuota, setLoading]);

  useEffect(() => {
    if (loading) return;
    if (filteredFiles.length === 0) {
      setQuota({});
      return;
    }
    setQuota((prev) => {
      const nextState: Record<string, TState> = {};
      filteredFiles.forEach((file) => {
        const cached = prev[file.name];
        if (cached) {
          nextState[file.name] = cached;
        }
      });
      return nextState;
    });
  }, [filteredFiles, loading, setQuota]);

  const refreshQuotaForFile = useCallback(
    async (file: AuthFileItem) => {
      if (disabled || file.disabled) return;
      if (quota[file.name]?.status === 'loading') return;

      setQuota((prev) => ({
        ...prev,
        [file.name]: config.buildLoadingState(),
      }));

      try {
        const data = await config.fetchQuota(file, t);
        setQuota((prev) => ({
          ...prev,
          [file.name]: config.buildSuccessState(data),
        }));
        showNotification(t('auth_files.quota_refresh_success', { name: file.name }), 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('common.unknown_error');
        const status = getStatusFromError(err);
        setQuota((prev) => ({
          ...prev,
          [file.name]: config.buildErrorState(message, status),
        }));
        showNotification(
          t('auth_files.quota_refresh_failed', { name: file.name, message }),
          'error'
        );
      }
    },
    [config, disabled, quota, setQuota, showNotification, t]
  );

  const titleNode = (
    <div className={styles.titleWrapper}>
      <span>{t(`${config.i18nPrefix}.title`)}</span>
      {filteredFiles.length > 0 && (
        <span className={styles.countBadge}>{filteredFiles.length}</span>
      )}
    </div>
  );

  const isRefreshing = sectionLoading || loading;
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(filteredFiles.length, start + pageSize);

  return (
    <Card
      title={titleNode}
      extra={
        <div className={styles.headerActions}>
          <div className={styles.viewModeToggle}>
            <Button
              variant="secondary"
              size="sm"
              className={`${styles.viewModeButton} ${
                effectiveViewMode === 'paged' ? styles.viewModeButtonActive : ''
              }`}
              onClick={() => setViewMode('paged')}
            >
              {t('auth_files.view_mode_paged')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className={`${styles.viewModeButton} ${
                effectiveViewMode === 'all' ? styles.viewModeButtonActive : ''
              }`}
              onClick={() => {
                if (filteredFiles.length > MAX_SHOW_ALL_THRESHOLD) {
                  setShowTooManyWarning(true);
                } else {
                  setViewMode('all');
                }
              }}
            >
              {t('auth_files.view_mode_all')}
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className={styles.refreshAllButton}
            onClick={handleRefresh}
            disabled={disabled || isRefreshing}
            loading={isRefreshing}
            title={t('quota_management.refresh_all_credentials')}
            aria-label={t('quota_management.refresh_all_credentials')}
          >
            {!isRefreshing && <IconRefreshCw size={16} />}
            {t('quota_management.refresh_all_credentials')}
          </Button>
        </div>
      }
    >
      {filteredFiles.length === 0 ? (
        <EmptyState
          title={t(`${config.i18nPrefix}.empty_title`)}
          description={t(`${config.i18nPrefix}.empty_desc`)}
        />
      ) : (
        <>
          <div ref={gridRef} className={config.gridClassName}>
            {pageItems.map((item) => (
              <QuotaCard
                key={item.name}
                item={item}
                quota={quota[item.name]}
                resolvedTheme={resolvedTheme}
                i18nPrefix={config.i18nPrefix}
                cardIdleMessageKey={config.cardIdleMessageKey}
                cardClassName={config.cardClassName}
                defaultType={config.type}
                canRefresh={!disabled && !item.disabled}
                onRefresh={() => void refreshQuotaForFile(item)}
                renderQuotaItems={config.renderQuotaItems}
              />
            ))}
          </div>
          {effectiveViewMode === 'paged' && filteredFiles.length > 0 && (
            <div className={styles.pagination}>
              <Button variant="secondary" size="sm" onClick={goToPrev} disabled={currentPage <= 1}>
                {t('auth_files.pagination_prev')}
              </Button>
              <div className={styles.pageInfo}>
                {t('auth_files.pagination_range_info', {
                  current: currentPage,
                  total: totalPages,
                  count: filteredFiles.length,
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
              <label className={styles.paginationField}>
                <span>{t('auth_files.pagination_page_size_label')}</span>
                <input
                  className={styles.paginationInput}
                  type="number"
                  min={MIN_ITEMS_PER_PAGE}
                  step={1}
                  value={pageSizeInput}
                  onChange={handlePageSizeInputChange}
                  onBlur={(e) => commitPageSizeInput(e.currentTarget.value)}
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
                onClick={goToNext}
                disabled={currentPage >= totalPages}
              >
                {t('auth_files.pagination_next')}
              </Button>
            </div>
          )}
        </>
      )}
      {showTooManyWarning && (
        <div className={styles.warningOverlay} onClick={() => setShowTooManyWarning(false)}>
          <div className={styles.warningModal} onClick={(e) => e.stopPropagation()}>
            <p>{t('auth_files.too_many_files_warning')}</p>
            <Button variant="primary" size="sm" onClick={() => setShowTooManyWarning(false)}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
