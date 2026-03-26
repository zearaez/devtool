import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DevLoggerLog } from '../types';
import { formatHeaders, formatTiming, safeJsonPretty } from '../format';
import { getConfig } from '../config';
import { estimateUtf8Bytes } from '../utils';

type Props = {
  visible: boolean;
  logs: DevLoggerLog[];
  onClose: () => void;
  onClear: () => void;
};

function methodBadgeColor(method: string): string {
  switch (method) {
    case 'GET':
      return '#0ea5e9';
    case 'POST':
      return '#22c55e';
    case 'PUT':
      return '#f59e0b';
    case 'PATCH':
      return '#a855f7';
    case 'DELETE':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

function statusBadgeColor(status?: number): string {
  if (typeof status !== 'number') return '#6b7280';
  if (status >= 200 && status < 300) return '#22c55e';
  if (status >= 300 && status < 400) return '#0ea5e9';
  if (status >= 400 && status < 500) return '#f59e0b';
  if (status >= 500) return '#ef4444';
  return '#6b7280';
}

function truncateUrl(url: string, max = 120): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

function formatBody(body: string | undefined): string {
  if (!body) return '';
  const config = getConfig();
  const { ok, text } = safeJsonPretty(body, config.maxBodyBytes);
  return ok ? text : body;
}

function formatApproxBodySizeKb(body?: string): string {
  if (!body) return '0 KB';
  const bytes = estimateUtf8Bytes(body);
  const kb = bytes / 1024;
  if (kb < 0.1) return '<0.1 KB';
  return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
}

export function DebugPanel({ visible, logs, onClose, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedLog = useMemo(
    () => logs.find((l) => l.id === selectedId) ?? null,
    [logs, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const status = l.response?.status;
      const hay = [
        l.request.method,
        l.request.url,
        typeof status === 'number' ? String(status) : '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, query]);

  const list = selectedLog ? (
    <ScrollView
      style={styles.detailsWrap}
      contentContainerStyle={styles.detailsInner}
    >
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Request</Text>
          <View
            style={[
              styles.badgeMethod,
              { backgroundColor: methodBadgeColor(selectedLog.request.method) },
            ]}
          >
            <Text style={styles.badgeMethodText}>
              {selectedLog.request.method}
            </Text>
          </View>
        </View>
        <Text style={styles.urlText}>{selectedLog.request.url}</Text>
        <Text style={styles.metaText}>
          {`Duration: ${formatTiming(selectedLog.timing.durationMs)}`}
        </Text>
        {selectedLog.error ? (
          <Text style={styles.errorText}>
            {`Error: ${selectedLog.error.name ?? 'Error'} - ${
              selectedLog.error.message ?? ''
            }`}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Headers</Text>
        <Text style={styles.preText}>
          {formatHeaders(selectedLog.request.headers)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Body</Text>
        <Text selectable style={styles.preText}>
          {formatBody(selectedLog.request.body)}
        </Text>
      </View>

      {selectedLog.response ? (
        <>
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Response</Text>
              <View
                style={[
                  styles.badgeStatus,
                  {
                    backgroundColor: statusBadgeColor(
                      selectedLog.response.status
                    ),
                  },
                ]}
              >
                <Text style={styles.badgeStatusText}>
                  {typeof selectedLog.response.status === 'number'
                    ? selectedLog.response.status
                    : '-'}
                </Text>
              </View>
            </View>
            <Text style={styles.metaText}>
              {`Duration: ${formatTiming(selectedLog.timing.durationMs)}`}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Response Headers</Text>
            <Text style={styles.preText}>
              {formatHeaders(selectedLog.response.headers)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Response Body</Text>
            <Text selectable style={styles.preText}>
              {formatBody(selectedLog.response.body)}
            </Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  ) : null;

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide">
      <View style={styles.panel}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Network DevLogger</Text>
          <Pressable onPress={() => onClear()} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search url/method/status"
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
        </View>

        {selectedLog ? (
          <>
            <View style={styles.backRow}>
              <Pressable
                onPress={() => setSelectedId(null)}
                style={styles.backBtn}
              >
                <Text style={styles.backBtnText}>Back</Text>
              </Pressable>
            </View>
            {list}
          </>
        ) : (
          <ScrollView
            style={styles.listWrap}
            contentContainerStyle={styles.listInner}
          >
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>No captured requests.</Text>
            ) : null}
            {filtered.map((l) => {
              const status = l.response?.status;
              const statusColor = statusBadgeColor(status);
              const statusCodeText =
                typeof status === 'number'
                  ? String(status)
                  : l.error
                  ? '-'
                  : '-';
              const sizeText = formatApproxBodySizeKb(
                l.response?.body ?? l.request.body
              );
              return (
                <Pressable
                  key={l.id}
                  onPress={() => setSelectedId(l.id)}
                  style={styles.item}
                >
                  <View style={styles.itemTop}>
                    <View
                      style={[
                        styles.badgeMethod,
                        { backgroundColor: methodBadgeColor(l.request.method) },
                      ]}
                    >
                      <Text style={styles.badgeMethodText}>
                        {l.request.method}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.badgeStatus,
                        { backgroundColor: statusColor },
                      ]}
                    >
                      <Text style={styles.badgeStatusCodeText}>
                        {statusCodeText}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.itemUrl}>
                    {truncateUrl(l.request.url)}
                  </Text>
                  <Text style={styles.itemMetaText}>
                    {formatTiming(l.timing.durationMs)} • {sizeText}
                  </Text>
                  {l.error ? (
                    <Text style={styles.itemError}>{l.error.message}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  closeText: {
    color: '#e5e7eb',
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  clearText: {
    color: '#e5e7eb',
  },
  searchRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
  },
  listWrap: {
    flex: 1,
  },
  listInner: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 4,
  },
  item: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeMethod: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeMethodText: {
    color: '#0b1020',
    fontWeight: '700',
    fontSize: 11,
  },
  badgeStatusCodeText: {
    color: '#0b1020',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 16,
  },
  itemUrl: {
    marginTop: 6,
    color: '#e5e7eb',
    fontSize: 12,
  },
  itemMetaText: {
    marginTop: 3,
    color: '#9ca3af',
    fontSize: 11,
  },
  itemError: {
    marginTop: 4,
    color: '#fb7185',
    fontSize: 11,
  },
  emptyText: {
    color: '#9ca3af',
    paddingVertical: 20,
    textAlign: 'center',
  },
  detailsWrap: {
    flex: 1,
  },
  detailsInner: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    paddingTop: 8,
  },
  backRow: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  backBtnText: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  section: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
  urlText: {
    marginTop: 8,
    color: '#e5e7eb',
    fontSize: 12,
  },
  metaText: {
    marginTop: 6,
    color: '#9ca3af',
    fontSize: 12,
  },
  errorText: {
    marginTop: 10,
    color: '#fb7185',
    fontSize: 12,
  },
  preText: {
    marginTop: 8,
    color: '#e5e7eb',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  badgeStatus: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeStatusText: {
    color: '#0b1020',
    fontWeight: '700',
    fontSize: 12,
  },
});
