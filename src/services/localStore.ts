import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocalStore } from './storage';

/** Local metadata only. OAuth credentials must use secure native storage, never this store. */
export const localStore = createLocalStore(AsyncStorage);
