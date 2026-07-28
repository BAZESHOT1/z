import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Share, Platform } from 'react-native';
import { Copy, Share2, Check, X, MessageCircle } from 'lucide-react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '../app/themeContext';

interface ShareItem {
  title: string;
  url: string;
  type?: 'post' | 'profile' | 'app';
}

interface ShareSheetProps {
  visible: boolean;
  item: ShareItem | null;
  onClose: () => void;
}

export default function ShareSheet({ visible, item, onClose }: ShareSheetProps) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!visible || !item) return null;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(item.url);
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1500);
  };

  const handleNativeShare = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: item.title,
          url: item.url,
        });
      } else {
        await Share.share({
          message: `${item.title}\n${item.url}`,
        });
      }
      onClose();
    } catch (e) {}
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View 
          entering={SlideInDown.duration(250)} 
          exiting={SlideOutDown.duration(200)}
          style={[styles.sheet, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Поделиться</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Item Preview */}
          <View style={[styles.itemPreview, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.previewUrl, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.url}
            </Text>
          </View>

          {/* Action Grid */}
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={[styles.actionTile, { backgroundColor: colors.subtleBorder }]} 
              onPress={handleCopy}
            >
              <View style={[styles.actionIconBox, { backgroundColor: copied ? '#238636' : colors.primary }]}>
                {copied ? <Check size={20} color="#fff" /> : <Copy size={20} color="#fff" />}
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                {copied ? 'Скопировано!' : 'Копировать'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionTile, { backgroundColor: colors.subtleBorder }]} 
              onPress={handleNativeShare}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#6366f1' }]}>
                <Share2 size={20} color="#fff" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Системное окно</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionTile, { backgroundColor: colors.subtleBorder }]} 
              onPress={handleCopy}
            >
              <View style={[styles.actionIconBox, { backgroundColor: '#2563eb' }]}>
                <MessageCircle size={20} color="#fff" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Чат Z</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, width: '100%', maxWidth: 540, alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
  itemPreview: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20, gap: 4 },
  previewTitle: { fontWeight: '700', fontSize: 14 },
  previewUrl: { fontSize: 12 },
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionTile: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'center', gap: 10 },
  actionIconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' }
});