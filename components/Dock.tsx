import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

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

export default function Dock({ items, activeTab, panelHeight = 70 }: DockProps) {
  return (
    <View style={[styles.dockContainer, { height: panelHeight }]}>
      <View style={styles.dockWrapper}>
        {items.map((item) => {
          const isActive = activeTab === item.id;
          
          return (
            <TouchableOpacity 
              key={item.id} 
              onPress={item.onClick}
              style={styles.dockItem}
            >
              <Animated.View style={[
                styles.iconWrapper,
                isActive && styles.iconWrapperActive
              ]}>
                {item.icon}
              </Animated.View>
              {isActive && (
                <Text style={styles.dockLabel}>{item.label}</Text>
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
    paddingHorizontal: 20,
  },
  dockWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(36, 40, 50, 0.95)',
    borderRadius: 24,
    padding: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#42434a',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    alignItems: 'center',
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapperActive: {
    backgroundColor: '#5353ff',
  },
  dockLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  }
});