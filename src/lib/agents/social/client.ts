/**
 * Exports client-safe (pas de server-only) — pour chat-client et composants "use client".
 */
export { detectSocialSignal, isSocialSignalKind } from "./social-signal-detector";
export { isHoldOnlyReply, sanitizeHoldReply } from "./hold-reply-sanitizer";
export type { SocialSignalKind } from "./types";
