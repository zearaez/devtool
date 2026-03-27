import { addConsoleLog } from './store';
import type { ConsoleLevel } from './types';

const PATCHED_KEY = '__ZEARA_DEVLOGGER_CONSOLE_PATCHED__';
const META_KEY = '__ZEARA_DEVLOGGER_CONSOLE_ORIGINALS__';

let seq = 0;
function nextId(): string {
  seq += 1;
  return `devlogger_console_${Date.now()}_${seq}`;
}

function timeTextMs(ms: number): string {
  try {
    const d = new Date(ms);
    // Fast, predictable HH:MM:SS.
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch {
    return '';
  }
}

function safeToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${
      value.stack ? `\n${value.stack}` : ''
    }`;
  }
  try {
    if (typeof value === 'object') return JSON.stringify(value);
  } catch {
    // ignore
  }
  try {
    return String(value);
  } catch {
    return '[Unserializable]';
  }
}

function joinArgs(args: unknown[]): string {
  if (!args.length) return '';
  return args.map(safeToString).join(' ');
}

function maybeStack(level: ConsoleLevel, args: unknown[]): string | undefined {
  if (level === 'error' || level === 'warn') {
    const err = args.find((a) => a instanceof Error) as Error | undefined;
    if (err?.stack) return err.stack;
    const e = new Error();
    return e.stack;
  }
  return undefined;
}

type ConsoleLike = Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'debug'>;

export function patchConsole(): void {
  if (!__DEV__) return;

  const anyGlobal = globalThis as any;
  if (anyGlobal[PATCHED_KEY]) return;

  const c = console as unknown as ConsoleLike;
  const originals: ConsoleLike = {
    log: c.log.bind(console),
    info: c.info ? c.info.bind(console) : c.log.bind(console),
    warn: c.warn ? c.warn.bind(console) : c.log.bind(console),
    error: c.error ? c.error.bind(console) : c.log.bind(console),
    debug: c.debug ? c.debug.bind(console) : c.log.bind(console),
  };

  anyGlobal[META_KEY] = originals;

  const wrap =
    (level: ConsoleLevel) =>
    (...args: unknown[]) => {
      try {
        const time = Date.now();
        addConsoleLog({
          id: nextId(),
          level,
          time,
          timeText: timeTextMs(time),
          message: joinArgs(args),
          stack: maybeStack(level, args),
        });
      } catch {
        // ignore
      }

      originals[level](...args);
    };

  (console as unknown as ConsoleLike).log = wrap('log');
  (console as unknown as ConsoleLike).info = wrap('info');
  (console as unknown as ConsoleLike).warn = wrap('warn');
  (console as unknown as ConsoleLike).error = wrap('error');
  (console as unknown as ConsoleLike).debug = wrap('debug');

  anyGlobal[PATCHED_KEY] = true;
}
