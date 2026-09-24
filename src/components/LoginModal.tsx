/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { Shield, Key, Mail, X } from "lucide-react";
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { User, UserRole, Member, MemberStatus } from "../types";
import { authService } from "../services/auth";

interface LoginModalProps {
  onClose: () => void;
  onLoginSuccess: (token: string, user: any, member: any) => void;
}

export default function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate strictly through Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        throw new Error("Authentication failed: No valid user returned.");
      }

      // 2. Resolve authoritative role via Custom Claims / verified admin list
      const role = await authService.resolveUserRole(firebaseUser);

      // 3. Look up associated cadet dossier if applicable
      const emailLower = (firebaseUser.email || "").toLowerCase().trim();
      let loggedMember: Member | null = null;
      try {
        const querySnap = await getDocs(query(collection(db, "cadets"), where("email", "==", emailLower)));
        if (!querySnap.empty) {
          loggedMember = querySnap.docs[0].data() as Member;
        }
      } catch (e) {
        console.warn("[LoginModal] Could not load cadet record:", e);
      }

      const loggedUser: User = {
        id: firebaseUser.uid,
        email: emailLower,
        role,
        memberId: loggedMember?.id || null,
        createdAt: firebaseUser.metadata.creationTime || new Date().toISOString()
      };

      onLoginSuccess(firebaseUser.uid, loggedUser, loggedMember);
      onClose();
    } catch (err: any) {
      console.error("[LoginModal] Authentication failure:", err);
      let friendlyMessage = "Invalid command email or password credential.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        friendlyMessage = "Access denied: Invalid email or password credentials.";
      } else if (err.code === "auth/too-many-requests") {
        friendlyMessage = "Security alert: Too many failed login attempts. Please wait before retrying.";
      } else if (err.code === "auth/user-disabled") {
        friendlyMessage = "This command account has been deactivated by Platoon administration.";
      } else if (err.code === "auth/network-request-failed") {
        friendlyMessage = "Network error: Unable to contact Firebase Authentication service.";
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      // 1. Authenticate through Google OAuth via Firebase
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        throw new Error("Google authentication failed.");
      }

      // 2. Resolve authoritative role
      const role = await authService.resolveUserRole(firebaseUser);

      // 3. Look up associated cadet dossier if applicable
      const emailLower = (firebaseUser.email || "").toLowerCase().trim();
      let loggedMember: Member | null = null;
      try {
        const querySnap = await getDocs(query(collection(db, "cadets"), where("email", "==", emailLower)));
        if (!querySnap.empty) {
          loggedMember = querySnap.docs[0].data() as Member;
        }
      } catch (e) {
        console.warn("[LoginModal] Could not load cadet record:", e);
      }

      const loggedUser: User = {
        id: firebaseUser.uid,
        email: emailLower,
        role,
        memberId: loggedMember?.id || null,
        createdAt: firebaseUser.metadata.creationTime || new Date().toISOString()
      };

      onLoginSuccess(firebaseUser.uid, loggedUser, loggedMember);
      onClose();
    } catch (err: any) {
      if (err.code === "auth/popup-blocked" || err.message?.includes("popup-blocked")) {
        console.warn("Popup blocked by browser. Attempting redirect sign-in...");
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          setError("Google Sign-In popup was blocked by your browser settings. Please allow popups or log in using Email & Password.");
        }
      } else {
        setError(err.message || "Google authentication failed.");
      }
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-xl border-4 border-[#124632] dark:border-[#FFB703] overflow-hidden shadow-2xl max-w-sm w-full relative cursor-default max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-[#124632] text-white p-5 flex justify-between items-center border-b-2 border-[#FFB703] shrink-0">
          <div className="flex items-center space-x-2.5">
            <Shield className="h-5 w-5 text-[#FFB703]" />
            <h3 className="font-display font-extrabold text-sm tracking-wider uppercase">
              SECURE COMMAND LOGIN
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white font-mono text-xs cursor-pointer">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Login Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-900 dark:text-red-200 p-2.5 rounded font-mono text-[10.5px]">
              {error}
            </div>
          )}



          <div className="space-y-1">
            <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Registered Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="e.g., admin@ugcbncc.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-8 pr-3 text-xs w-full text-slate-900 dark:text-white focus:outline-none focus:border-[#124632] dark:focus:border-[#FFB703]"
              />
              <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Command Password</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-8 pr-3 text-xs w-full text-slate-900 dark:text-white focus:outline-none focus:border-[#124632] dark:focus:border-[#FFB703]"
              />
              <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#124632] hover:bg-[#0c3123] text-white font-display font-bold py-3 rounded uppercase tracking-wider transition-colors shadow mt-2 cursor-pointer"
          >
            {loading ? "AUTHENTICATING SECURITY KEY..." : "TRANSMIT ACCESS KEY"}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] font-mono text-slate-400 uppercase">OR</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-display font-semibold py-2.5 rounded flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.67-.35-1.37-.35-2.08z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>SIGN IN WITH GOOGLE</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
