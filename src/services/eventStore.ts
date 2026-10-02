import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrivacyDataset } from '../types';
import { emptyImportedDataset, ImportedEventStore, mergeImportedDatasets } from './eventStore.types';

const KEY = 'ipward:imported-events:web:v1';
/** Browser preview fallback. Native devices use the SQLite implementation. */
export const importedEventStore: ImportedEventStore = {
  async load(retentionDays) {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyImportedDataset();
    const parsed = JSON.parse(raw) as PrivacyDataset;
    return mergeImportedDatasets(emptyImportedDataset(), parsed, retentionDays);
  },
  async merge(dataset, retentionDays) {
    const result = mergeImportedDatasets(await this.load(retentionDays), dataset, retentionDays);
    const serialized = JSON.stringify(result);
    if (serialized.length > 2_000_000) throw new Error('Browser storage limit reached. Import this report in the mobile app.');
    await AsyncStorage.setItem(KEY, serialized);
    return result;
  },
  async clear() { await AsyncStorage.removeItem(KEY); },
};
