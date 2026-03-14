/**
 * soundService.ts — Emergency Sound Alerts
 *
 * Plays audio cues for critical emergency events using expo-av.
 * Tones are generated programmatically from WAV data URIs — no network needed.
 *
 * Alert types:
 *  • sos       — urgent triple beep when nearby SOS detected
 *  • govtAction — ascending chime when rescue is dispatched to YOU
 *  • danger    — low warning tone (battery critical / mesh lost)
 *  • success   — short positive tone (sync complete)
 */

import { Buffer } from 'buffer';
import { Audio } from 'expo-av';

type AlertType = 'sos' | 'govtAction' | 'danger' | 'success';

/**
 * Build a WAV data URI from tone segments.
 * 8-bit unsigned PCM, 8000 Hz, mono. No network required.
 * Compatible with expo-av/ExoPlayer on Android.
 */
function buildWavUri(segments: Array<{ freq: number; dur: number; pause?: number }>): string {
    const sr = 8000;
    const totalSamples = segments.reduce(
        (acc, s) => acc + Math.round(sr * s.dur) + Math.round(sr * (s.pause ?? 0)),
        0
    );
    const buf = new Uint8Array(44 + totalSamples);
    const dv = new DataView(buf.buffer);

    // WAV RIFF header
    const ascii = (s: string, o: number) => { for (let i = 0; i < 4; i++) buf[o + i] = s.charCodeAt(i); };
    ascii('RIFF', 0); dv.setUint32(4, 36 + totalSamples, true);
    ascii('WAVE', 8); ascii('fmt ', 12);
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); // chunk size, PCM
    dv.setUint16(22, 1, true);  // mono
    dv.setUint32(24, sr, true); dv.setUint32(28, sr, true); // sampleRate, byteRate (8-bit mono)
    dv.setUint16(32, 1, true);  // blockAlign
    dv.setUint16(34, 8, true);  // bitsPerSample
    ascii('data', 36); dv.setUint32(40, totalSamples, true);

    // Write tone + silence segments
    let pos = 44;
    for (const seg of segments) {
        const toneN = Math.round(sr * seg.dur);
        for (let i = 0; i < toneN; i++) {
            const t = i / sr;
            // Quick 10ms fade-in, 20ms fade-out to avoid clicks
            const env = Math.min(1, t / 0.01) * Math.min(1, (seg.dur - t) / 0.02);
            buf[pos++] = 128 + Math.round(100 * env * Math.sin(2 * Math.PI * seg.freq * t));
        }
        const silN = Math.round(sr * (seg.pause ?? 0));
        for (let i = 0; i < silN; i++) buf[pos++] = 128; // 128 = silence in unsigned 8-bit
    }

    return 'data:audio/wav;base64,' + Buffer.from(buf).toString('base64');
}

// Tone definitions for each alert type (freq in Hz, dur in seconds)
const TONES: Record<AlertType, Array<{ freq: number; dur: number; pause?: number }>> = {
    // SOS — urgent triple beep: two short + one long rising
    sos: [
        { freq: 880, dur: 0.12, pause: 0.06 },
        { freq: 880, dur: 0.12, pause: 0.06 },
        { freq: 1100, dur: 0.28 },
    ],
    // Govt Action — ascending two-tone chime (positive confirmation)
    govtAction: [
        { freq: 523, dur: 0.18, pause: 0.04 },
        { freq: 659, dur: 0.30 },
    ],
    // Danger — two low warning pulses
    danger: [
        { freq: 330, dur: 0.25, pause: 0.08 },
        { freq: 330, dur: 0.25 },
    ],
    // Success — single short positive chime
    success: [
        { freq: 523, dur: 0.28 },
    ],
};

class SoundServiceClass {
    private _sound: Audio.Sound | null = null;
    private _enabled = true;

    get enabled(): boolean { return this._enabled; }
    set enabled(v: boolean) { this._enabled = v; }

    /** Initialize audio mode (call once on app start) */
    async init(): Promise<void> {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,   // play even in silent mode on iOS
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });
            console.log('[Sound] Audio mode set ✅');
        } catch (e) {
            console.log('[Sound] Init failed:', (e as any)?.message);
        }
    }

    /** Play an alert. Stops any currently playing sound first. */
    async play(type: AlertType): Promise<void> {
        if (!this._enabled) return;
        await this._stop();

        try {
            const uri = buildWavUri(TONES[type]);
            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true, volume: 1.0 }
            );
            this._sound = sound;
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync().catch(() => { });
                    this._sound = null;
                }
            });
            console.log('[Sound] Playing:', type);
        } catch (e) {
            console.log('[Sound] Play failed:', (e as any)?.message);
        }
    }

    /** Play SOS alert — repeated 3 times (for incoming BLE SOS) */
    async playSosAlert(): Promise<void> {
        await this.play('sos');
    }

    /** Play positive chime (rescue dispatched to user) */
    async playGovtActionAlert(): Promise<void> {
        await this.play('govtAction');
    }

    /** Play warning (battery critical) */
    async playDanger(): Promise<void> {
        await this.play('danger');
    }

    /** Play subtle success sound */
    async playSuccess(): Promise<void> {
        await this.play('success');
    }

    private async _stop(): Promise<void> {
        if (this._sound) {
            try {
                await this._sound.stopAsync();
                await this._sound.unloadAsync();
            } catch { /* ignore */ }
            this._sound = null;
        }
    }

    destroy(): void {
        this._stop().catch(() => { });
    }
}

export const soundService = new SoundServiceClass();
export default soundService;
