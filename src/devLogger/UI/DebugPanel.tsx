import { useMemo, useState } from 'react';
import {
  FlatList,
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
import type { ConsoleLogEntry } from '../console/types';
import {
  clearConsole,
  getAllConsoleLogs,
  subscribeConsole,
} from '../console/store';
import { useEffect } from 'react';
import { clipboard } from '../clipboard';

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

function buildCopyAllText(log: DevLoggerLog): string {
  const parts: string[] = [];
  parts.push(`Request: ${log.request.method} ${log.request.url}`);
  if (log.request.headers && Object.keys(log.request.headers).length) {
    parts.push('\nRequest headers:\n' + formatHeaders(log.request.headers));
  }
  if (log.request.body) {
    parts.push('\nRequest body:\n' + log.request.body);
  }

  if (log.response) {
    parts.push(`\nResponse status: ${log.response.status ?? '-'}`);
    if (log.response.headers && Object.keys(log.response.headers).length) {
      parts.push('\nResponse headers:\n' + formatHeaders(log.response.headers));
    }
    if (log.response.body) {
      parts.push('\nResponse body:\n' + log.response.body);
    }
  }

  if (log.error) {
    parts.push(
      `\nError: ${log.error.name ?? 'Error'} - ${log.error.message ?? ''}`
    );
  }

  if (typeof log.timing.durationMs === 'number') {
    parts.push(`\nDuration: ${formatTiming(log.timing.durationMs)}`);
  }

  return parts.join('\n');
}

export function DebugPanel({ visible, logs, onClose, onClear }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'network' | 'console'>('network');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>(() =>
    getAllConsoleLogs()
  );
  const [expandedConsole, setExpandedConsole] = useState<
    Record<string, boolean>
  >({});
  const [editMode, setEditMode] = useState(false);
  const [editMethod, setEditMethod] = useState('GET');
  const [editUrl, setEditUrl] = useState('');
  const [editHeadersText, setEditHeadersText] = useState('{\n}');
  const [editBody, setEditBody] = useState('');
  const [resendStatus, setResendStatus] = useState<string>('');

  const selectedLog = useMemo(
    () => logs.find((l) => l.id === selectedId) ?? null,
    [logs, selectedId]
  );

  useEffect(() => {
    setQuery('');
  }, [tab]);

  useEffect(() => {
    if (!selectedLog) return;
    setEditMode(false);
    setResendStatus('');
    setEditMethod(selectedLog.request.method || 'GET');
    setEditUrl(selectedLog.request.url || '');
    setEditHeadersText(
      JSON.stringify(selectedLog.request.headers ?? {}, null, 2) ?? '{\n}'
    );
    setEditBody(selectedLog.request.body ?? '');
  }, [selectedLog]);

  const filtered = useMemo(() => {
    if (tab !== 'network') return logs;
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
  }, [logs, query, tab]);

  const filteredConsole = useMemo(() => {
    if (tab !== 'console') return consoleLogs;
    const q = query.trim().toLowerCase();
    if (!q) return consoleLogs;
    return consoleLogs.filter((l) => {
      const hay = [l.level, l.message].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [consoleLogs, query, tab]);

  useEffect(() => {
    return subscribeConsole(() => {
      setConsoleLogs(getAllConsoleLogs());
    });
  }, []);

  async function resendRequestFromEditor(): Promise<void> {
    const method = editMethod.trim().toUpperCase() || 'GET';
    const url = editUrl.trim();
    if (!url) {
      setResendStatus('Missing URL');
      return;
    }

    let headers: Record<string, string> = {};
    const rawHeaders = editHeadersText.trim();
    if (rawHeaders) {
      try {
        // Allow either JSON object or empty.
        const parsed = JSON.parse(rawHeaders);
        if (parsed && typeof parsed === 'object') {
          headers = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v ?? ''),
            ])
          );
        }
      } catch {
        setResendStatus('Headers must be valid JSON');
        return;
      }
    }

    const body = editBody;
    const start = Date.now();
    setResendStatus('Sending…');
    try {
      const res = await fetch(url, {
        method,
        headers,
        ...(body ? { body } : {}),
      });
      setResendStatus(
        `Sent: ${res.status} (${Math.round(Date.now() - start)}ms)`
      );
    } catch (e) {
      setResendStatus(`Failed: ${(e as Error).message}`);
    }
  }

  const list = selectedLog ? (
    <ScrollView
      style={styles.detailsWrap}
      contentContainerStyle={styles.detailsInner}
    >
      {editMode ? (
        <View style={styles.section}>
          <Text style={styles.label}>Edit request</Text>
          <Text style={styles.smallLabel}>Method</Text>
          <TextInput
            value={editMethod}
            onChangeText={setEditMethod}
            autoCapitalize="characters"
            style={styles.editorInput}
            placeholder="GET"
            placeholderTextColor="#6b7280"
          />
          <Text style={styles.smallLabel}>URL</Text>
          <TextInput
            value={editUrl}
            onChangeText={setEditUrl}
            autoCapitalize="none"
            style={styles.editorInput}
            placeholder="https://..."
            placeholderTextColor="#6b7280"
          />
          <Text style={styles.smallLabel}>Headers (JSON)</Text>
          <TextInput
            value={editHeadersText}
            onChangeText={setEditHeadersText}
            autoCapitalize="none"
            style={styles.editorArea}
            placeholder='{"authorization":"Bearer ..."}'
            placeholderTextColor="#6b7280"
            multiline
          />
          <Text style={styles.smallLabel}>Body</Text>
          <TextInput
            value={editBody}
            onChangeText={setEditBody}
            autoCapitalize="none"
            style={styles.editorArea}
            placeholder="raw body string"
            placeholderTextColor="#6b7280"
            multiline
          />
          <Pressable
            style={styles.primaryBtn}
            onPress={resendRequestFromEditor}
          >
            <Text style={styles.primaryBtnText}>Send edited request</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.label}>Request</Text>
          <View style={styles.sectionHeaderRight}>
            <View
              style={[
                styles.badgeMethod,
                {
                  backgroundColor: methodBadgeColor(selectedLog.request.method),
                },
              ]}
            >
              <Text style={styles.badgeMethodText}>
                {selectedLog.request.method}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                clipboard.setString(
                  `${selectedLog.request.method} ${selectedLog.request.url}`
                )
              }
              hitSlop={8}
              style={styles.sectionCopyBtn}
              accessibilityRole="button"
              accessibilityLabel="Copy request line"
            >
              <Text style={styles.sectionCopyIcon}>⧉</Text>
            </Pressable>
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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.label}>Headers</Text>
          <Pressable
            onPress={() =>
              clipboard.setString(formatHeaders(selectedLog.request.headers))
            }
            hitSlop={8}
            style={styles.sectionCopyBtn}
            accessibilityRole="button"
            accessibilityLabel="Copy request headers"
          >
            <Text style={styles.sectionCopyIcon}>⧉</Text>
          </Pressable>
        </View>
        <Text style={styles.preText}>
          {formatHeaders(selectedLog.request.headers)}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.label}>Body</Text>
          <Pressable
            onPress={() => clipboard.setString(selectedLog.request.body ?? '')}
            hitSlop={8}
            style={styles.sectionCopyBtn}
            accessibilityRole="button"
            accessibilityLabel="Copy request body"
          >
            <Text style={styles.sectionCopyIcon}>⧉</Text>
          </Pressable>
        </View>
        <Text selectable style={styles.preText}>
          {formatBody(selectedLog.request.body)}
        </Text>
      </View>

      {selectedLog.response ? (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.label}>Response</Text>
              <View style={styles.sectionHeaderRight}>
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
                <Pressable
                  onPress={() =>
                    clipboard.setString(
                      `status: ${selectedLog.response?.status ?? '-'}`
                    )
                  }
                  hitSlop={8}
                  style={styles.sectionCopyBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Copy response status"
                >
                  <Text style={styles.sectionCopyIcon}>⧉</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.metaText}>
              {`Duration: ${formatTiming(selectedLog.timing.durationMs)}`}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.label}>Response Headers</Text>
              <Pressable
                onPress={() =>
                  clipboard.setString(
                    formatHeaders(selectedLog.response?.headers)
                  )
                }
                hitSlop={8}
                style={styles.sectionCopyBtn}
                accessibilityRole="button"
                accessibilityLabel="Copy response headers"
              >
                <Text style={styles.sectionCopyIcon}>⧉</Text>
              </Pressable>
            </View>
            <Text style={styles.preText}>
              {formatHeaders(selectedLog.response.headers)}
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.label}>Response Body</Text>
              <Pressable
                onPress={() =>
                  clipboard.setString(selectedLog.response?.body ?? '')
                }
                hitSlop={8}
                style={styles.sectionCopyBtn}
                accessibilityRole="button"
                accessibilityLabel="Copy response body"
              >
                <Text style={styles.sectionCopyIcon}>⧉</Text>
              </Pressable>
            </View>
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
          {selectedLog ? (
            <Pressable
              onPress={() => setSelectedId(null)}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.headerIconText}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.headerLeftSpacer} />
          )}
          <Text style={styles.headerTitle}>Network DevLogger</Text>
          <Pressable
            onPress={onClose}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.headerIconText}>×</Text>
          </Pressable>
        </View>

        {selectedLog ? (
          <View style={styles.detailTopRow}>
            {resendStatus ? (
              <Text style={styles.resendStatusText}>{resendStatus}</Text>
            ) : (
              <View style={styles.detailTopSpacer} />
            )}
            <View style={styles.detailTopRight}>
              <Pressable
                style={styles.backRowActionBtn}
                onPress={resendRequestFromEditor}
                accessibilityRole="button"
                accessibilityLabel="Resend request"
              >
                <Text style={styles.backRowActionText}>Resend</Text>
              </Pressable>
              <Pressable
                style={styles.backRowActionBtn}
                onPress={() => setEditMode((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Edit and resend"
              >
                <Text style={styles.backRowActionText}>
                  {editMode ? 'Hide editor' : 'Edit'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                tab === 'network'
                  ? 'Search url/method/status'
                  : 'Search level/message'
              }
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                style={styles.searchClearBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Text style={styles.searchClearIcon}>×</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {selectedLog ? (
          <>{list}</>
        ) : (
          <>
            <View style={styles.tabBar}>
              <View style={styles.tabLeft}>
                <Pressable
                  style={[
                    styles.tabBtn,
                    tab === 'network' && styles.tabBtnActive,
                  ]}
                  onPress={() => setTab('network')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      tab === 'network' && styles.tabTextActive,
                    ]}
                  >
                    Network
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.tabBtn,
                    tab === 'console' && styles.tabBtnActive,
                  ]}
                  onPress={() => setTab('console')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      tab === 'console' && styles.tabTextActive,
                    ]}
                  >
                    Console
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  if (tab === 'network') {
                    onClear();
                  } else {
                    clearConsole();
                    setExpandedConsole({});
                  }
                }}
                style={styles.tabClearBtn}
              >
                <Text style={styles.tabClearText}>Clear</Text>
              </Pressable>
            </View>

            {tab === 'network' ? (
              <FlatList
                style={styles.listWrap}
                contentContainerStyle={styles.listInner}
                data={filtered}
                keyExtractor={(item) => item.id}
                removeClippedSubviews
                initialNumToRender={16}
                maxToRenderPerBatch={16}
                windowSize={7}
                updateCellsBatchingPeriod={50}
                renderItem={({ item: l }) => {
                  const status = l.response?.status;
                  const statusColor = statusBadgeColor(status);
                  const statusCodeText =
                    typeof status === 'number' ? String(status) : '-';
                  const sizeText = formatApproxBodySizeKb(
                    l.response?.body ?? l.request.body
                  );
                  return (
                    <Pressable
                      onPress={() => setSelectedId(l.id)}
                      style={styles.item}
                    >
                      <View style={styles.itemTop}>
                        <View
                          style={[
                            styles.badgeMethod,
                            {
                              backgroundColor: methodBadgeColor(
                                l.request.method
                              ),
                            },
                          ]}
                        >
                          <Text style={styles.badgeMethodText}>
                            {l.request.method}
                          </Text>
                        </View>

                        <View style={styles.itemTopRight}>
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
                          <Pressable
                            onPress={() =>
                              clipboard.setString(buildCopyAllText(l))
                            }
                            hitSlop={8}
                            style={styles.rowCopyBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Copy network log"
                          >
                            <Text style={styles.rowCopyIcon}>⧉</Text>
                          </Pressable>
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
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No captured requests.</Text>
                }
              />
            ) : (
              <FlatList
                style={styles.listWrap}
                contentContainerStyle={styles.listInner}
                data={filteredConsole}
                keyExtractor={(item) => item.id}
                removeClippedSubviews
                initialNumToRender={18}
                maxToRenderPerBatch={18}
                windowSize={9}
                updateCellsBatchingPeriod={50}
                renderItem={({ item }) => {
                  const expanded = !!expandedConsole[item.id];
                  const levelColor =
                    item.level === 'error'
                      ? '#ef4444'
                      : item.level === 'warn'
                      ? '#f59e0b'
                      : item.level === 'info'
                      ? '#0ea5e9'
                      : item.level === 'debug'
                      ? '#a855f7'
                      : '#22c55e';
                  return (
                    <Pressable
                      onPress={() =>
                        setExpandedConsole((prev) => ({
                          ...prev,
                          [item.id]: !expanded,
                        }))
                      }
                      style={styles.consoleItem}
                    >
                      <View style={styles.consoleTop}>
                        <View
                          style={[
                            styles.consoleLevelDot,
                            { backgroundColor: levelColor },
                          ]}
                        />
                        <Text style={styles.consoleLevelText}>
                          {item.level.toUpperCase()}
                        </Text>
                        <Text style={styles.consoleTimeText}>
                          {item.timeText ?? ''}
                        </Text>
                        <Pressable
                          onPress={() => clipboard.setString(item.message)}
                          hitSlop={8}
                          style={styles.rowCopyBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Copy console log"
                        >
                          <Text style={styles.rowCopyIcon}>⧉</Text>
                        </Pressable>
                      </View>
                      <Text
                        style={styles.consoleMessageText}
                        numberOfLines={expanded ? undefined : 2}
                      >
                        {item.message}
                      </Text>
                    </Pressable>
                  );
                }}
                ListHeaderComponent={<View style={styles.consoleHeaderRow} />}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No console logs.</Text>
                }
              />
            )}
          </>
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
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    color: '#e5e7eb',
    fontWeight: '900',
    fontSize: 22,
    lineHeight: 22,
  },
  headerLeftSpacer: {
    width: 36,
  },
  searchRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
    paddingRight: 42,
  },
  searchClearBtn: {
    position: 'absolute',
    right: 22,
    top: 8 + 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearIcon: {
    color: '#e5e7eb',
    fontWeight: '900',
    fontSize: 18,
    lineHeight: 18,
  },
  listWrap: {
    flex: 1,
  },
  listInner: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  tabLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#1f2937',
  },
  tabText: {
    color: '#9ca3af',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#e5e7eb',
  },
  tabClearBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  tabClearText: {
    color: '#e5e7eb',
    fontWeight: '800',
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
  itemTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCopyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    marginLeft: 8,
  },
  rowCopyIcon: {
    color: '#e5e7eb',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 14,
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
  consoleHeaderRow: {
    paddingBottom: 0,
  },
  consoleItem: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  consoleTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consoleLevelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  consoleLevelText: {
    color: '#e5e7eb',
    fontWeight: '800',
    fontSize: 12,
    marginRight: 10,
  },
  consoleTimeText: {
    color: '#9ca3af',
    fontSize: 11,
    marginRight: 'auto',
  },
  consoleMessageText: {
    marginTop: 6,
    color: '#e5e7eb',
    fontSize: 12,
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  actionText: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 12,
  },
  resendStatusText: {
    color: '#9ca3af',
    fontSize: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  smallLabel: {
    marginTop: 10,
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  editorInput: {
    marginTop: 6,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
  },
  editorArea: {
    marginTop: 6,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#e5e7eb',
    fontWeight: '800',
  },
  detailTopRow: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailTopSpacer: {
    flex: 1,
  },
  detailTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backRowActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#111827',
    marginLeft: 8,
  },
  backRowActionText: {
    color: '#e5e7eb',
    fontWeight: '800',
    fontSize: 12,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCopyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
    marginLeft: 8,
  },
  sectionCopyIcon: {
    color: '#e5e7eb',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 14,
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
