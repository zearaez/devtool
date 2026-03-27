import { patchFetch } from './interceptors/fetch';
import { patchXMLHttpRequest } from './interceptors/xhr';
import { patchAxios } from './interceptors/axios';
import { patchConsole } from './console/intercept';
import { getConfig, setConfig } from './config';
import { addLog, clear, getAllLogs, subscribe } from './store';
import type { PartialDevLoggerConfig } from './types';
import { isDev } from './isDev';

const INIT_KEY = '__ZEARA_DEVLOGGER_INIT_DONE__';
const PERSIST_KEY = '__ZEARA_DEVLOGGER_PERSISTENCE_SETUP_DONE__';

function setupPersistence(): void {
  const config = getConfig();
  const persistence = config.persistence;
  if (!persistence) return;

  if ((globalThis as any)[PERSIST_KEY]) return;
  (globalThis as any)[PERSIST_KEY] = true;

  let timer: ReturnType<typeof setTimeout> | null = null;

  subscribe(() => {
    const current = getConfig();
    if (!current.persistence) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try {
        Promise.resolve(current.persistence!.save(getAllLogs())).catch(() => {
          // Ignore persistence errors in dev tooling.
        });
      } catch {
        // Ignore.
      }
    }, current.persistenceDebounceMs);
  });

  // Initial load.
  Promise.resolve(persistence.load())
    .then((logs) => {
      clear();
      for (const l of logs) addLog(l);
    })
    .catch(() => {
      // Ignore persistence errors in dev tooling.
    });
}

export function init(options?: PartialDevLoggerConfig): void {
  if (!isDev()) return;

  setConfig(options);

  // Patch interception layers (idempotent per interceptor file).
  const config = getConfig();
  if (config.interceptFetch) patchFetch();
  if (config.interceptXhr) patchXMLHttpRequest();
  if (config.interceptAxios && config.axios) patchAxios(config.axios);
  patchConsole();

  // Persistence setup is also idempotent.
  setupPersistence();

  (globalThis as any)[INIT_KEY] = true;
}

// Auto-init for dev builds on import.
if (isDev() && !(globalThis as any)[INIT_KEY]) {
  init();
}
