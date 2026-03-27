import type { HeaderRecord } from './types';

const REDACTED = '[REDACTED]';

function toLowerSet(values: string[]): Set<string> {
  return new Set(values.map((v) => v.toLowerCase()));
}

export function redactHeaders(
  headers: HeaderRecord | undefined,
  redactKeys: string[]
): HeaderRecord | undefined {
  if (!headers) return headers;
  const redact = toLowerSet(redactKeys);
  if (redact.size === 0) return headers;
  const out: HeaderRecord = {};
  for (const [k, v] of Object.entries(headers)) {
    if (redact.has(k.toLowerCase())) out[k] = REDACTED;
    else out[k] = v;
  }
  return out;
}

export function redactUrlQuery(url: string, redactParams: string[]): string {
  if (!url || redactParams.length === 0) return url;
  const redact = toLowerSet(redactParams);
  try {
    // URL() may not accept relative URLs; fall back to string replace.
    const u = new URL(url);
    for (const [k] of u.searchParams) {
      if (redact.has(k.toLowerCase())) {
        u.searchParams.set(k, REDACTED);
      }
    }
    return u.toString();
  } catch {
    // Fallback: best-effort query param redaction.
    const idx = url.indexOf('?');
    if (idx === -1) return url;
    const base = url.slice(0, idx);
    const query = url.slice(idx + 1);
    const parts = query.split('&').map((p) => {
      const [rawK] = p.split('=');
      const k = decodeURIComponent(rawK || '');
      if (redact.has(k.toLowerCase())) {
        return `${rawK}=${encodeURIComponent(REDACTED)}`;
      }
      return p;
    });
    return `${base}?${parts.join('&')}`;
  }
}

export function redactText(
  text: string | undefined,
  patterns: RegExp[]
): string | undefined {
  if (!text) return text;
  if (!patterns || patterns.length === 0) return text;
  let out = text;
  for (const p of patterns) {
    try {
      out = out.replace(p, REDACTED);
    } catch {
      // ignore bad regex
    }
  }
  return out;
}
