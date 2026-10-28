const GLOBAL_REF_KEY = 'bolthaven_ref_img_global_fb_hero';
const DELETED_FLAG_KEY = 'bolthaven_ref_img_explicitly_deleted';
const IDB_NAME = 'BoltHavenReferenceImageDB';
const IDB_STORE = 'reference_images';
const COMPANION_URL = 'http://127.0.0.1:9224/reference-image';

const memoryCache: Record<string, string> = {};

function getBoxKey(boxId?: string): string {
  return boxId ? `bolthaven_ref_img_${boxId}` : GLOBAL_REF_KEY;
}

export function isReferenceImageExplicitlyDeleted(): boolean {
  try {
    return localStorage.getItem(DELETED_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

function setExplicitlyDeleted(deleted: boolean): void {
  try {
    localStorage.setItem(DELETED_FLAG_KEY, deleted ? 'true' : 'false');
  } catch { }
}

function openRefImageDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string> {
  const db = await openRefImageDB();
  if (!db) return '';
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : '');
      req.onerror = () => resolve('');
    } catch {
      resolve('');
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openRefImageDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openRefImageDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Compress large data URLs so they comfortably fit in localStorage (<300KB)
 * and workflow JSON payloads while maintaining sharp visual layout quality.
 */
export async function optimizeReferenceImageDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || typeof window === 'undefined') return dataUrl || '';
  // If already compact (< 350KB), keep as-is
  if (dataUrl.length < 350 * 1024) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let width = img.naturalWidth || img.width || 1080;
          let height = img.naturalHeight || img.height || 1350;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          resolve(compressed && compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Synchronously retrieve the persisted Reference Image from memory or localStorage.
 */
export function getPersistedReferenceImage(boxId?: string): string {
  if (isReferenceImageExplicitlyDeleted()) {
    return '';
  }
  const boxKey = getBoxKey(boxId);
  if (memoryCache[boxKey]) return memoryCache[boxKey];
  if (memoryCache[GLOBAL_REF_KEY]) return memoryCache[GLOBAL_REF_KEY];

  try {
    if (boxId) {
      const byBox = localStorage.getItem(boxKey);
      if (byBox) {
        memoryCache[boxKey] = byBox;
        return byBox;
      }
    }
    const globalImg = localStorage.getItem(GLOBAL_REF_KEY);
    if (globalImg) {
      memoryCache[GLOBAL_REF_KEY] = globalImg;
      return globalImg;
    }
  } catch { }
  return '';
}

/**
 * Asynchronously retrieve the persisted Reference Image from memory, localStorage,
 * IndexedDB, or macOS Companion disk storage.
 */
export async function loadPersistedReferenceImageAsync(boxId?: string): Promise<string> {
  if (isReferenceImageExplicitlyDeleted()) {
    return '';
  }

  const syncVal = getPersistedReferenceImage(boxId);
  if (syncVal) return syncVal;

  const boxKey = getBoxKey(boxId);

  // Check IndexedDB
  if (boxId) {
    const idbBoxVal = await idbGet(boxKey);
    if (idbBoxVal) {
      memoryCache[boxKey] = idbBoxVal;
      memoryCache[GLOBAL_REF_KEY] = idbBoxVal;
      try {
        localStorage.setItem(boxKey, idbBoxVal);
        localStorage.setItem(GLOBAL_REF_KEY, idbBoxVal);
      } catch { }
      return idbBoxVal;
    }
  }

  const idbGlobalVal = await idbGet(GLOBAL_REF_KEY);
  if (idbGlobalVal) {
    memoryCache[GLOBAL_REF_KEY] = idbGlobalVal;
    if (boxId) memoryCache[boxKey] = idbGlobalVal;
    try {
      localStorage.setItem(GLOBAL_REF_KEY, idbGlobalVal);
      if (boxId) localStorage.setItem(boxKey, idbGlobalVal);
    } catch { }
    return idbGlobalVal;
  }

  // Check macOS Companion disk cache
  try {
    const resp = await fetch(COMPANION_URL);
    if (resp.ok) {
      const data = await resp.json();
      if (data && typeof data.reference_image === 'string' && data.reference_image.length > 0) {
        const img = data.reference_image;
        memoryCache[GLOBAL_REF_KEY] = img;
        if (boxId) memoryCache[boxKey] = img;
        try {
          localStorage.setItem(GLOBAL_REF_KEY, img);
          if (boxId) localStorage.setItem(boxKey, img);
        } catch { }
        await idbSet(GLOBAL_REF_KEY, img);
        if (boxId) await idbSet(boxKey, img);
        return img;
      }
    }
  } catch { }

  return '';
}

/**
 * Save a newly uploaded Reference Image permanently across memory, localStorage,
 * IndexedDB, and macOS Companion disk storage until changed or removed.
 */
export async function savePersistedReferenceImage(rawDataUrl: string, boxId?: string): Promise<string> {
  if (!rawDataUrl) return '';
  setExplicitlyDeleted(false);

  const optimized = await optimizeReferenceImageDataUrl(rawDataUrl);
  const boxKey = getBoxKey(boxId);

  memoryCache[GLOBAL_REF_KEY] = optimized;
  memoryCache[boxKey] = optimized;

  try {
    localStorage.setItem(GLOBAL_REF_KEY, optimized);
    if (boxId) {
      localStorage.setItem(boxKey, optimized);
    }
  } catch (e) {
    console.warn('localStorage quota warning while saving referenceImage (falling back to IndexedDB + Companion):', e);
  }

  await idbSet(GLOBAL_REF_KEY, optimized);
  if (boxId) {
    await idbSet(boxKey, optimized);
  }

  try {
    await fetch(COMPANION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_image: optimized,
        box_id: boxId || '',
      }),
    });
  } catch { }

  return optimized;
}

/**
 * Explicitly remove the Reference Image when the user clicks "Remove".
 */
export async function clearPersistedReferenceImage(boxId?: string): Promise<void> {
  setExplicitlyDeleted(true);

  const boxKey = getBoxKey(boxId);
  delete memoryCache[GLOBAL_REF_KEY];
  delete memoryCache[boxKey];
  for (const k of Object.keys(memoryCache)) {
    delete memoryCache[k];
  }

  try {
    localStorage.removeItem(GLOBAL_REF_KEY);
    if (boxId) {
      localStorage.removeItem(boxKey);
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('bolthaven_ref_img_') && k !== DELETED_FLAG_KEY) {
        localStorage.removeItem(k);
      }
    }
  } catch { }

  await idbDelete(GLOBAL_REF_KEY);
  if (boxId) {
    await idbDelete(boxKey);
  }

  try {
    await fetch(COMPANION_URL, {
      method: 'DELETE',
    });
  } catch { }
}

