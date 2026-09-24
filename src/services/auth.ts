import { auth } from "../firebase";
import {
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  IdTokenResult
} from "firebase/auth";
import { UserRole } from "../types";

/**
 * Authorized bootstrap admin emails.
 * These map to Super Admin access in conjunction with verified Firebase Authentication.
 */
export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = Object.freeze([
  "faisal.ab4303@gmail.com",
  "faisal.ab43035@gmail.com",
  "admin@ugcbncc.org"
]);

/**
 * Resolves the authenticated user's role using Firebase Auth Custom Claims,
 * with fallback to the verified bootstrap administrators list.
 */
export async function resolveUserRole(firebaseUser: FirebaseUser): Promise<UserRole> {
  try {
    // 1. Inspect Firebase Auth Custom Claims (server-authoritative claims)
    const tokenResult: IdTokenResult = await firebaseUser.getIdTokenResult();
    const claimRole = (tokenResult.claims.role as string | undefined)?.toUpperCase();
    const isClaimAdmin = Boolean(tokenResult.claims.admin);

    if (claimRole === "SUPER_ADMIN" || claimRole === UserRole.SUPER_ADMIN.toUpperCase()) {
      return UserRole.SUPER_ADMIN;
    }
    if (claimRole === "ADMIN" || claimRole === UserRole.ADMIN.toUpperCase() || isClaimAdmin) {
      return UserRole.ADMIN;
    }
    if (claimRole === "EDITOR" || claimRole === UserRole.EDITOR.toUpperCase()) {
      return UserRole.EDITOR;
    }
    if (claimRole === "VIEWER" || claimRole === UserRole.VIEWER.toUpperCase()) {
      return UserRole.VIEWER;
    }

    // 2. Check verified admin bootstrap emails
    const emailLower = (firebaseUser.email || "").toLowerCase().trim();
    if (AUTHORIZED_ADMIN_EMAILS.includes(emailLower)) {
      return UserRole.SUPER_ADMIN;
    }

    return UserRole.ACTIVE_CADET;
  } catch (err) {
    console.warn("[authService] Failed to resolve token claims, using bootstrap check:", err);
    const emailLower = (firebaseUser.email || "").toLowerCase().trim();
    if (AUTHORIZED_ADMIN_EMAILS.includes(emailLower)) {
      return UserRole.SUPER_ADMIN;
    }
    return UserRole.ACTIVE_CADET;
  }
}

export function hasAdminPrivileges(role?: UserRole | null): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

export function hasEditorPrivileges(role?: UserRole | null): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.EDITOR
  );
}

export const authService = {
  subscribeToAuth: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  signInWithGoogle: async (): Promise<FirebaseUser> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  signInWithCredentials: async (email: string, pass: string): Promise<FirebaseUser> => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return result.user;
  },

  signOutUser: async (): Promise<void> => {
    await signOut(auth);
  },

  resolveUserRole,
  hasAdminPrivileges,
  hasEditorPrivileges,

  isEmailAdmin: (email: string): boolean => {
    return AUTHORIZED_ADMIN_EMAILS.includes(email.toLowerCase().trim());
  }
};

