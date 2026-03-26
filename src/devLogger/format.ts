import type { HeaderRecord } from './types';
import { truncateByBytes } from './utils';

export function safeJsonPretty(
  input: string,
  maxChars: number
): { ok: boolean; text: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, text: input };
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return { ok: false, text: input };
  }
  try {
    const parsed = JSON.parse(trimmed);
    const text = JSON.stringify(parsed, null, 2);
    return { ok: true, text: truncateByBytes(text, maxChars) };
  } catch {
    return { ok: false, text: input };
  }
}

export function formatHeaders(headers?: HeaderRecord): string {
  if (!headers || Object.keys(headers).length === 0) return '';
  const lines: string[] = [];
  for (const [k, v] of Object.entries(headers)) {
    lines.push(`${k}: ${v}`);
  }
  return lines.join('\n');
}

export function formatTiming(durationMs?: number): string {
  if (typeof durationMs !== 'number') return '';
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}
