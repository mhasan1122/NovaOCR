import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HistoryItem {
  id: string;
  timestamp: number;
  imageUri: string;
  text: string;
  confidence: number;
  language: string;
  processingTime: number;
  wordCount: number;
}

const HISTORY_KEY = '@nova_ocr_history';

class HistoryService {
  /**
   * Retrieves all OCR scan history items, sorted newest first.
   */
  async getHistory(): Promise<HistoryItem[]> {
    try {
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data) as HistoryItem[];
      // Sort newest first
      return parsed.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      console.error('HistoryService: Failed to retrieve history', err);
      return [];
    }
  }

  /**
   * Saves a new OCR scan result into history.
   */
  async saveHistoryItem(item: Omit<HistoryItem, 'id' | 'timestamp'>): Promise<HistoryItem> {
    try {
      const current = await this.getHistory();
      
      const newItem: HistoryItem = {
        ...item,
        id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
        timestamp: Date.now(),
      };

      const updated = [newItem, ...current];
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return newItem;
    } catch (err) {
      console.error('HistoryService: Failed to save history item', err);
      throw err;
    }
  }

  /**
   * Deletes a specific history item by ID.
   */
  async deleteHistoryItem(id: string): Promise<void> {
    try {
      const current = await this.getHistory();
      const updated = current.filter(item => item.id !== id);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error(`HistoryService: Failed to delete history item ${id}`, err);
      throw err;
    }
  }

  /**
   * Clears all scan history.
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (err) {
      console.error('HistoryService: Failed to clear history', err);
      throw err;
    }
  }
}

export const historyService = new HistoryService();
