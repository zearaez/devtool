import { addLog, clear, getAllLogs, size } from '../devLogger/store';
import { setConfig } from '../devLogger/config';
import { safeJsonPretty } from '../devLogger/format';
import { patchFetch } from '../devLogger/interceptors/fetch';

describe('DevLogger dev-only utilities', () => {
  beforeEach(() => {
    clear();
    setConfig({
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
    });
  });

  it('keeps only the latest maxLogs in the bounded store', () => {
    setConfig({ maxLogs: 3 });

    const mk = (n: number) => ({
      id: `log_${n}`,
      kind: 'fetch' as const,
      request: {
        method: 'GET',
        url: `https://example.com/${n}`,
        headers: undefined,
        body: `body_${n}`,
      },
      response: { status: 200, headers: undefined, body: `resp_${n}` },
      timing: { startTime: n, endTime: n, durationMs: 1 },
    });

    clear();
    for (let i = 1; i <= 5; i++) addLog(mk(i) as any);

    expect(size()).toBe(3);
    const all = getAllLogs();
    expect(all.map((l) => l.id)).toEqual(['log_3', 'log_4', 'log_5']);
  });

  it('pretty-prints JSON safely when possible', () => {
    const { ok, text } = safeJsonPretty('{"a":1,"b":[2]}', 10_000);
    expect(ok).toBe(true);
    expect(text).toContain('"a"');
    expect(text).toContain('\n  ');

    const non = safeJsonPretty('not json', 1000);
    expect(non.ok).toBe(false);
  });

  it('captures fetch logs when fetch is patched', async () => {
    const originalFetch = globalThis.fetch;

    const originalPatched = (globalThis as any)
      .__ZEARA_DEVLOGGER_FETCH_PATCHED__;
    try {
      setConfig({ maxLogs: 10, maxBodyBytes: 10_000 });
      clear();

      const fakeResponse = {
        status: 200,
        headers: {
          forEach: (fn: (value: string, key: string) => void) => {
            fn('application/json', 'content-type');
            fn('x-demo', 'x-demo');
          },
        },
        clone: () => ({
          text: async () => '{"ok":true}',
        }),
      };

      (globalThis as any).fetch = jest.fn(async () => fakeResponse as any);
      delete (globalThis as any).__ZEARA_DEVLOGGER_FETCH_PATCHED__;
      patchFetch();

      const res = await globalThis.fetch('https://example.com/api', {
        method: 'POST',
        headers: { 'x-demo': '1' },
        body: '{"a":1}',
      });

      expect(res).toBe(fakeResponse);
      const logs = getAllLogs();
      expect(logs).toHaveLength(1);
      const first = logs[0]!;
      expect(first.request.method).toBe('POST');
      expect(first.response?.status).toBe(200);
    } finally {
      (globalThis as any).fetch = originalFetch;
      if (originalPatched === undefined) {
        delete (globalThis as any).__ZEARA_DEVLOGGER_FETCH_PATCHED__;
      } else {
        (globalThis as any).__ZEARA_DEVLOGGER_FETCH_PATCHED__ = originalPatched;
      }
    }
  });
});
