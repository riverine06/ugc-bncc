/**
 * Legacy Firebase Service entrypoint.
 * Preserves 100% backward compatibility for all existing imports across the application
 * while delegating domain responsibilities to modular services in /src/services/firebase/.
 */

export * from "./services/firebase";
