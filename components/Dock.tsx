import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../app/themeContext';

interface DockItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface DockProps {
  items: DockItem[];
  activeTab: string;
  panelHeight?: number;
}

export default function Dock({ items, activeTab, panelHeight = 64 }: DockProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.dockContainer, { height: panelHeight }]}>
      <View style={[styles.dockWrapper, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        {items.map((item) => {
          const isActive = activeTab === item.id;
          
          return (
            <TouchableOpacity 
              key={item.id} 
              onPress={item.onClick}
              style={styles.dockItem}
              activeOpacity={0.7}
            >
              <Animated.View style={[
                styles.iconWrapper,
                isActive && { backgroundColor: colors.primary }
              ]}>
                {item.icon}
              </Animated.View>
              {isActive && (
                <Text style={[styles.dockLabel, { color: colors.text }]}>{item.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dockWrapper: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 6,
    gap: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 6,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dockLabel: {
    fontSize: 12,
    fontWeight: '700',
  }
});