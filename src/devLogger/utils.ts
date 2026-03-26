import type { HeaderRecord } from './types';

export function truncateStringMiddle(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  if (maxChars <= 10) return input.slice(0, maxChars);
  const keepStart = Math.max(0, Math.floor(maxChars * 0.7));
  const keepEnd = maxChars - keepStart;
  return `${input.slice(0, keepStart)}\n...[truncated]...\n${input.slice(
    Math.max(0, input.length - keepEnd)
  )}`;
}

export function estimateUtf8Bytes(input: string): number {
  try {
    // Hermes supports TextEncoder in modern RN versions.

    const te = new (globalThis as any).TextEncoder();
    return te.encode(input).length;
  } catch {
    return input.length;
  }
}

export function truncateByBytes(input: string, maxBytes: number): string {
  if (estimateUtf8Bytes(input) <= maxBytes) return input;
  // Conservative approach: approximate using chars, then re-check.
  const approxMaxChars = Math.max(
    0,
    Math.floor(
      (maxBytes / Math.max(1, estimateUtf8Bytes(input))) * input.length
    )
  );
  return truncateStringMiddle(input, Math.max(0, approxMaxChars));
}

export function normalizeHeaderRecord(
  headers?: unknown,
  maxHeaders = 50
): HeaderRecord | undefined {
  if (!headers) return undefined;

  // Headers instance

  const anyHeaders = headers as any;
  if (typeof anyHeaders?.forEach === 'function') {
    const record: HeaderRecord = {};
    let i = 0;
    anyHeaders.forEach((value: unknown, key: string) => {
      if (i >= maxHeaders) return;
      record[String(key)] = String(value ?? '');
      i += 1;
    });
    return Object.keys(record).length ? record : undefined;
  }

  // Array of tuples: [ [key,value], ...]
  if (Array.isArray(headers)) {
    const record: HeaderRecord = {};
    let i = 0;
    for (const entry of headers) {
      if (i >= maxHeaders) break;
      if (Array.isArray(entry) && entry.length >= 2) {
        record[String(entry[0])] = String(entry[1] ?? '');
        i += 1;
      }
    }
    return Object.keys(record).length ? record : undefined;
  }

  // Plain object
  if (typeof headers === 'object') {
    const record: HeaderRecord = {};
    let i = 0;
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (i >= maxHeaders) break;
      record[k] = String(v ?? '');
      i += 1;
    }
    return Object.keys(record).length ? record : undefined;
  }

  return undefined;
}

export function trySerializeBody(
  body: unknown,
  maxBytes: number
): string | undefined {
  if (body === undefined || body === null) return undefined;

  if (typeof body === 'string') {
    return truncateByBytes(body, maxBytes);
  }

  // URLSearchParams
  if (
    typeof body === 'object' &&
    typeof (body as URLSearchParams & { toString?: unknown }).toString ===
      'function'
  ) {
    const maybeString = String(body);
    if (maybeString && maybeString !== '[object Object]') {
      return truncateByBytes(maybeString, maxBytes);
    }
  }

  // ArrayBuffer / TypedArray
  if (typeof body === 'object' && body instanceof ArrayBuffer) {
    return '[ArrayBuffer]';
  }

  if (typeof body === 'object' && ArrayBuffer.isView(body)) {
    return `[${
      (body as { constructor?: { name?: string } }).constructor?.name ??
      'TypedArray'
    }]`;
  }

  // FormData

  const anyBody = body as any;

  const FormDataCtor = (globalThis as any).FormData as
    | undefined
    | (new (...args: any[]) => unknown);
  if (FormDataCtor && anyBody instanceof FormDataCtor) {
    return '[FormData (not serialized)]';
  }

  // Plain object -> JSON
  if (typeof body === 'object') {
    try {
      const json = JSON.stringify(body);
      if (json && json !== '{}' && json !== 'null') {
        return truncateByBytes(json, maxBytes);
      }
      return truncateByBytes(String(body), maxBytes);
    } catch {
      return truncateByBytes(String(body), maxBytes);
    }
  }

  // Fallback (numbers, booleans, etc.)
  return truncateByBytes(String(body), maxBytes);
}
