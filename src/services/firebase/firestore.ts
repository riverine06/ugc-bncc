import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../firebase";

/**
 * Standard unique ID generator for Firestore documents
 */
export function generateId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Executes a Firestore asynchronous operation with automatic retries for transient errors
 */
export async function runWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message?.toLowerCase() || "";
      if (
        errMsg.includes("permission-denied") ||
        errMsg.includes("permission") ||
        errMsg.includes("insufficient permissions") ||
        err?.code === "permission-denied"
      ) {
        throw err;
      }
      console.warn(
        `[FirestoreService] Operation transient failure. Retrying (${i + 1}/${retries}) in ${delayMs * (i + 1)}ms...`,
        err
      );
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

// Hook registry for collection post-update listeners (e.g. rank sync in achievements)
type UpdateHook = (collectionName: string, id: string, data: any) => Promise<void>;
const updateHooks: UpdateHook[] = [];

export function registerUpdateHook(hook: UpdateHook) {
  updateHooks.push(hook);
}

/**
 * Generic document creation with auto-retry and ID generation
 */
export async function createDocument(collectionName: string, data: any, id?: string): Promise<string> {
  const docId = id || data.id || generateId(collectionName.substring(0, 3));
  const path = `${collectionName}/${docId}`;
  try {
    const finalData = { ...data, id: docId };
    return await runWithRetry(async () => {
      await setDoc(doc(db, collectionName, docId), finalData);
      return docId;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

/**
 * Generic document update with auto-retry and post-update hooks
 */
export async function updateDocument(collectionName: string, id: string, data: any): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await runWithRetry(async () => {
      await updateDoc(doc(db, collectionName, id), data);
    });

    for (const hook of updateHooks) {
      try {
        await hook(collectionName, id, data);
      } catch (hookErr) {
        console.warn(`[FirestoreService] Update hook warning for ${collectionName}/${id}:`, hookErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

/**
 * Generic document deletion with auto-retry
 */
export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await runWithRetry(async () => {
      await deleteDoc(doc(db, collectionName, id));
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Single document fetch with auto-retry
 */
export async function getSingleDocument(collectionName: string, id: string): Promise<any> {
  const docRef = doc(db, collectionName, id);
  const path = `${collectionName}/${id}`;
  try {
    return await runWithRetry(async () => {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

/**
 * Single document set (upsert) with merge option and auto-retry
 */
export async function setSingleDocument(collectionName: string, id: string, data: any): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    await runWithRetry(async () => {
      await setDoc(doc(db, collectionName, id), data, { merge: true });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

interface SharedSubscriptionEntry {
  unsubscribe: () => void;
  listeners: Set<(items: any[]) => void>;
  lastData: any[] | null;
  cleanupTimer: any;
}

const sharedSubscriptions = new Map<string, SharedSubscriptionEntry>();

/**
 * Real-time collection subscription listener with listener reuse,
 * multicast broadcasting, cached replay, query limits, and grace-period cleanup.
 */
export function subscribeToCollection<T>(collectionName: string, callback: (items: T[]) => void): () => void {
  let entry = sharedSubscriptions.get(collectionName);

  if (!entry) {
    const colRef = collection(db, collectionName);
    let q = query(colRef);
    if (collectionName === "activityLogs") {
      q = query(colRef, orderBy("timestamp", "desc"), limit(100));
    } else if (collectionName === "notices" || collectionName === "news") {
      q = query(colRef, orderBy("date", "desc"), limit(60));
    }

    const listeners = new Set<(items: any[]) => void>();
    listeners.add(callback as (items: any[]) => void);

    const newEntry: SharedSubscriptionEntry = {
      unsubscribe: () => {},
      listeners,
      lastData: null,
      cleanupTimer: null,
    };

    const unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const items: T[] = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        } as any));
        newEntry.lastData = items;
        // Broadcast to all active listeners
        newEntry.listeners.forEach((listener) => {
          try {
            listener(items);
          } catch (err) {
            console.error(`[FirestoreService] Listener error on ${collectionName}:`, err);
          }
        });
      },
      (error) => {
        const isPermissionErr =
          error?.code === "permission-denied" ||
          error?.message?.toLowerCase().includes("permission") ||
          error?.message?.toLowerCase().includes("insufficient");
        if (isPermissionErr) {
          console.warn(
            `[FirestoreService] Restricted collection subscription on '${collectionName}' (insufficient permissions). Defaulting to empty collection.`
          );
          newEntry.lastData = [];
          newEntry.listeners.forEach((listener) => listener([]));
        } else {
          console.error(`[FirestoreService] Subscription error on ${collectionName}:`, error);
        }
      }
    );

    newEntry.unsubscribe = unsubscribeSnapshot;
    sharedSubscriptions.set(collectionName, newEntry);
  } else {
    // Cancel pending teardown if subscriber arrived during grace period
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer);
      entry.cleanupTimer = null;
    }

    entry.listeners.add(callback as (items: any[]) => void);

    // Instant data delivery if already cached (zero network latency / 0 reads)
    if (entry.lastData !== null) {
      try {
        callback(entry.lastData as T[]);
      } catch (err) {
        console.error(`[FirestoreService] Cached replay callback error on ${collectionName}:`, err);
      }
    }
  }

  // Return unregister callback for this specific subscriber
  return () => {
    const currentEntry = sharedSubscriptions.get(collectionName);
    if (!currentEntry) return;

    currentEntry.listeners.delete(callback as (items: any[]) => void);

    // If no more listeners remain, keep connection alive for 6s grace period to survive route transitions
    if (currentEntry.listeners.size === 0) {
      if (currentEntry.cleanupTimer) {
        clearTimeout(currentEntry.cleanupTimer);
      }
      currentEntry.cleanupTimer = setTimeout(() => {
        if (currentEntry.listeners.size === 0) {
          currentEntry.unsubscribe();
          sharedSubscriptions.delete(collectionName);
        }
      }, 6000);
    }
  };
}
