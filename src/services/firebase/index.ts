/**
 * Unified Firebase Modular Architecture
 * Each domain is decoupled into its own service module while preserving backward compatibility.
 */

export * from "./firestore";
export * from "./audit";
export * from "./achievements";
export * from "./recycleBin";
export * from "./members";
export * from "./events";
export * from "./applications";
export * from "./announcements";
export * from "./gallery";
export * from "./documents";
export * from "./settings";
export * from "./storage";
export * from "./auth";
export * from "./stats";

import { initializeDatabase as safeInitializeDatabase } from "../dbInit";

export async function initializeDatabase(options?: { force?: boolean }) {
  return safeInitializeDatabase(options);
}
