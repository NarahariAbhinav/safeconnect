/**
 * sos.ts — Offline-first SOS & Disaster Coordination Service
 *
 * Architecture: Store-first, Sync-when-possible (DTN pattern)
 *
 *  1. Everything is saved to AsyncStorage IMMEDIATELY (works offline)
 *  2. A sync-queue accumulates records to upload
 *  3. When internet is detected, the queue is flushed to Firebase
 *  4. Government dashboard reads from Firebase
 *
 * Features:
 *  • SOS activation / deactivation
 *  • "I Need Help" needs report
 *  • "I Can Help" resource offer
 *  • Relief camp cache
 *  • Sync queue for Firebase upload
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────────────

export type NeedCategory = 'food' | 'water' | 'medicine' | 'shelter' | 'rescue' | 'medical_help';
export type ResourceCategory = 'food' | 'water' | 'medicine' | 'shelter' | 'vehicle' | 'medical_skills' | 'space';

export interface GpsPoint {
    latitude: number;
    longitude: number;
    address?: string;
}

export interface SOSRecord {
    id: string;
    userId: string;
    userName: string;
    gps: GpsPoint;
    activatedAt: number;
    deactivatedAt?: number;
    isActive: boolean;
    contactsNotified: string[];   // contact IDs notified
    synced: boolean;
}

export interface NeedsReport {
    id: string;
    userId: string;
    userName: string;
    gps: GpsPoint;
    needs: NeedCategory[];
    peopleCount: number;          // how many people need help
    notes?: string;
    reportedAt: number;
    fulfilled: boolean;
    synced: boolean;
}

export interface ResourceOffer {
    id: string;
    userId: string;
    userName: string;
    gps: GpsPoint;
    resources: ResourceCategory[];
    capacity?: number;            // e.g. vehicle seats, shelter space
    notes?: string;
    offeredAt: number;
    synced: boolean;
}

export interface ReliefCamp {
    id: string;
    name: string;
    gps: GpsPoint;
    hasFood: boolean;
    hasWater: boolean;
    hasMedical: boolean;
    capacity: number;
    currentOccupancy?: number;
    addedAt: number;
}

export type SyncQueueItem =
    | { type: 'sos'; data: SOSRecord }
    | { type: 'needs'; data: NeedsReport }
    | { type: 'resource'; data: ResourceOffer };

// ─── Govt Action (response from EOC to user) ─────────────────────────────────
export interface GovtAction {
    sosId: string;
    status: 'rescue_dispatched' | 'camp_assigned' | 'acknowledged' | 'resolved';
    message: string;            // Human-readable update for the user
    dispatchedAt: number;       // Timestamp from govt EOC
    campName?: string;          // If a camp is assigned
    campAddress?: string;
    officerName?: string;
    estimatedArrival?: string;  // e.g. "20 minutes"
}

// ─── Storage Keys ───────────────────────────────────────────────────────
const KEY_ACTIVE_SOS = 'safeconnect_active_sos';
const KEY_SOS_HISTORY = 'safeconnect_sos_history';
const KEY_NEEDS_REPORTS = 'safeconnect_needs_reports';
const KEY_RESOURCE_OFFERS = 'safeconnect_resource_offers';
const KEY_RELIEF_CAMPS = 'safeconnect_relief_camps';
const KEY_SYNC_QUEUE = 'safeconnect_sync_queue';
const KEY_GOVT_ACTIONS = 'safeconnect_govt_actions';   // cached govt responses (offline)

// ─── Firebase config ──────────────────────────────────────────────────────
// Firebase Realtime Database — Free Tier (Asia Singapore region)
const FIREBASE_URL = 'https://safeconnect-f509c-default-rtdb.asia-southeast1.firebasedatabase.app';

// ─── Helper ─────────────────────────────────────────────────────────────
function genId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Sync Queue ─────────────────────────────────────────────────────────

async function enqueue(item: SyncQueueItem): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(KEY_SYNC_QUEUE);
        const queue: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
        queue.push(item);
        await AsyncStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify(queue));
    } catch { /* storage error — ignore, data still in local record */ }
}

async function flushSyncQueue(): Promise<{ flushed: number; failed: number }> {
    try {
        const raw = await AsyncStorage.getItem(KEY_SYNC_QUEUE);
        if (!raw) return { flushed: 0, failed: 0 };
        const queue: SyncQueueItem[] = JSON.parse(raw);
        if (queue.length === 0) return { flushed: 0, failed: 0 };

        let flushed = 0;
        const remaining: SyncQueueItem[] = [];

        for (const item of queue) {
            try {
                const endpoint = `${FIREBASE_URL}/${item.type}s/${item.data.id}.json`;
                const res = await fetch(endpoint, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...item.data, synced: true }),
                });
                if (res.ok) {
                    flushed++;
                } else {
                    remaining.push(item);
                }
            } catch {
                remaining.push(item); // keep for next attempt
            }
        }

        await AsyncStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify(remaining));
        return { flushed, failed: remaining.length };
    } catch {
        return { flushed: 0, failed: 0 };
    }
}

// ─── SOS ────────────────────────────────────────────────────────────────

async function activateSOS(
    userId: string,
    userName: string,
    gps: GpsPoint,
    contactIds: string[]
): Promise<SOSRecord> {
    const record: SOSRecord = {
        id: genId(),
        userId,
        userName,
        gps,
        activatedAt: Date.now(),
        isActive: true,
        contactsNotified: contactIds,
        synced: false,
    };

    // Save locally first — works 100% offline
    await AsyncStorage.setItem(KEY_ACTIVE_SOS, JSON.stringify(record));

    // Add to history
    const histRaw = await AsyncStorage.getItem(KEY_SOS_HISTORY);
    const history: SOSRecord[] = histRaw ? JSON.parse(histRaw) : [];
    history.unshift(record);
    if (history.length > 50) history.splice(50); // cap history
    await AsyncStorage.setItem(KEY_SOS_HISTORY, JSON.stringify(history));

    // Add to sync queue (will upload when internet available)
    await enqueue({ type: 'sos', data: record });

    // Try immediate sync (fire-and-forget)
    flushSyncQueue().catch(() => { });

    return record;
}

async function deactivateSOS(): Promise<void> {
    const raw = await AsyncStorage.getItem(KEY_ACTIVE_SOS);
    if (!raw) return;
    const record: SOSRecord = JSON.parse(raw);
    record.isActive = false;
    record.deactivatedAt = Date.now();

    await AsyncStorage.removeItem(KEY_ACTIVE_SOS);

    // Update in history
    const histRaw = await AsyncStorage.getItem(KEY_SOS_HISTORY);
    const history: SOSRecord[] = histRaw ? JSON.parse(histRaw) : [];
    const idx = history.findIndex(h => h.id === record.id);
    if (idx >= 0) history[idx] = record;
    await AsyncStorage.setItem(KEY_SOS_HISTORY, JSON.stringify(history));

    // Sync deactivation
    await enqueue({ type: 'sos', data: record });
    flushSyncQueue().catch(() => { });
}

async function getActiveSOS(): Promise<SOSRecord | null> {
    const raw = await AsyncStorage.getItem(KEY_ACTIVE_SOS);
    return raw ? JSON.parse(raw) : null;
}

// ─── Needs Report ────────────────────────────────────────────────────────

async function reportNeeds(
    userId: string,
    userName: string,
    gps: GpsPoint,
    needs: NeedCategory[],
    peopleCount: number,
    notes?: string
): Promise<NeedsReport> {
    const report: NeedsReport = {
        id: genId(),
        userId,
        userName,
        gps,
        needs,
        peopleCount,
        notes,
        reportedAt: Date.now(),
        fulfilled: false,
        synced: false,
    };

    // Save locally
    const raw = await AsyncStorage.getItem(KEY_NEEDS_REPORTS);
    const reports: NeedsReport[] = raw ? JSON.parse(raw) : [];
    reports.unshift(report);
    await AsyncStorage.setItem(KEY_NEEDS_REPORTS, JSON.stringify(reports));

    // Queue for sync
    await enqueue({ type: 'needs', data: report });
    flushSyncQueue().catch(() => { });

    return report;
}

async function getNeedsReports(): Promise<NeedsReport[]> {
    const raw = await AsyncStorage.getItem(KEY_NEEDS_REPORTS);
    return raw ? JSON.parse(raw) : [];
}

// ─── Resource Offer ──────────────────────────────────────────────────────

async function offerResource(
    userId: string,
    userName: string,
    gps: GpsPoint,
    resources: ResourceCategory[],
    capacity?: number,
    notes?: string
): Promise<ResourceOffer> {
    const offer: ResourceOffer = {
        id: genId(),
        userId,
        userName,
        gps,
        resources,
        capacity,
        notes,
        offeredAt: Date.now(),
        synced: false,
    };

    const raw = await AsyncStorage.getItem(KEY_RESOURCE_OFFERS);
    const offers: ResourceOffer[] = raw ? JSON.parse(raw) : [];
    offers.unshift(offer);
    await AsyncStorage.setItem(KEY_RESOURCE_OFFERS, JSON.stringify(offers));

    await enqueue({ type: 'resource', data: offer });
    flushSyncQueue().catch(() => { });

    return offer;
}

// ─── Govt Action ─────────────────────────────────────────────────────────────

/**
 * getGovtAction — tries Firebase first (online),
 * falls back to AsyncStorage cache (offline).
 * Called by SOSScreen every 15s to show the user govt response.
 */
async function getGovtAction(sosId: string): Promise<GovtAction | null> {
    // Try Firebase (with 5s timeout so slow networks don't block)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${FIREBASE_URL}/soss/${sosId}/govtAction.json`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            if (data && data.status) {
                console.log('[GovtAction] ✅ Received from Firebase:', data.status, '-', data.message?.slice(0, 40));
                // Cache it locally for offline use
                const raw = await AsyncStorage.getItem(KEY_GOVT_ACTIONS);
                const cache: Record<string, GovtAction> = raw ? JSON.parse(raw) : {};
                cache[sosId] = data as GovtAction;
                await AsyncStorage.setItem(KEY_GOVT_ACTIONS, JSON.stringify(cache));
                return data as GovtAction;
            } else {
                console.log('[GovtAction] No response yet for SOS:', sosId);
            }
        }
    } catch (e: any) {
        console.log('[GovtAction] Fetch failed (offline?):', e?.message?.slice(0, 50));
    }

    // Offline fallback — return cached action if BLE mesh relayed it
    try {
        const raw = await AsyncStorage.getItem(KEY_GOVT_ACTIONS);
        if (raw) {
            const cache: Record<string, GovtAction> = JSON.parse(raw);
            const cached = cache[sosId] ?? null;
            if (cached) console.log('[GovtAction] Using cached action:', cached.status);
            return cached;
        }
    } catch { /* storage error */ }
    return null;
}

/**
 * storeGovtActionFromMesh — called when BLE mesh delivers a govt action packet
 * to an offline device. Stores it in AsyncStorage so SOSScreen can show it.
 */
async function storeGovtActionFromMesh(action: GovtAction): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(KEY_GOVT_ACTIONS);
        const cache: Record<string, GovtAction> = raw ? JSON.parse(raw) : {};
        cache[action.sosId] = action;
        await AsyncStorage.setItem(KEY_GOVT_ACTIONS, JSON.stringify(cache));
    } catch { /* storage error */ }
}

async function getResourceOffers(): Promise<ResourceOffer[]> {
    const raw = await AsyncStorage.getItem(KEY_RESOURCE_OFFERS);
    return raw ? JSON.parse(raw) : [];
}

// ─── Relief Camps (pre-cached) ──────────────────────────────────────────

async function getReliefCamps(userGps?: GpsPoint): Promise<ReliefCamp[]> {
    // Try fetching fresh from Firebase
    try {
        const res = await fetch(`${FIREBASE_URL}/relief_camps.json`);
        if (res.ok) {
            const data = await res.json();
            if (data) {
                const camps: ReliefCamp[] = Object.values(data);
                // Cache locally for offline use
                await AsyncStorage.setItem(KEY_RELIEF_CAMPS, JSON.stringify(camps));
                return sortByDistance(camps, userGps);
            }
        }
    } catch { /* offline — use cache */ }

    // Return from cache
    const raw = await AsyncStorage.getItem(KEY_RELIEF_CAMPS);
    const camps: ReliefCamp[] = raw ? JSON.parse(raw) : getDefaultCamps();
    return sortByDistance(camps, userGps);
}

function sortByDistance(camps: ReliefCamp[], userGps?: GpsPoint): ReliefCamp[] {
    if (!userGps) return camps;
    return [...camps].sort((a, b) => {
        const dA = distanceKm(userGps, a.gps);
        const dB = distanceKm(userGps, b.gps);
        return dA - dB;
    });
}

function distanceKm(a: GpsPoint, b: GpsPoint): number {
    const R = 6371;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLon = (b.longitude - a.longitude) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * Math.PI / 180) *
        Math.cos(b.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function getDefaultCamps(): ReliefCamp[] {
    // Hardcoded sample camps (replace with real govt data)
    return [
        {
            id: 'camp_1',
            name: 'NDRF Relief Camp — Andheri',
            gps: { latitude: 19.1197, longitude: 72.8468, address: 'Andheri Sports Complex, Mumbai' },
            hasFood: true, hasWater: true, hasMedical: true,
            capacity: 500, currentOccupancy: 120, addedAt: Date.now(),
        },
        {
            id: 'camp_2',
            name: 'Red Cross Emergency Shelter',
            gps: { latitude: 19.0760, longitude: 72.8777, address: 'Bandra Kurla Complex, Mumbai' },
            hasFood: true, hasWater: true, hasMedical: false,
            capacity: 200, currentOccupancy: 45, addedAt: Date.now(),
        },
    ];
}

// ─── Public API ─────────────────────────────────────────────────────────

export const sosService = {
    // SOS
    activateSOS,
    deactivateSOS,
    getActiveSOS,

    // Needs & Resources
    reportNeeds,
    getNeedsReports,
    offerResource,
    getResourceOffers,

    // Govt Action (response to user)
    getGovtAction,
    storeGovtActionFromMesh,

    // Relief
    getReliefCamps,

    // Sync
    flushSyncQueue,
    distanceKm,
};

export default sosService;
