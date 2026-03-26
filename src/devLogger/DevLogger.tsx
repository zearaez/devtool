import type { DevLoggerConfig, PartialDevLoggerConfig } from './types';
import { init } from './init';
import { clear, getAllLogs, size } from './store';
import DevLoggerUI from './UI';

export type DevLoggerAPI = {
  init: (options?: PartialDevLoggerConfig) => void;
  clear: () => void;
  getLogs: () => ReturnType<typeof getAllLogs>;
  size: () => number;
  UI: typeof DevLoggerUI;
  // Expose types so consumers can import from package.
  _configType?: DevLoggerConfig;
};

export const DevLogger: DevLoggerAPI = {
  init,
  clear,
  getLogs: () => getAllLogs(),
  size: () => size(),
  UI: DevLoggerUI,
};

// Back-compat convenience export.
export { DevLoggerUI };
