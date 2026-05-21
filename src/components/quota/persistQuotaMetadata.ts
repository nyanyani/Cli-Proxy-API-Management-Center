import type { TFunction } from 'i18next';
import { authFilesApi } from '@/services/api';
import type { AuthFileFieldsPatch } from '@/services/api';
import type { AuthFileItem } from '@/types';
import { getStatusFromError, isFreePlanType } from '@/utils/quota';
import type { QuotaConfig } from './quotaConfigs';

const AUTH_FILE_PROBE_QUOTA_KEY = 'probe_quota';

export type PersistQuotaFailure = {
  file: AuthFileItem;
  message: string;
  status?: number;
};

type SuccessfulQuotaTarget = {
  file: AuthFileItem;
  config: QuotaConfig<unknown, unknown>;
  quotaState: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readStringFromRecord = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const readNumberFromRecord = (record: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
};

export const buildPersistentProbeQuotaMetadata = (
  config: QuotaConfig<unknown, unknown>,
  quotaState: unknown,
  checkedAt: number
): Record<string, unknown> | null => {
  const quotaRecord = asRecord(quotaState);
  if (!quotaRecord || quotaRecord.status !== 'success') return null;

  const payload = Object.entries(quotaRecord).reduce<Record<string, unknown>>(
    (next, [key, value]) => {
      if (key === 'status' || key === 'error' || key === 'errorStatus') return next;
      if (value === undefined) return next;
      next[key] = value;
      return next;
    },
    {}
  );

  const metadata: Record<string, unknown> = {
    provider: config.type,
    checked_at: new Date(checkedAt).toISOString(),
    data: payload,
  };

  const planType = readStringFromRecord(quotaRecord, ['planType', 'plan_type', 'plan']);
  if (planType) {
    metadata.plan_type = planType;
  }

  const tierId = readStringFromRecord(quotaRecord, ['tierId', 'tier_id']);
  if (tierId) {
    metadata.tier_id = tierId;
  }

  const tierLabel = readStringFromRecord(quotaRecord, ['tierLabel', 'tier_label']);
  if (tierLabel) {
    metadata.tier_label = tierLabel;
  }

  const creditBalance = readNumberFromRecord(quotaRecord, ['creditBalance', 'credit_balance']);
  if (creditBalance !== null) {
    metadata.credit_balance = creditBalance;
  }

  return metadata;
};

const buildPersistentProbeQuotaFields = (
  metadata: Record<string, unknown>
): AuthFileFieldsPatch => {
  const fields: AuthFileFieldsPatch = {
    [AUTH_FILE_PROBE_QUOTA_KEY]: metadata,
  };

  if (typeof metadata.plan_type === 'string') {
    fields.plan_type = metadata.plan_type;
  }
  if (typeof metadata.tier_id === 'string') {
    fields.tier_id = metadata.tier_id;
  }
  if (typeof metadata.tier_label === 'string') {
    fields.tier_label = metadata.tier_label;
  }
  if (typeof metadata.credit_balance === 'number') {
    fields.credit_balance = metadata.credit_balance;
  }

  return fields;
};

const isUnsupportedProbeQuotaPatchError = (err: unknown): boolean => {
  if (getStatusFromError(err) !== 400 || !(err instanceof Error)) return false;
  return err.message.trim().toLowerCase() === 'no fields to update';
};

const isFreePlanMetadata = (metadata: Record<string, unknown>): boolean =>
  isFreePlanType(metadata.plan_type);

const saveProbeQuotaMetadataToAuthFile = async (
  name: string,
  fields: AuthFileFieldsPatch
): Promise<void> => {
  const authFileJson = await authFilesApi.downloadJsonObject(name);
  await authFilesApi.saveJsonObject(name, { ...authFileJson, ...fields });
};

export const persistQuotaMetadataForFile = async (
  file: AuthFileItem,
  config: QuotaConfig<unknown, unknown>,
  quotaState: unknown,
  checkedAt: number = Date.now()
): Promise<void> => {
  const metadata = buildPersistentProbeQuotaMetadata(config, quotaState, checkedAt);
  if (!metadata) return;

  const fields = buildPersistentProbeQuotaFields(metadata);
  const isFreePlan = isFreePlanMetadata(metadata);

  if (isFreePlan) {
    await saveProbeQuotaMetadataToAuthFile(file.name, fields);

    if (file.disabled !== true) {
      await authFilesApi.setStatus(file.name, true);
    }

    return;
  }

  try {
    await authFilesApi.patchFields(file.name, fields);
  } catch (err: unknown) {
    if (!isUnsupportedProbeQuotaPatchError(err)) {
      throw err;
    }
    await saveProbeQuotaMetadataToAuthFile(file.name, fields);
  }
};

export const persistQuotaMetadataForTargets = async (
  targets: SuccessfulQuotaTarget[],
  runLimited: <T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
    shouldContinue?: () => boolean
  ) => Promise<void>,
  options: {
    concurrency: number;
    shouldContinue?: () => boolean;
    unknownErrorMessage?: string;
  }
): Promise<PersistQuotaFailure[]> => {
  const failures: PersistQuotaFailure[] = [];
  const checkedAt = Date.now();
  const shouldContinue = options.shouldContinue ?? (() => true);

  await runLimited(
    targets,
    options.concurrency,
    async ({ file, config, quotaState }) => {
      if (!shouldContinue()) return;

      try {
        await persistQuotaMetadataForFile(file, config, quotaState, checkedAt);
      } catch (err: unknown) {
        failures.push({
          file,
          message:
            err instanceof Error
              ? err.message
              : (options.unknownErrorMessage ?? 'Failed to persist quota metadata'),
          status: getStatusFromError(err),
        });
      }
    },
    shouldContinue
  );

  return failures;
};

export const toPersistQuotaFailure = (
  file: AuthFileItem,
  err: unknown,
  t: TFunction
): PersistQuotaFailure => ({
  file,
  message: err instanceof Error ? err.message : t('common.unknown_error'),
  status: getStatusFromError(err),
});
