import { initMessaging } from "../firebase";
import { getToken, onMessage } from "firebase/messaging";

/**
 * Service to manage Firebase Cloud Messaging (Modular and Extensible)
 */
export const messagingService = {
  /**
   * Request user permission for push notifications
   * and retrieve the registration token.
   */
  requestPermissionAndGetToken: async (vapidKey?: string): Promise<string | null> => {
    try {
      if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notifications.");
        return null;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Push notification permission denied.");
        return null;
      }

      const fcmInstance = await initMessaging();
      if (!fcmInstance) {
        console.warn("Firebase Messaging not supported in this client environment.");
        return null;
      }

      // Retrieve FCM Token
      const token = await getToken(fcmInstance, {
        vapidKey: vapidKey || undefined, // Provide VAPID key from Firebase Console if needed
      });

      if (token) {
        console.log("[FCM Service] Token successfully retrieved:", token);
        // Save token to localStorage or database so backend can target this user
        localStorage.setItem("ugc_bncc_fcm_token", token);
        return token;
      } else {
        console.warn("[FCM Service] No registration token available. Request permission to generate one.");
        return null;
      }
    } catch (err) {
      console.error("[FCM Service] Error getting registration token:", err);
      return null;
    }
  },

  /**
   * Set up on-message listener for foreground notifications
   */
  onForegroundMessage: async (callback: (payload: any) => void) => {
    try {
      const fcmInstance = await initMessaging();
      if (!fcmInstance) return null;

      const unsubscribe = onMessage(fcmInstance, (payload) => {
        console.log("[FCM Service] Foreground message received:", payload);
        callback(payload);
      });

      return unsubscribe;
    } catch (err) {
      console.warn("[FCM Service] Error setting up foreground message handler:", err);
      return null;
    }
  },

  /**
   * Safe helper to check if notification permissions are already granted
   */
  checkPermissionStatus: (): string => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  }
};
