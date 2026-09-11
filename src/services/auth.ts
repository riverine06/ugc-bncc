import { auth } from "../firebase";
import {
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

export const authService = {
  subscribeToAuth: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  signInWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      console.error("Google sign in error:", error);
      throw error;
    }
  },

  signOutUser: async () => {
    await signOut(auth);
  },

  isEmailAdmin: (email: string): boolean => {
    return email === "faisal.ab4303@gmail.com" || email === "admin@ugcbncc.org";
  }
};
