/**
 * meshUtils.ts — Canonical Room ID utilities for SafeConnect
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  SINGLE SOURCE OF TRUTH for private room ID generation.        │
 * │  ALL files (MeshChatScreen, chatService, BLEMeshService) MUST   │
 * │  import from here. NEVER compute room IDs inline elsewhere.    │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * The algorithm:
 *   1. Strip every non-digit character from the identifier.
 *   2. Keep only the LAST 10 digits (removes country codes like +91).
 *   3. If the result is empty (UUID or non-numeric id), keep original.
 *   4. Sort the two normalised identifiers lexicographically.
 *   5. Join with '_' and prefix with 'room_'.
 *
 * This guarantees that:
 *   normaliseId('+919876543210')  === normaliseId('9876543210')
 *   normaliseId('00919876543210') === normaliseId('9876543210')
 *
 * Both sides of a conversation always arrive at the SAME key, regardless
 * of whether the number is stored with or without a country code.
 */

/**
 * Normalise a phone-number or user-id to a stable 10-digit string.
 * For non-numeric identifiers (UUIDs) the raw value is returned as-is
 * so they still participate in deterministic sorting.
 */
export function normaliseId(raw: string): string {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length >= 10) {
        // Country-code aware: keep the last 10 digits
        return digits.slice(-10);
    }
    // Not a phone number — return raw (handles UUID-style userIds)
    return raw.trim();
}

/**
 * Compute the canonical private chat room ID shared by exactly two
 * participants, independent of which device calls this first.
 *
 * @param idA  Phone number or userId of participant A
 * @param idB  Phone number or userId of participant B
 * @returns    e.g. "room_9876543210_9123456789"
 */
export function canonicalRoomId(idA: string, idB: string): string {
    const a = normaliseId(idA);
    const b = normaliseId(idB);

    if (!a || !b) {
        console.warn('[meshUtils] canonicalRoomId called with empty id(s):', { idA, idB });
        return 'room_unknown';
    }

    return `room_${[a, b].sort().join('_')}`;
}
