/**
 * KisanSync — Persistent Offline Storage Layer
 *
 * Utilises IndexedDB for persistent, structured queue storage that survives
 * browser restarts, page reloads, and network dropouts.
 * Transparently falls back to localStorage when IndexedDB is unavailable (SSR,
 * restricted webviews, unit test environments).
 */

import type { QueuedOfflineRequest } from "./types";

const DB_NAME = "kisansync_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "offline_queue";
const FALLBACK_KEY = "kisansync_offline_queue_v1";
const SYNC_TIME_KEY = "kisansync_last_known_sync_time";

function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error("IndexedDB unavailable"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "requestId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let memoryQueueFallback: QueuedOfflineRequest[] = [];
let memorySyncTimeFallback: number = Date.now();

// ---------------------------------------------------------------------------
// Fallback LocalStorage & In-Memory Handlers
// ---------------------------------------------------------------------------

function readFallbackQueue(): QueuedOfflineRequest[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [...memoryQueueFallback];
  }
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallbackQueue(queue: QueuedOfflineRequest[]): void {
  memoryQueueFallback = [...queue];
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(queue));
  } catch {
    // Quota exceeded or private browsing
  }
}

// ---------------------------------------------------------------------------
// Public Persistent Offline Queue API
// ---------------------------------------------------------------------------

export async function getQueuedRequests(): Promise<QueuedOfflineRequest[]> {
  if (!isIndexedDBAvailable()) {
    return readFallbackQueue();
  }

  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as QueuedOfflineRequest[];
        // Sort oldest first (FIFO queue)
        results.sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return readFallbackQueue();
  }
}

export async function saveQueuedRequest(req: QueuedOfflineRequest): Promise<void> {
  // Always update fallback for instant sync/resilience
  const currentFallback = readFallbackQueue().filter((r) => r.requestId !== req.requestId);
  currentFallback.push(req);
  writeFallbackQueue(currentFallback);

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(req);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch {
    // Continue with localStorage fallback
  }
}

export async function updateQueuedRequest(
  requestId: string,
  updates: Partial<QueuedOfflineRequest>,
): Promise<void> {
  const currentFallback = readFallbackQueue();
  const index = currentFallback.findIndex((r) => r.requestId === requestId);
  if (index >= 0) {
    currentFallback[index] = {
      ...currentFallback[index],
      ...updates,
      updatedAt: Date.now(),
    };
    writeFallbackQueue(currentFallback);
  }

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(requestId);
      getReq.onsuccess = () => {
        if (!getReq.result) return resolve();
        const updated = { ...getReq.result, ...updates, updatedAt: Date.now() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    // Continue with localStorage fallback
  }
}

export async function deleteQueuedRequest(requestId: string): Promise<void> {
  const currentFallback = readFallbackQueue().filter((r) => r.requestId !== requestId);
  writeFallbackQueue(currentFallback);

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const delReq = store.delete(requestId);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
    });
  } catch {
    // Continue with fallback
  }
}

export function getLastKnownSyncTime(): number {
  if (typeof window === "undefined" || !window.localStorage) {
    return memorySyncTimeFallback;
  }
  try {
    const val = window.localStorage.getItem(SYNC_TIME_KEY);
    return val ? parseInt(val, 10) || memorySyncTimeFallback : memorySyncTimeFallback;
  } catch {
    return memorySyncTimeFallback;
  }
}

export function setLastKnownSyncTime(timestamp: number): void {
  memorySyncTimeFallback = timestamp;
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(SYNC_TIME_KEY, timestamp.toString());
  } catch {
    // ignore
  }
}
