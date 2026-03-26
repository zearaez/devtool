import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DebugPanel } from './DebugPanel';
import type { DevLoggerLog } from '../types';
import { clear, getAllLogs, size, subscribe } from '../store';

type Props = {
  updateThrottleMs?: number;
};

export function Bubble({ updateThrottleMs = 200 }: Props) {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<DevLoggerLog[]>(() => getAllLogs());
  const [count, setCount] = useState(() => size());

  const throttledTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribe(() => {
      if (throttledTimer.current) clearTimeout(throttledTimer.current);
      throttledTimer.current = setTimeout(() => {
        setLogs(getAllLogs());
        setCount(size());
        throttledTimer.current = null;
      }, updateThrottleMs);
    });
  }, [updateThrottleMs]);

  const pan = useRef(new Animated.ValueXY({ x: 16, y: 120 })).current;
  const last = useRef({ x: 16, y: 120 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
        },
        onPanResponderMove: (_evt, gestureState) => {
          const nextX = last.current.x + gestureState.dx;
          const nextY = last.current.y + gestureState.dy;
          pan.setValue({ x: nextX, y: nextY });
        },
        onPanResponderRelease: (_evt, gestureState) => {
          last.current = {
            x: last.current.x + gestureState.dx,
            y: last.current.y + gestureState.dy,
          };
        },
      }),
    [pan]
  );

  return (
    <>
      <Animated.View
        style={[styles.bubbleWrap, { transform: pan.getTranslateTransform() }]}
        {...responder.panHandlers}
      >
        <Pressable
          style={styles.bubble}
          onPress={() => setVisible(true)}
          accessibilityRole="button"
        >
          <View style={styles.bubbleInner}>
            <View style={styles.dot} />
            <Text style={styles.countText}>{count}</Text>
          </View>
        </Pressable>
      </Animated.View>

      <DebugPanel
        visible={visible}
        logs={logs}
        onClose={() => setVisible(false)}
        onClear={() => clear()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: {
    position: 'absolute',
    zIndex: 9999,
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    // Avoid `gap` for compatibility across RN versions.
    paddingHorizontal: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  countText: {
    color: '#e5e7eb',
    fontWeight: '800',
    fontSize: 16,
  },
});
