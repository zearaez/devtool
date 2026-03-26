import { normalizeHeaderRecord, trySerializeBody } from '../utils';
import type { HeaderRecord } from '../types';

let seq = 0;

export function nextLogId(): string {
  seq += 1;
  return `devlogger_${Date.now()}_${seq}`;
}

export function getFetchUrl(input: RequestInfo): string {
  if (typeof input === 'string') return input;
  // RN Request is usually available as global Request, so input can be a Request-like object.

  const anyInput = input as any;
  return typeof anyInput?.url === 'string' ? anyInput.url : String(input);
}

export function getFetchMethod(input: RequestInfo, init?: RequestInit): string {
  const initMethod = init?.method;
  if (typeof initMethod === 'string') return initMethod.toUpperCase();
  if (typeof input !== 'string') {
    const anyInput = input as any;
    const m = anyInput?.method;
    if (typeof m === 'string') return m.toUpperCase();
  }
  return 'GET';
}

export function extractFetchHeaders(
  input: RequestInfo,
  init?: RequestInit,
  maxHeaders = 50
): HeaderRecord | undefined {
  const base: HeaderRecord | undefined =
    typeof input !== 'string'
      ? normalizeHeaderRecord((input as unknown as Request).headers, maxHeaders)
      : undefined;

  const initHeaders = init?.headers
    ? normalizeHeaderRecord(init.headers, maxHeaders)
    : undefined;
  if (!base && !initHeaders) return undefined;
  return { ...(base ?? {}), ...(initHeaders ?? {}) };
}

export function extractFetchBody(
  init?: RequestInit,
  maxBodyBytes = 20_000
): string | undefined {
  if (!init) return undefined;
  return trySerializeBody(init.body, maxBodyBytes);
}
