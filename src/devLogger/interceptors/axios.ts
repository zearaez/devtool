import { getConfig } from '../config';
import { addLog } from '../store';
import type { DevLoggerLog } from '../types';
import { nextLogId } from './shared';
import { trySerializeBody } from '../utils';

const PATCHED_KEY = '__ZEARA_DEVLOGGER_AXIOS_PATCHED__';
const META_KEY = '__ZEARA_DEVLOGGER_AXIOS_META__';

function toStringHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record: Record<string, string> = {};

  const headers = value as any;
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      // axios nested headers shape: { common: {}, get: {}, post: {} }
      for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) {
        record[kk] = String(vv ?? '');
      }
    } else {
      record[k] = String(v ?? '');
    }
  }
  return Object.keys(record).length ? record : undefined;
}

function getAxiosUrl(config: any): string {
  const baseURL = typeof config?.baseURL === 'string' ? config.baseURL : '';
  const url = typeof config?.url === 'string' ? config.url : '';
  return `${baseURL}${url}` || String(url || config?.url || '');
}

export function patchAxios(axiosInstance: unknown): void {
  if (!axiosInstance) return;

  const anyAxios = axiosInstance as any;
  if (
    !anyAxios?.interceptors?.request?.use ||
    !anyAxios?.interceptors?.response?.use
  )
    return;
  if (anyAxios[PATCHED_KEY]) return;

  anyAxios[PATCHED_KEY] = true;

  anyAxios.interceptors.request.use(
    (requestConfig: any) => {
      const config = getConfig();
      const startTime = Date.now();

      requestConfig[META_KEY] = {
        startTime,
        method: String(requestConfig?.method ?? 'GET').toUpperCase(),
        url: getAxiosUrl(requestConfig),
        requestHeaders: config.captureRequestHeaders
          ? toStringHeaders(requestConfig?.headers)
          : undefined,
        requestBody: config.captureRequestBody
          ? trySerializeBody(requestConfig?.data, config.maxBodyBytes)
          : undefined,
      };

      return requestConfig;
    },
    (error: any) => Promise.reject(error)
  );

  anyAxios.interceptors.response.use(
    (response: any) => {
      const config = getConfig();
      const reqMeta = response?.config?.[META_KEY] as
        | {
            startTime: number;
            method: string;
            url: string;
            requestHeaders?: Record<string, string>;
            requestBody?: string;
          }
        | undefined;

      const endTime = Date.now();
      const startTime = reqMeta?.startTime ?? endTime;

      let responseBody: string | undefined;
      if (config.captureResponseBody) {
        responseBody = trySerializeBody(response?.data, config.maxBodyBytes);
      }

      const log: DevLoggerLog = {
        id: nextLogId(),
        kind: 'axios',
        request: {
          method:
            reqMeta?.method ??
            String(response?.config?.method ?? 'GET').toUpperCase(),
          url: reqMeta?.url ?? getAxiosUrl(response?.config ?? {}),
          headers: reqMeta?.requestHeaders,
          body: reqMeta?.requestBody,
        },
        response: {
          status:
            typeof response?.status === 'number' ? response.status : undefined,
          headers: config.captureResponseHeaders
            ? toStringHeaders(response?.headers)
            : undefined,
          body: responseBody,
        },
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime,
        },
      };

      addLog(log);
      return response;
    },
    (error: any) => {
      const config = getConfig();
      const endTime = Date.now();
      const reqMeta = error?.config?.[META_KEY] as
        | {
            startTime: number;
            method: string;
            url: string;
            requestHeaders?: Record<string, string>;
            requestBody?: string;
          }
        | undefined;
      const startTime = reqMeta?.startTime ?? endTime;

      const response = error?.response;
      let responseBody: string | undefined;
      if (config.captureResponseBody && response) {
        responseBody = trySerializeBody(response?.data, config.maxBodyBytes);
      }

      const log: DevLoggerLog = {
        id: nextLogId(),
        kind: 'axios',
        request: {
          method:
            reqMeta?.method ??
            String(error?.config?.method ?? 'GET').toUpperCase(),
          url: reqMeta?.url ?? getAxiosUrl(error?.config ?? {}),
          headers: reqMeta?.requestHeaders,
          body: reqMeta?.requestBody,
        },
        response: response
          ? {
              status:
                typeof response?.status === 'number'
                  ? response.status
                  : undefined,
              headers: config.captureResponseHeaders
                ? toStringHeaders(response?.headers)
                : undefined,
              body: responseBody,
            }
          : undefined,
        timing: {
          startTime,
          endTime,
          durationMs: endTime - startTime,
        },
        error: {
          name: error?.name ? String(error.name) : 'AxiosError',
          message: error?.message ? String(error.message) : String(error),
          stack: error?.stack ? String(error.stack) : undefined,
        },
      };

      addLog(log);
      return Promise.reject(error);
    }
  );
}
