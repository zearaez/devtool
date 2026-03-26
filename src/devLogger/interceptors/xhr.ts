import { getConfig } from '../config';
import { addLog } from '../store';
import type { DevLoggerLog } from '../types';
import { nextLogId } from './shared';
import { trySerializeBody } from '../utils';

const PATCHED_KEY = '__ZEARA_DEVLOGGER_XHR_PATCHED__';
const META_KEY = '__ZEARA_DEVLOGGER_XHR_META__';

function parseHeaderString(
  headerString: string,
  maxHeaders: number
): Record<string, string> | undefined {
  if (!headerString) return undefined;
  const record: Record<string, string> = {};
  const lines = headerString.split(/\r?\n/).filter(Boolean);
  let i = 0;
  for (const line of lines) {
    if (i >= maxHeaders) break;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    record[key] = value;
    i += 1;
  }
  return Object.keys(record).length ? record : undefined;
}

export function patchXMLHttpRequest(): void {
  // Some environments might not have XHR.
  if (!(globalThis as any).XMLHttpRequest) return;
  const proto = (globalThis as any).XMLHttpRequest.prototype as XMLHttpRequest;
  if ((globalThis as any)[PATCHED_KEY]) return;

  const originalOpen = proto.open;
  const originalSend = proto.send;
  const originalSetRequestHeader = (proto as any).setRequestHeader as
    | ((header: string, value: string) => void)
    | undefined;

  (proto as any).open = function openDev(method: string, url: string): void {
    const anyThis = this as any;
    anyThis[META_KEY] = {
      method: typeof method === 'string' ? method.toUpperCase() : 'GET',
      url: String(url ?? ''),
      requestHeaders: {} as Record<string, string>,
    };

    originalOpen.apply(this, arguments as any);
  };

  if (originalSetRequestHeader) {
    (proto as any).setRequestHeader = function setRequestHeaderDev(
      header: string,
      value: string
    ) {
      const anyThis = this as any;
      const meta = anyThis[META_KEY] as
        | {
            method: string;
            url: string;
            requestHeaders: Record<string, string>;
          }
        | undefined;
      if (meta && header) {
        meta.requestHeaders[header] = String(value ?? '');
      }
      return originalSetRequestHeader.apply(this, arguments as any);
    };
  }

  (proto as any).send = function sendDev(body?: any) {
    const anyThis = this as any;
    const config = getConfig();
    const meta = (anyThis[META_KEY] ?? {
      method: 'GET',
      url: '',
      requestHeaders: {} as Record<string, string>,
    }) as {
      method: string;
      url: string;
      requestHeaders: Record<string, string>;
    };

    const startTime = Date.now();
    let errorName: string | undefined;
    let errorMessage: string | undefined;

    const onAbort = () => {
      errorName = 'AbortError';
      errorMessage = 'XMLHttpRequest aborted';
    };

    const onError = () => {
      errorName = 'XMLHttpRequestError';
      errorMessage = 'XMLHttpRequest network error';
    };

    const onLoadEnd = () => {
      const endTime = Date.now();

      let responseBody: string | undefined;
      if (config.captureResponseBody) {
        try {
          const text = String(anyThis.responseText ?? '');
          responseBody = text ? text : undefined;
        } catch {
          responseBody = undefined;
        }
      }

      const responseHeaders = config.captureResponseHeaders
        ? typeof anyThis.getAllResponseHeaders === 'function'
          ? parseHeaderString(
              anyThis.getAllResponseHeaders(),
              config.maxHeaders
            )
          : undefined
        : undefined;

      const status: number | undefined =
        typeof anyThis.status === 'number' ? anyThis.status : undefined;

      const log: DevLoggerLog = {
        id: nextLogId(),
        kind: 'xhr',
        request: {
          method: meta.method,
          url: meta.url,
          headers: config.captureRequestHeaders
            ? meta.requestHeaders
            : undefined,
          body: config.captureRequestBody
            ? trySerializeBody(body, config.maxBodyBytes)
            : undefined,
        },
        response: {
          status,
          headers: responseHeaders,
          body: responseBody ? responseBody : undefined,
        },
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime,
        },
      };

      if (errorName || typeof status !== 'number' || status === 0) {
        log.error = {
          name: errorName ?? 'XMLHttpRequestError',
          message: errorMessage ?? 'XMLHttpRequest failed',
        };
      }

      addLog(log);

      anyThis.removeEventListener('abort', onAbort);
      anyThis.removeEventListener('error', onError);
      anyThis.removeEventListener('loadend', onLoadEnd);
    };

    anyThis.addEventListener('abort', onAbort);
    anyThis.addEventListener('error', onError);
    anyThis.addEventListener('loadend', onLoadEnd);

    return originalSend.apply(this, arguments as any);
  };

  (globalThis as any)[PATCHED_KEY] = true;
}
