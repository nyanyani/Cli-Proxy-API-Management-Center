/**
 * Generic API call helper (proxied via management API).
 */

import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './client';

export interface ApiCallRequest {
  authIndex?: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
}

export interface ApiCallResult<T = unknown> {
  statusCode: number;
  header: Record<string, string[]>;
  bodyText: string;
  body: T | null;
}

const normalizeBody = (input: unknown): { bodyText: string; body: unknown | null } => {
  if (input === undefined || input === null) {
    return { bodyText: '', body: null };
  }

  if (typeof input === 'string') {
    const text = input;
    const trimmed = text.trim();
    if (!trimmed) {
      return { bodyText: text, body: null };
    }
    try {
      return { bodyText: text, body: JSON.parse(trimmed) };
    } catch {
      return { bodyText: text, body: text };
    }
  }

  try {
    return { bodyText: JSON.stringify(input), body: input };
  } catch {
    return { bodyText: String(input), body: input };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDuration = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatUsageLimitReset = (errorValue: Record<string, unknown>): string => {
  const resetEpoch = readNumber(errorValue.resets_at);
  const resetInSeconds = readNumber(errorValue.resets_in_seconds);
  const resetDate = resetEpoch
    ? new Date(resetEpoch > 1_000_000_000_000 ? resetEpoch : resetEpoch * 1000)
    : null;
  const secondsUntilReset =
    resetInSeconds ??
    (resetDate ? Math.max(0, Math.round((resetDate.getTime() - Date.now()) / 1000)) : null);

  if (!resetDate && secondsUntilReset === null) return '';

  const parts: string[] = [];
  if (resetDate) parts.push(resetDate.toLocaleString());
  if (secondsUntilReset !== null) parts.push(`in ${formatDuration(secondsUntilReset)}`);
  return `Usage resets ${parts.join(' · ')}`;
};

export const getApiCallErrorMessage = (result: ApiCallResult): string => {
  const status = result.statusCode;
  const body = result.body;
  const bodyText = result.bodyText;
  let message = '';
  let usageLimitReset = '';

  if (isRecord(body)) {
    const errorValue = body.error;
    if (isRecord(errorValue) && typeof errorValue.message === 'string') {
      message = errorValue.message;
      if (errorValue.type === 'usage_limit_reached') {
        usageLimitReset = formatUsageLimitReset(errorValue);
      }
    } else if (typeof errorValue === 'string') {
      message = errorValue;
    }
    if (!message && typeof body.message === 'string') {
      message = body.message;
    }
  } else if (typeof body === 'string') {
    message = body;
  }

  if (!message && bodyText) {
    message = bodyText;
  }

  if (usageLimitReset) {
    message = message ? `${message} · ${usageLimitReset}` : usageLimitReset;
  }

  if (status && message) return `${status} ${message}`.trim();
  if (status) return `HTTP ${status}`;
  return message || 'Request failed';
};

export const apiCallApi = {
  request: async (
    payload: ApiCallRequest,
    config?: AxiosRequestConfig
  ): Promise<ApiCallResult> => {
    const response = await apiClient.post<Record<string, unknown>>('/api-call', payload, config);
    const statusCode = Number(response?.status_code ?? response?.statusCode ?? 0);
    const header = (response?.header ?? response?.headers ?? {}) as Record<string, string[]>;
    const { bodyText, body } = normalizeBody(response?.body);

    return {
      statusCode,
      header,
      bodyText,
      body
    };
  }
};
