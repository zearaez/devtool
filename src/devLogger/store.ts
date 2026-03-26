import { getConfig } from './config';
import type { DevLoggerLog, StoreListener } from './types';
import { normalizeHeaderRecord, truncateByBytes } from './utils';

const listeners = new Set<StoreListener>();

let maxLogs = getConfig().maxLogs;
let buffer: Array<DevLoggerLog | undefined> = new Array(maxLogs);
let cursor = 0;
let count = 0;

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
  for (const l of listeners) l();
}

function addNormalized(log: DevLoggerLog, shouldNotify: boolean): void {
  ensureCapacity();

  const config = getConfig();

  const normalized: DevLoggerLog = {
    ...log,
    request: {
      ...log.request,
      headers: config.captureRequestHeaders
        ? normalizeHeaderRecord(log.request.headers, config.maxHeaders)
        : undefined,
      body:
        config.captureRequestBody && typeof log.request.body === 'string'
          ? truncateByBytes(log.request.body, config.maxBodyBytes)
          : undefined,
    },
    response: log.response
      ? {
          status: log.response.status,
          headers: config.captureResponseHeaders
            ? normalizeHeaderRecord(log.response.headers, config.maxHeaders)
            : undefined,
          body:
            config.captureResponseBody && typeof log.response.body === 'string'
              ? truncateByBytes(log.response.body, config.maxBodyBytes)
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
