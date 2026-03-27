import { Pressable, Text, View, StyleSheet } from 'react-native';
import { DevLogger } from '@zearaez/devtool';
import { useState } from 'react';

async function runMany(
  total: number,
  concurrency: number,
  task: (i: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = new Array(Math.max(1, concurrency))
    .fill(null)
    .map(async () => {
      while (true) {
        const i = next;
        next += 1;
        if (i >= total) return;
        await task(i);
      }
    });
  await Promise.all(workers);
}

export default function App() {
  const [lastResult, setLastResult] = useState<string>('No requests yet');
  const [busy, setBusy] = useState(false);

  async function run(method: string, url: string, body?: unknown) {
    const start = Date.now();

    const init: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };

    try {
      const res = await fetch(url, init);
      const text = await res.text();
      setLastResult(
        `${method} ${res.status} (${Math.round(Date.now() - start)}ms): ${
          text ? text.slice(0, 60) : '<empty>'
        }`
      );
    } catch (e) {
      setLastResult(`${method} failed: ${(e as Error).message}`);
    }
  }

  function sendGet() {
    run('GET', 'https://jsonplaceholder.typicode.com/todos/1');
  }

  function sendPost() {
    run('POST', 'https://jsonplaceholder.typicode.com/posts', {
      title: 'devlogger post',
      body: 'created from DevLogger demo',
      userId: 1,
    });
  }

  function sendPut() {
    run('PUT', 'https://jsonplaceholder.typicode.com/posts/1', {
      id: 1,
      title: 'devlogger put',
      body: 'updated via DevLogger demo',
      userId: 1,
    });
  }

  function sendPatch() {
    run('PATCH', 'https://jsonplaceholder.typicode.com/posts/1', {
      title: 'devlogger patch',
      body: 'patched via DevLogger demo',
    });
  }

  function sendDelete() {
    run('DELETE', 'https://jsonplaceholder.typicode.com/posts/1');
  }

  async function sendFailRequest() {
    const url =
      'https://this-domain-should-not-exist.devlogger-fail.example/does-not-matter';

    let controller: AbortController | null = null;
    let signal: AbortSignal | undefined;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      signal = controller.signal;
    }

    const timeoutMs = 1000;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (controller) {
      timeout = setTimeout(() => controller?.abort(), timeoutMs);
    }

    try {
      const start = Date.now();
      await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        ...(signal ? { signal } : {}),
      });

      setLastResult(`FAIL (${Date.now() - start}ms): unexpectedly succeeded`);
    } catch (e) {
      const err = e as Error & { name?: string; message?: string };
      setLastResult(
        `FAIL as expected: ${err.name ?? 'Error'} - ${err.message ?? 'unknown'}`
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function logConsoleExamples() {
    console.log('console.log demo', { a: 1, b: [2, 3] });
    console.info('console.info demo', new Date().toISOString());
    console.debug('console.debug demo');
    console.warn('console.warn demo', new Error('warn example'));
    console.error('console.error demo', new Error('error example'));

    const long = new Array(40)
      .fill(0)
      .map((_, i) => `line_${i + 1}: ${'x'.repeat(50)}`)
      .join('\n');
    console.log(`Long log (tap to expand):\n${long}`);

    setLastResult('Wrote console logs. Open DevLogger → Console tab.');
  }

  async function fetch200() {
    if (busy) return;
    setBusy(true);
    const start = Date.now();
    let ok = 0;
    let fail = 0;

    try {
      await runMany(200, 10, async (i) => {
        // Mix success + failure to stress UI + error handling.
        const shouldFail = i % 20 === 0;
        const url = shouldFail
          ? 'https://this-domain-should-not-exist.devlogger-fail.example/bulk'
          : `https://jsonplaceholder.typicode.com/todos/${(i % 10) + 1}`;
        try {
          const res = await fetch(url);
          if (res.ok) ok += 1;
          else fail += 1;
        } catch {
          fail += 1;
        }
      });
      setLastResult(
        `Bulk done in ${Math.round(
          Date.now() - start
        )}ms: ok=${ok}, fail=${fail}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DevLogger demo</Text>
      <View style={styles.buttonCol}>
        <Pressable style={styles.button} onPress={sendGet}>
          <Text style={styles.buttonText}>GET</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={sendPost}>
          <Text style={styles.buttonText}>POST</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={sendPut}>
          <Text style={styles.buttonText}>PUT</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={sendPatch}>
          <Text style={styles.buttonText}>PATCH</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={sendDelete}>
          <Text style={styles.buttonText}>DELETE</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={sendFailRequest}>
          <Text style={styles.buttonText}>FAIL (error)</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={logConsoleExamples}>
          <Text style={styles.buttonText}>Console logs</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={fetch200}>
          <Text style={styles.buttonText}>
            {busy ? 'Running 200…' : 'Fetch API x200'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.resultText} selectable>
        {lastResult}
      </Text>
      <DevLogger.UI />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: '#e5e7eb',
    fontWeight: '700',
  },
  buttonCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e5e7eb',
    maxWidth: 360,
    backgroundColor: '#0b1020',
    borderRadius: 12,
  },
});
