import { Pressable, Text, View, StyleSheet } from 'react-native';
import { DevLogger } from '@zearaez/devtool';
import { useState } from 'react';

export default function App() {
  const [lastResult, setLastResult] = useState<string>('No requests yet');

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
