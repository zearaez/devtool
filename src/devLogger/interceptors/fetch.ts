import { getConfig } from '../config';
import { addLog } from '../store';
import {
  nextLogId,
  extractFetchBody,
  extractFetchHeaders,
  getFetchMethod,
  getFetchUrl,
} from './shared';
import type { DevLoggerLog } from '../types';
import { truncateByBytes } from '../utils';

const PATCHED_KEY = '__ZEARA_DEVLOGGER_FETCH_PATCHED__';

function headersToRecord(headers: Headers, maxHeaders: number) {
  const record: Record<string, string> = {};
  let i = 0;
  headers.forEach((value, key) => {
    if (i >= maxHeaders) return;
    record[key] = String(value ?? '');
    i += 1;
  });
  return Object.keys(record).length ? record : undefined;
}

export function patchFetch(): void {
  if (!(globalThis as any).fetch) return;
  if ((globalThis as any)[PATCHED_KEY]) return;

  const originalFetch = globalThis.fetch.bind(globalThis);

  async function devFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const config = getConfig();
    const startTime = Date.now();
    const durationStart = startTime;

    const method = getFetchMethod(input as RequestInfo, init);
    const url = getFetchUrl(input as RequestInfo);

    const requestHeaders = config.captureRequestHeaders
      ? extractFetchHeaders(input as RequestInfo, init, config.maxHeaders)
      : undefined;

    const requestBody = config.captureRequestBody
      ? extractFetchBody(init, config.maxBodyBytes)
      : undefined;

    try {
      const response = await originalFetch(input as any, init as any);
      const endTime = Date.now();

      const responseHeaders = config.captureResponseHeaders
        ? headersToRecord(response.headers, config.maxHeaders)
        : undefined;

      let responseBody: string | undefined;
      if (config.captureResponseBody) {
        try {
          // Clone so we don't consume the original response body.
          const text = await response.clone().text();
          responseBody = truncateByBytes(text, config.maxBodyBytes);
        } catch {
          responseBody = undefined;
        }
      }

      const log: DevLoggerLog = {
        id: nextLogId(),
        kind: 'fetch',
        request: { method, url, headers: requestHeaders, body: requestBody },
        response: {
          status: response.status,
          headers: responseHeaders,
          body: responseBody,
        },
        timing: {
          startTime: durationStart,
          endTime,
          durationMs: endTime - durationStart,
        },
      };

      addLog(log);
      return response;
    } catch (err) {
      const endTime = Date.now();
      const e = err as unknown as {
        name?: string;
        message?: string;
        stack?: string;
      };
      const log: DevLoggerLog = {
        id: nextLogId(),
        kind: 'fetch',
        request: { method, url, headers: requestHeaders, body: requestBody },
        timing: {
          startTime: durationStart,
          endTime,
          durationMs: endTime - durationStart,
        },
        error: {
          name: e?.name ? String(e.name) : 'FetchError',
          message: e?.message ? String(e.message) : String(err),
          stack: e?.stack ? String(e.stack) : undefined,
        },
      };
      addLog(log);
      throw err;
    }
  }

  (globalThis as any)[PATCHED_KEY] = true;

  globalThis.fetch = devFetch as any;
}
