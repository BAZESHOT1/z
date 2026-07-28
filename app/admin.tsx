import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { ArrowLeft, ShieldAlert, Users, Server, Database, RefreshCw, Cpu, HardDrive, Terminal, CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from './themeContext';
import { translations } from './i18n';
import { fetchAdminUsers, updateUserRole, fetchAdminStats, getAvatarUrl } from './api';

export default function AdminScreen() {
  const { colors, lang } = useTheme();
  const t = translations[lang];
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [updatingUser, setUpdatingUser] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('master-core-01');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminStats()
      ]);
      setUsers(usersData || []);
      setStats(statsData);
      if (statsData?.nodes?.length > 0) {
        setSelectedNodeId(statsData.nodes[0].id);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, currentRole: string) => {
    const roles = ['USER', 'MODERATOR', 'ADMIN', 'ROOT'];
    const nextRole = roles[(roles.indexOf(currentRole) + 1) % roles.length];

    setUpdatingUser(userId);
    try {
      await updateUserRole(userId, nextRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: nextRole } : u));
    } catch (e: any) {
      console.error(e);
    } finally {
      setUpdatingUser(null);
    }
  };

  if (loading && !stats) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const selectedNode = (stats?.nodes || []).find((n: any) => n.id === selectedNodeId) || (stats?.nodes?.[0]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <ShieldAlert color="#ef4444" size={24} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.adminPanel}</Text>
        <TouchableOpacity onPress={loadAdminData} style={styles.refreshBtn}>
          <RefreshCw color={colors.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Top Summary Badges */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Users color={colors.primary} size={20} />
            <Text style={[styles.statVal, { color: colors.text }]}>{stats?.usersCount || users.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.usersCount}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Server color="#238636" size={20} />
            <Text style={[styles.statVal, { color: colors.text }]}>{stats?.nodes?.length || 3}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.nodesStatus}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Database color="#eab308" size={20} />
            <Text style={[styles.statVal, { color: colors.text }]}>ONLINE</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.dbHealth}</Text>
          </View>
        </View>

        {/* Real Node Inspector Section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Монитор нод бэкенда (Master & Community Cluster)
        </Text>
        
        <View style={styles.nodesLayout}>
          {/* Left Column: Node Cards List */}
          <View style={styles.nodesList}>
            {(stats?.nodes || []).map((node: any) => {
              const isSelected = node.id === selectedNodeId;
              return (
                <TouchableOpacity
                  key={node.id}
                  style={[
                    styles.nodeSelectorCard,
                    { backgroundColor: colors.cardBg, borderColor: isSelected ? colors.primary : colors.cardBorder },
                    isSelected && { borderLeftWidth: 4, borderLeftColor: colors.primary }
                  ]}
                  onPress={() => setSelectedNodeId(node.id)}
                >
                  <View style={styles.nodeHeaderRow}>
                    <Server size={16} color={node.type === 'MASTER' ? '#ef4444' : '#238636'} />
                    <Text style={[styles.nodeTitle, { color: colors.text }]}>{node.name}</Text>
                    <View style={styles.onlineBadge}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineText}>{node.pingMs}ms</Text>
                    </View>
                  </View>
                  
                  <Text style={[styles.nodeUrl, { color: colors.textSecondary }]}>{node.url}</Text>
                  
                  <View style={styles.nodeMetricsRow}>
                    <Text style={[styles.metricChip, { color: colors.textSecondary }]}>RAM: {node.memoryUsage}</Text>
                    <Text style={[styles.metricChip, { color: colors.textSecondary }]}>Uptime: {node.uptime}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Right Column: Active Selected Node Detail & Live Terminal Logs */}
          {selectedNode && (
            <View style={[styles.nodeDetailCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.detailHeader}>
                <Terminal size={18} color={colors.primary} />
                <Text style={[styles.detailTitle, { color: colors.text }]}>
                  Журнал ноды: {selectedNode.name}
                </Text>
              </View>

              <View style={styles.detailStatsRow}>
                <View style={styles.detailStatBox}>
                  <Cpu size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailStatText, { color: colors.text }]}>CPU: {selectedNode.cpuUsage}</Text>
                </View>
                <View style={styles.detailStatBox}>
                  <HardDrive size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailStatText, { color: colors.text }]}>Memory: {selectedNode.memoryUsage}</Text>
                </View>
                <View style={styles.detailStatBox}>
                  <CheckCircle size={14} color="#238636" />
                  <Text style={[styles.detailStatText, { color: '#238636' }]}>{selectedNode.dbStatus}</Text>
                </View>
              </View>

              {/* Terminal Logs Output */}
              <View style={styles.terminalBox}>
                <Text style={styles.terminalHeader}>=== LIVE SYSTEM LOGS ({selectedNode.id}) ===</Text>
                {(selectedNode.logs || []).map((log: string, idx: number) => (
                  <Text key={idx} style={styles.terminalLine}>{log}</Text>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* User Roles Management */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Управление пользователями и правами (База Данных)
        </Text>
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          {users.map((u) => (
            <View key={u.id} style={[styles.userRow, { borderBottomColor: colors.subtleBorder }]}>
              <Image source={{ uri: getAvatarUrl(u.username, u.avatar) }} style={styles.rowAvatar} />
              
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: colors.text }]}>
                  {u.firstName || u.username} {u.lastName || ''}
                </Text>

                <View style={styles.rowMetaLine}>
                  <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>@{u.username}</Text>
                  <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>• {u.email}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={[
                  styles.roleBadge, 
                  { backgroundColor: u.role === 'ROOT' ? '#f85149' : u.role === 'ADMIN' ? '#238636' : colors.cardBorder }
                ]}
                onPress={() => handleRoleChange(u.id, u.role)}
                disabled={updatingUser === u.id}
              >
                {updatingUser === u.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.roleBadgeText}>{u.role}</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  refreshBtn: { marginLeft: 'auto', padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  content: { padding: 20, gap: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, gap: 4, alignItems: 'flex-start' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  nodesLayout: { gap: 12 },
  nodesList: { gap: 8 },
  nodeSelectorCard: { padding: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  nodeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nodeTitle: { fontWeight: '800', fontSize: 13, flex: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(35, 134, 54, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#238636' },
  onlineText: { color: '#238636', fontSize: 10, fontWeight: '800' },
  nodeUrl: { fontSize: 11 },
  nodeMetricsRow: { flexDirection: 'row', gap: 10 },
  metricChip: { fontSize: 10, fontWeight: '600' },
  nodeDetailCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailTitle: { fontWeight: '800', fontSize: 14 },
  detailStatsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  detailStatBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailStatText: { fontSize: 12, fontWeight: '700' },
  terminalBox: { backgroundColor: '#0d1117', padding: 12, borderRadius: 10, gap: 4 },
  terminalHeader: { color: '#8b949e', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  terminalLine: { color: '#3fb950', fontFamily: 'monospace', fontSize: 11 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  rowAvatar: { width: 40, height: 40, borderRadius: 20 },
  rowName: { fontWeight: '800', fontSize: 14 },
  rowMetaLine: { flexDirection: 'row', gap: 6 },
  rowMeta: { fontSize: 12 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' }
});