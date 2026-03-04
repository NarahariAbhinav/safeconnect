/**
 * locationTrailService.ts — GPS Breadcrumb Trail
 *
 * Records the user's GPS position every N minutes (battery-aware).
 * When SOS is activated, the last 1-hour trail is uploaded alongside
 * the SOS record so rescue teams can see movement history.
 *
 * Trail is stored in AsyncStorage as an array of {lat, lng, time, accuracy}.
 * Max 200 entries (worst case ~16 hours of trail at 5-min intervals).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { batteryService } from './batteryService';
import { locationService } from './location';

const KEY_TRAIL = 'safeconnect_location_trail';
const MAX_TRAIL = 200;

export interface TrailPoint {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number;
    timestamp: number;   // epoch ms
}

class LocationTrailServiceClass {
    private _interval: ReturnType<typeof setInterval> | null = null;
    private _recording: boolean = false;

    /** Start recording breadcrumbs (call once on SOS screen mount or app init) */
    start(): void {
        if (this._recording) return;
        this._recording = true;
        this._record(); // record immediately
        this._scheduleNext();
        console.log('[Trail] Recording started');
    }

    /** Stop recording */
    stop(): void {
        this._recording = false;
        if (this._interval) clearInterval(this._interval);
        this._interval = null;
        console.log('[Trail] Recording stopped');
    }

    /** Whether currently recording */
    get isRecording(): boolean { return this._recording; }

    /** Record current position */
    private async _record(): Promise<void> {
        try {
            const loc = await locationService.getCurrentLocation();
            if (!loc) return;

            const point: TrailPoint = {
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy ?? undefined,
                altitude: loc.altitude ?? undefined,
                timestamp: Date.now(),
            };

            const trail = await this.getTrail();
            trail.push(point);

            // Keep only last MAX_TRAIL points
            if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL);

            await AsyncStorage.setItem(KEY_TRAIL, JSON.stringify(trail));
            console.log('[Trail] Point recorded:', point.latitude.toFixed(5), point.longitude.toFixed(5), `(${trail.length} total)`);
        } catch (e) {
            console.log('[Trail] Record failed:', (e as any)?.message);
        }
    }

    /** Schedule next recording based on battery profile */
    private _scheduleNext(): void {
        if (this._interval) clearInterval(this._interval);
        const ms = batteryService.profile.gpsBreadcrumb;
        this._interval = setInterval(() => {
            if (this._recording) this._record();
        }, ms);
        console.log('[Trail] Next record in', Math.round(ms / 1000), 's');
    }

    /** Get the full trail from storage */
    async getTrail(): Promise<TrailPoint[]> {
        try {
            const raw = await AsyncStorage.getItem(KEY_TRAIL);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    /** Get last N minutes of trail */
    async getRecentTrail(minutes: number = 60): Promise<TrailPoint[]> {
        const trail = await this.getTrail();
        const cutoff = Date.now() - minutes * 60_000;
        return trail.filter(p => p.timestamp >= cutoff);
    }

    /** Get the trail as a GeoJSON LineString (for map rendering or Firebase) */
    async getTrailAsGeoJSON(minutes: number = 60): Promise<object> {
        const points = await this.getRecentTrail(minutes);
        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: points.map(p => [p.longitude, p.latitude]),
            },
            properties: {
                pointCount: points.length,
                startTime: points[0]?.timestamp,
                endTime: points[points.length - 1]?.timestamp,
            },
        };
    }

    /** Upload trail to Firebase under the SOS record */
    async uploadTrail(sosId: string, minutes: number = 60): Promise<boolean> {
        try {
            const trail = await this.getRecentTrail(minutes);
            if (trail.length === 0) return false;

            const FB = 'https://safeconnect-f509c-default-rtdb.asia-southeast1.firebasedatabase.app';
            const res = await fetch(`${FB}/soss/${sosId}/locationTrail.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(trail),
            });
            if (res.ok) {
                console.log('[Trail] Uploaded', trail.length, 'points to Firebase ✅');
                return true;
            }
            return false;
        } catch (e) {
            console.log('[Trail] Upload failed:', (e as any)?.message);
            return false;
        }
    }

    /** Clear the trail */
    async clear(): Promise<void> {
        await AsyncStorage.removeItem(KEY_TRAIL);
    }
}

export const locationTrailService = new LocationTrailServiceClass();
export default locationTrailService;
