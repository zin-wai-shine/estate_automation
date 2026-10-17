// IndexedDB Storage Engine for Crop & Cut Studio
// Stores actual image Blobs locally in browser storage so images survive page reloads
// and never break even if deleted from the user's local hard drive or external drive.

import type { StudioImage } from './WatermarkView';

const DB_NAME = 'BoltHavenCropStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'studio_session_photos';

export interface StoredStudioPhoto {
  id: string;
  session: 'standard' | 'grid';
  name: string;
  width?: number;
  height?: number;
  blob?: Blob;
  dataUrl?: string;
  updatedAt: number;
}

const openStudioDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('session', 'session', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Save an uploaded image Blob and metadata into IndexedDB
 */
export const savePhotoToIndexedDB = async (
  session: 'standard' | 'grid',
  image: StudioImage,
  fileBlob?: Blob
): Promise<void> => {
  try {
    const db = await openStudioDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    let blobToStore = fileBlob;

    // If fileBlob wasn't passed directly, try to fetch it if url is a blob/data URL
    if (!blobToStore && image.url) {
      try {
        const res = await fetch(image.originalUrl || image.url);
        blobToStore = await res.blob();
      } catch (e) {
        // Sample or external remote photo
      }
    }

    const record: StoredStudioPhoto = {
      id: image.id,
      session,
      name: image.name,
      width: image.width,
      height: image.height,
      blob: blobToStore,
      updatedAt: Date.now(),
    };

    store.put(record);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to save photo to IndexedDB:', err);
  }
};

/**
 * Load all stored photos for a session from IndexedDB and regenerate valid blob URLs
 */
export const loadPhotosFromIndexedDB = async (
  session: 'standard' | 'grid'
): Promise<StudioImage[]> => {
  try {
    const db = await openStudioDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('session');
    const request = index.getAll(IDBKeyRange.only(session));

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const records = request.result as StoredStudioPhoto[];
        if (!records || records.length === 0) {
          resolve([]);
          return;
        }

        // Sort by updatedAt
        records.sort((a, b) => a.updatedAt - b.updatedAt);

        const restored: StudioImage[] = records.map((rec) => {
          let objectUrl = '';
          if (rec.blob) {
            objectUrl = URL.createObjectURL(rec.blob);
          }
          return {
            id: rec.id,
            name: rec.name,
            width: rec.width,
            height: rec.height,
            url: objectUrl || '',
            originalUrl: objectUrl || '',
          };
        }).filter((img) => Boolean(img.url)); // only keep valid items with existing blob bytes

        resolve(restored);
      };

      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Failed to load photos from IndexedDB:', err);
    return [];
  }
};

/**
 * Delete a photo from IndexedDB by id
 */
export const deletePhotoFromIndexedDB = async (id: string): Promise<void> => {
  try {
    const db = await openStudioDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.warn('Failed to delete photo from IndexedDB:', err);
  }
};

/**
 * Clear all photos for a session from IndexedDB
 */
export const clearSessionPhotosFromIndexedDB = async (
  session: 'standard' | 'grid'
): Promise<void> => {
  try {
    const db = await openStudioDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('session');
    const request = index.openCursor(IDBKeyRange.only(session));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch (err) {
    console.warn('Failed to clear session photos from IndexedDB:', err);
  }
};
