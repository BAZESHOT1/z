import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Home, MessageSquare, LayoutGrid, User, Settings, Globe, Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../app/themeContext';

interface SidebarProps {
  activeTab: string;
  onTabPress: (tab: any) => void;
  t: any;
  user?: any;
}

export default function Sidebar({ activeTab, onTabPress, t, user }: SidebarProps) {
  const { colors, theme, toggleTheme, lang, setLanguage } = useTheme();

  const NavItem = ({ id, icon: Icon, label }: any) => {
    const active = activeTab === id;
    return (
      <TouchableOpacity 
        style={[
          styles.element, 
          { backgroundColor: active ? colors.primary : 'transparent' }
        ]} 
        onPress={() => onTabPress(id)}
      >
        <Icon size={19} color={active ? '#ffffff' : colors.textSecondary} strokeWidth={2} />
        <Text style={[styles.label, { color: active ? '#ffffff' : colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.sidebarWrapper, { backgroundColor: colors.bg, borderColor: colors.sidebarBorder }]}>
      <View style={[styles.card, { backgroundColor: colors.sidebarBg, borderColor: colors.cardBorder }]}>
        
        {/* Z Logo Badge */}
        <View style={styles.brandHeader}>
          <View style={[styles.logoBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoBadgeText}>Z</Text>
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Z Network</Text>
        </View>

        <View style={styles.list}>
          <NavItem id="feed" icon={Home} label={t.home} />
          <NavItem id="chats" icon={MessageSquare} label={t.chats} />
          <NavItem id="apps" icon={LayoutGrid} label={t.apps} />
        </View>

        <View style={[styles.separator, { borderTopColor: colors.cardBorder }]} />

        <View style={styles.list}>
          {user ? (
            <>
              <NavItem id="profile" icon={User} label={t.profile} />
              <NavItem id="settings" icon={Settings} label={t.settings} />
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.element, { backgroundColor: colors.badgeBg }]}
                onPress={() => onTabPress('login')}
              >
                <User size={19} color={colors.primary} />
                <Text style={[styles.label, { color: colors.primary }]}>{t.signIn}</Text>
              </TouchableOpacity>

              {/* Language Switch for Guest */}
              <TouchableOpacity 
                style={styles.element}
                onPress={() => setLanguage(lang === 'ru' ? 'en' : 'ru')}
              >
                <Globe size={19} color={colors.textSecondary} />
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {lang === 'ru' ? 'RU' : 'EN'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Theme Switch Button */}
          <TouchableOpacity 
            style={styles.element}
            onPress={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={19} color="#fbbf24" /> : <Moon size={19} color="#6366f1" />}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {theme === 'dark' ? t.lightTheme : t.darkTheme}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebarWrapper: {
    padding: 20,
    height: '100%',
    borderRightWidth: 1,
  },
  card: {
    width: 220,
    borderRadius: 18,
    paddingVertical: 18,
    gap: 12,
    borderWidth: 1,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
  },
  brandTitle: {
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  separator: {
    borderTopWidth: 1,
    marginVertical: 4,
  },
  list: {
    paddingHorizontal: 12,
    gap: 6,
  },
  element: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
  },
});