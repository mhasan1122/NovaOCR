import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import * as ExpoClipboard from 'expo-clipboard';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { historyService, HistoryItem } from '@/services/historyService';

export default function HistoryScreen() {
  const theme = useTheme();
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch history when screen is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const load = async () => {
        const items = await historyService.getHistory();
        if (isMounted) {
          setHistoryList(items);
        }
      };
      load();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const copyItemText = async (item: HistoryItem) => {
    try {
      await ExpoClipboard.setStringAsync(item.text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const deleteItem = (id: string) => {
    Alert.alert(
      'Delete Scan',
      'Are you sure you want to remove this scan from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await historyService.deleteHistoryItem(id);
            setHistoryList(prev => prev.filter(item => item.id !== id));
          },
        },
      ]
    );
  };

  const clearAllHistory = () => {
    if (historyList.length === 0) return;
    Alert.alert(
      'Clear All History',
      'This will delete all saved scans. This action cannot be undone. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await historyService.clearHistory();
            setHistoryList([]);
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return '#34c759';
    if (score >= 0.70) return '#ffcc00';
    return '#ff3b30';
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const isCopied = copiedId === item.id;
    return (
      <View style={[styles.historyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: item.imageUri }} style={styles.cardThumbnail} contentFit="cover" />
          <View style={styles.cardInfo}>
            <ThemedText type="smallBold" numberOfLines={1}>{formatDate(item.timestamp)}</ThemedText>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{item.language.toUpperCase()}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: getConfidenceColor(item.confidence) + '15', borderColor: getConfidenceColor(item.confidence) + '40', borderWidth: 1 }]}>
                <Text style={[styles.badgeText, { color: getConfidenceColor(item.confidence), fontWeight: 'bold' }]}>
                  {Math.round(item.confidence * 100)}% Conf
                </Text>
              </View>
            </View>
            <ThemedText type="code" style={{ color: theme.textSecondary }}>
              Speed: {(item.processingTime / 1000).toFixed(2)}s | Words: {item.wordCount}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.textPreview, { backgroundColor: theme.background }]}>
          <Text style={[styles.previewText, { color: theme.text }]} numberOfLines={3}>
            {item.text.trim() || 'No text detected.'}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, isCopied && { borderColor: '#34c759' }]}
            onPress={() => copyItemText(item)}
          >
            <Text style={[styles.actionBtnText, { color: isCopied ? '#34c759' : theme.text }]}>
              {isCopied ? '✓ COPIED' : 'COPY TEXT'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => deleteItem(item.id)}
          >
            <Text style={[styles.actionBtnText, { color: '#ff3b30' }]}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <Image source={require('@/assets/novalogo.png')} style={styles.historyLogo} />
            <View>
              <ThemedText type="subtitle" style={styles.title}>Scan History</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Stored locally on your device ({historyList.length} scans)
              </ThemedText>
            </View>
          </View>
          {historyList.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAllHistory}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {historyList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.backgroundElement }]}>
              <Text style={{ fontSize: 36 }}>📋</Text>
            </View>
            <ThemedText type="default" style={styles.emptyTitle}>No Scans Saved Yet</ThemedText>
            <ThemedText type="small" style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              Use the Home scanner to capture print. Completed scans will automatically display here.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={historyList}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  title: {
    fontWeight: 'bold',
  },
  clearBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  clearBtnText: {
    color: '#ff3b30',
    fontWeight: 'bold',
    fontSize: 13,
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  cardThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#3a3a3c',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  textPreview: {
    borderRadius: 8,
    padding: Spacing.two,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.select({ ios: 'CourierNewPSMT', android: 'monospace', web: 'monospace' }),
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  deleteBtn: {
    borderColor: 'rgba(255, 59, 48, 0.3)',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  historyLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
});
