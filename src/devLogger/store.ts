import { getConfig } from './config';
import type { DevLoggerLog, StoreListener } from './types';
import { normalizeHeaderRecord, truncateByBytes } from './utils';
import { redactHeaders, redactText, redactUrlQuery } from './sanitize';

const listeners = new Set<StoreListener>();

let maxLogs = getConfig().maxLogs;
let buffer: Array<DevLoggerLog | undefined> = new Array(maxLogs);
let cursor = 0;
let count = 0;
let version = 0;

function ensureCapacity(): void {
  const desiredMaxLogs = getConfig().maxLogs;
  if (desiredMaxLogs === maxLogs) return;

  // Rebuild while preserving as many latest entries as possible.
  const existing = getAllLogs();
  maxLogs = desiredMaxLogs;
  buffer = new Array(maxLogs);
  cursor = 0;
  count = 0;
  for (const entry of existing.slice(-maxLogs)) {
    addNormalized(entry, false);
  }
}

function notifyListeners(): void {
  version += 1;
  for (const l of listeners) l();
}

function addNormalized(log: DevLoggerLog, shouldNotify: boolean): void {
  ensureCapacity();

  const config = getConfig();

  const normalized: DevLoggerLog = {
    ...log,
    request: {
      ...log.request,
      url: redactUrlQuery(log.request.url, config.redactQueryParams),
      headers: config.captureRequestHeaders
        ? redactHeaders(
            normalizeHeaderRecord(log.request.headers, config.maxHeaders),
            config.redactHeaders
          )
        : undefined,
      body:
        config.captureRequestBody && typeof log.request.body === 'string'
          ? truncateByBytes(
              redactText(log.request.body, config.redactBodyPatterns) ??
                log.request.body,
              config.maxBodyBytes
            )
          : undefined,
    },
    response: log.response
      ? {
          status: log.response.status,
          headers: config.captureResponseHeaders
            ? redactHeaders(
                normalizeHeaderRecord(log.response.headers, config.maxHeaders),
                config.redactHeaders
              )
            : undefined,
          body:
            config.captureResponseBody && typeof log.response.body === 'string'
              ? truncateByBytes(
                  redactText(log.response.body, config.redactBodyPatterns) ??
                    log.response.body,
                  config.maxBodyBytes
                )
              : undefined,
        }
      : undefined,
    timing: { ...log.timing },
    error: log.error,
  };

  buffer[cursor] = normalized;
  cursor = (cursor + 1) % maxLogs;
  count = Math.min(count + 1, maxLogs);

  if (shouldNotify) notifyListeners();
}

export function addLog(log: DevLoggerLog): void {
  addNormalized(log, true);
}

export function getAllLogs(): DevLoggerLog[] {
  if (count <= 0) return [];
  const result: DevLoggerLog[] = [];
  const start = (cursor - count + maxLogs) % maxLogs;
  for (let i = 0; i < count; i++) {
    const idx = (start + i) % maxLogs;
    const entry = buffer[idx];
    if (entry) result.push(entry);
  }
  return result;
}

export function size(): number {
  return count;
}

export function getVersion(): number {
  return version;
}

export function clear(): void {
  buffer = new Array(maxLogs);
  cursor = 0;
  count = 0;
  notifyListeners();
}

export function subscribe(listener: StoreListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
