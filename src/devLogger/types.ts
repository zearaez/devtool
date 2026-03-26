export type NetworkKind = 'fetch' | 'xhr' | 'axios';

export type HeaderRecord = Record<string, string>;

export interface DevLoggerTiming {
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

export interface DevLoggerErrorInfo {
  name?: string;
  message?: string;
  stack?: string;
}

export interface DevLoggerRequestInfo {
  method: string;
  url: string;
  headers?: HeaderRecord;
  body?: string;
}

export interface DevLoggerResponseInfo {
  status?: number;
  headers?: HeaderRecord;
  body?: string;
}

export interface DevLoggerLog {
  id: string;
  kind: NetworkKind;
  request: DevLoggerRequestInfo;
  response?: DevLoggerResponseInfo;
  timing: DevLoggerTiming;
  error?: DevLoggerErrorInfo;
}

export type Unsubscribe = () => void;
export type StoreListener = () => void;

export interface StorageAdapter {
  /**
   * Load previously persisted logs (oldest -> newest).
   */
  load: () => Promise<DevLoggerLog[]> | DevLoggerLog[];
  /**
   * Persist logs (oldest -> newest).
   */
  save: (logs: DevLoggerLog[]) => Promise<void> | void;
  /**
   * Clear persisted state.
   */
  clear?: () => Promise<void> | void;
}

export interface DevLoggerConfig {
  maxLogs: number;
  maxBodyBytes: number;
  maxHeaders: number;

  interceptFetch: boolean;
  interceptXhr: boolean;
  interceptAxios: boolean;
  /**
   * If provided and `interceptAxios` is true, we will patch this axios instance's
   * request/response interceptors.
   */
  axios?: unknown;

  captureRequestHeaders: boolean;
  captureResponseHeaders: boolean;
  captureRequestBody: boolean;
  captureResponseBody: boolean;

  /**
   * If a body can't be parsed/decoded safely, it will still be stored as a string
   * (possibly with placeholders), but formatting should be conservative.
   */
  safeBodyToString: boolean;

  /**
   * Optional persistence (dev-only). If omitted, everything stays in-memory.
   */
  persistence?: StorageAdapter;
  persistenceDebounceMs: number;
}

export type PartialDevLoggerConfig = Partial<DevLoggerConfig>;
