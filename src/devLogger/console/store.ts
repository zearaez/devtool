import { getConfig } from '../config';
import type { ConsoleLogEntry, ConsoleStoreListener } from './types';
import { truncateByBytes } from '../utils';
import { redactText } from '../sanitize';

const listeners = new Set<ConsoleStoreListener>();

let maxLogs = getConfig().maxLogs;
let buffer: Array<ConsoleLogEntry | undefined> = new Array(maxLogs);
let cursor = 0;
let count = 0;

function ensureCapacity(): void {
  const desiredMaxLogs = getConfig().maxLogs;
  if (desiredMaxLogs === maxLogs) return;

  const existing = getAllConsoleLogs();
  maxLogs = desiredMaxLogs;
  buffer = new Array(maxLogs);
  cursor = 0;
  count = 0;
  for (const entry of existing.slice(-maxLogs)) {
    addConsoleLog(entry, false);
  }
}

function notifyListeners(): void {
  for (const l of listeners) l();
}

export function addConsoleLog(
  entry: ConsoleLogEntry,
  shouldNotify = true
): void {
  ensureCapacity();
  const config = getConfig();

  const normalized: ConsoleLogEntry = {
    ...entry,
    message: truncateByBytes(
      redactText(entry.message, config.redactBodyPatterns) ?? entry.message,
      config.maxBodyBytes
    ),
    stack: entry.stack
      ? truncateByBytes(
          redactText(entry.stack, config.redactBodyPatterns) ?? entry.stack,
          config.maxBodyBytes
        )
      : undefined,
  };

  buffer[cursor] = normalized;
  cursor = (cursor + 1) % maxLogs;
  count = Math.min(count + 1, maxLogs);

  if (shouldNotify) notifyListeners();
}

export function getAllConsoleLogs(): ConsoleLogEntry[] {
  if (count <= 0) return [];
  const result: ConsoleLogEntry[] = [];
  const start = (cursor - count + maxLogs) % maxLogs;
  for (let i = 0; i < count; i++) {
    const idx = (start + i) % maxLogs;
    const entry = buffer[idx];
    if (entry) result.push(entry);
  }
  return result;
}

export function consoleSize(): number {
  return count;
}

export function clearConsole(): void {
  buffer = new Array(maxLogs);
  cursor = 0;
  count = 0;
  notifyListeners();
}

export function subscribeConsole(listener: ConsoleStoreListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
