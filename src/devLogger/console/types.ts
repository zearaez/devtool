export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export type ConsoleLogEntry = {
  id: string;
  level: ConsoleLevel;
  time: number;
  timeText?: string;
  message: string;
  stack?: string;
};

export type ConsoleStoreListener = () => void;
