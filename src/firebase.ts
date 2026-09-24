import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent } from "firebase/analytics";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Fallback config from firebase-applet-config.json
const fallbackConfig = {
  apiKey: "AIzaSyAb5wVn4gy-PmLb-p-ZdezjXn22iPOWGA8",
  authDomain: "gen-lang-client-0233535895.firebaseapp.com",
  projectId: "gen-lang-client-0233535895",
  storageBucket: "gen-lang-client-0233535895.firebasestorage.app",
  messagingSenderId: "406307047168",
  appId: "1:406307047168:web:4cc14e0cefe7b1957595e5",
  firestoreDatabaseId: "ai-studio-ugcbnccdigitalpl-bcdfeb8d-9afe-4d17-b1d1-4a7c911c8a6d"
};

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || "",
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth & Firestore with robust persistent offline caching
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, fallbackConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error handling helper
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Firebase Storage
export const storage = getStorage(app);

import { sanitizeFilename, sanitizeStorageFolder, formatStorageErrorMessage } from "./utils/fileValidation";

/**
 * Uploads a file to Firebase Storage with resilient progress reporting,
 * filename/path sanitization, and timeout handling.
 * @param file The file or blob to upload.
 * @param folder The target folder (e.g., 'cadets', 'gallery', 'images', 'documents').
 * @param filename Optional custom filename (will be sanitized).
 * @param onProgress Optional callback for progress percentage (0 - 100).
 */
export const uploadFileToStorage = (
  file: File | Blob,
  folder: string,
  filename?: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const cleanFolder = sanitizeStorageFolder(folder);
      const originalName = filename || (file instanceof File ? file.name : "upload.bin");
      const cleanName = sanitizeFilename(originalName);
      
      const storageRef = ref(storage, `${cleanFolder}/${cleanName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      let isSettled = false;
      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            uploadTask.cancel();
          } catch (e) {
            // ignore cancel error
          }
          reject(new Error("Firebase Storage connection timed out (20s). Please check your internet connection."));
        }
      }, 20000);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress(Math.min(99, Math.round(progress)));
            }
          }
        },
        (error) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            console.error("Firebase Storage Upload Error:", error);
            const userFriendlyMsg = formatStorageErrorMessage(error);
            reject(new Error(userFriendlyMsg));
          }
        },
        async () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            try {
              if (onProgress) onProgress(100);
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            } catch (err) {
              reject(new Error(formatStorageErrorMessage(err)));
            }
          }
        }
      );
    } catch (err) {
      reject(new Error(formatStorageErrorMessage(err)));
    }
  });
};

/**
 * Deletes a file from Firebase Storage given its download URL or storage path.
 * Handles missing objects and errors gracefully without throwing.
 * @param url The public download URL or storage reference path.
 */
export const deleteFileFromStorage = async (url: string): Promise<void> => {
  if (!url || typeof url !== "string") return;
  if (!url.startsWith("http") && !url.startsWith("gs://")) return;
  
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
    console.log(`[Firebase Storage] File deleted successfully: ${url}`);
  } catch (err: any) {
    // If file is already deleted or not found, it's not a failure
    if (err?.code === "storage/object-not-found") {
      console.log(`[Firebase Storage] Object already purged from storage: ${url}`);
      return;
    }
    console.warn(`[Firebase Storage] Could not delete file: ${url}`, err?.message || err);
  }
};

// Safe Firebase Analytics helper
export let analytics: any = null;
isAnalyticsSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((err) => {
  console.warn("Firebase Analytics not supported in this environment:", err);
});

// Safe Firebase Messaging helper
export let messaging: any = null;
export const initMessaging = async () => {
  try {
    const supported = await isMessagingSupported();
    if (supported) {
      messaging = getMessaging(app);
      return messaging;
    }
  } catch (err) {
    console.warn("Firebase Messaging not supported in this environment:", err);
  }
  return null;
};

// Analytics helper to safely log events
export const logFirebaseEvent = async (eventName: string, params?: Record<string, any>) => {
  try {
    const supported = await isAnalyticsSupported();
    if (supported && analytics) {
      logEvent(analytics, eventName, params);
      console.log(`[Firebase Analytics] Event logged: ${eventName}`, params);
    }
  } catch (err) {
    console.warn("[Firebase Analytics] Error logging event:", err);
  }
};

export default app;

