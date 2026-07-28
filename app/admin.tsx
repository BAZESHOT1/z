import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { ArrowLeft, ShieldAlert, Users, Server, Database, CheckCircle, RefreshCw } from 'lucide-react-native';
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
        
        {/* System & DB Stats Grid */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Системные показатели Z-Mesh</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Users color={colors.primary} size={22} />
            <Text style={[styles.statVal, { color: colors.text }]}>{stats?.usersCount || users.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.usersCount}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Server color="#238636" size={22} />
            <Text style={[styles.statVal, { color: colors.text }]}>{stats?.activeNodes || 18}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.nodesStatus}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Database color="#eab308" size={22} />
            <Text style={[styles.statVal, { color: colors.text }]}>ONLINE</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.dbHealth}</Text>
          </View>
        </View>

        {/* User Roles Management */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Управление пользователями и ролями</Text>
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

        {/* System Logs */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.systemLogs}</Text>
        <View style={[styles.logCard, { backgroundColor: '#0d1117', borderColor: colors.cardBorder }]}>
          {(stats?.systemLogs || []).map((log: string, idx: number) => (
            <Text key={idx} style={styles.logText}>{log}</Text>
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
  statCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, gap: 6, alignItems: 'flex-start' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600' },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  rowAvatar: { width: 40, height: 40, borderRadius: 20 },
  rowName: { fontWeight: '800', fontSize: 14 },
  rowMetaLine: { flexDirection: 'row', gap: 6 },
  rowMeta: { fontSize: 12 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  logCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  logText: { color: '#3fb950', fontFamily: 'monospace', fontSize: 12 }
});