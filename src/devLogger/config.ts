import type { DevLoggerConfig, PartialDevLoggerConfig } from './types';

const defaultConfig: DevLoggerConfig = {
  maxLogs: 200,
  maxBodyBytes: 20_000,
  maxHeaders: 50,

  interceptFetch: true,
  interceptXhr: true,
  interceptAxios: false,
  axios: undefined,

  captureRequestHeaders: true,
  captureResponseHeaders: true,
  captureRequestBody: true,
  captureResponseBody: true,

  safeBodyToString: true,

  persistenceDebounceMs: 500,
};

let currentConfig: DevLoggerConfig = { ...defaultConfig };

export function getConfig(): DevLoggerConfig {
  return currentConfig;
}

export function setConfig(next?: PartialDevLoggerConfig): DevLoggerConfig {
  if (!next) return currentConfig;
  currentConfig = { ...currentConfig, ...next };
  return currentConfig;
}

export function resetConfigToDefaults(): void {
  currentConfig = { ...defaultConfig };
}

export function getDefaultConfig(): DevLoggerConfig {
  return { ...defaultConfig };
}
