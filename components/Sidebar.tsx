import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LucideIcon, Home, MessageSquare, LayoutGrid, User, Settings, Info } from 'lucide-react-native';

interface SidebarProps {
  activeTab: string;
  onTabPress: (tab: any) => void;
  t: any;
}

export default function Sidebar({ activeTab, onTabPress, t }: SidebarProps) {
  const NavItem = ({ id, icon: Icon, label, variant = 'default' }: any) => {
    const active = activeTab === id;
    return (
      <TouchableOpacity 
        style={[
          styles.element, 
          active && styles.elementActive,
          variant === 'delete' && styles.deleteHover
        ]} 
        onPress={() => onTabPress(id)}
      >
        <Icon size={19} color={active ? '#ffffff' : '#7e8590'} strokeWidth={2} />
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.sidebarWrapper}>
      <View style={styles.card}>
        <View style={styles.list}>
          <NavItem id="feed" icon={Home} label={t.home} />
          <NavItem id="chats" icon={MessageSquare} label={t.chats} />
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.list}>
          <NavItem id="apps" icon={LayoutGrid} label={t.apps} />
          <NavItem id="settings" icon={Settings} label="Settings" />
        </View>

        <View style={styles.separator} />
        
        <View style={styles.list}>
          <NavItem id="profile" icon={User} label={t.profile} variant="special" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebarWrapper: {
    padding: 20,
    height: '100%',
    backgroundColor: '#0d1117',
  },
  card: {
    width: 220,
    backgroundColor: '#242832',
    // Градиент имитируется через фон, так как RN не поддерживает CSS linear-gradient напрямую без доп библиотек
    borderRadius: 14,
    paddingVertical: 15,
    gap: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  separator: {
    borderTopWidth: 1.5,
    borderTopColor: '#42434a',
    marginVertical: 4,
  },
  list: {
    paddingHorizontal: 10,
    gap: 8,
  },
  element: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  elementActive: {
    backgroundColor: '#5353ff',
  },
  label: {
    color: '#7e8590',
    fontWeight: '600',
    fontSize: 14,
  },
  labelActive: {
    color: '#ffffff',
  },
  deleteHover: {
    // В RN hover имитируется через состояние, здесь зарезервировано под специфические табы
  },
  specialText: {
    color: '#bd89ff',
  }
});