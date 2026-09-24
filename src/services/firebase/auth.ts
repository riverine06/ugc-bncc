export {
  authService,
  resolveUserRole,
  hasAdminPrivileges,
  hasEditorPrivileges,
  AUTHORIZED_ADMIN_EMAILS
} from "../auth";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateEmail,
  updatePassword
} from "firebase/auth";
import { auth } from "../../firebase";

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  auth
};
export type { FirebaseUser };
