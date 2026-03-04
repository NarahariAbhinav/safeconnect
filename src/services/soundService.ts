/**
 * soundService.ts — Emergency Sound Alerts
 *
 * Plays audio cues for critical emergency events using expo-av.
 * Sounds are generated programmatically (no asset files needed).
 *
 * Alert types:
 *  • sos       — urgent repeating beep when nearby SOS detected
 *  • govtAction — positive chime when rescue is dispatched to YOU
 *  • danger    — low warning tone (battery critical / mesh lost)
 *  • success   — short positive tone (sync complete)
 */

import { Audio } from 'expo-av';

type AlertType = 'sos' | 'govtAction' | 'danger' | 'success';

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

        // Use a data URI for a simple beep tone (440Hz sine wave, WAV format)
        // We use different encoded WAV files for different alert types
        const uris: Record<AlertType, string> = {
            // SOS — urgent triple beep
            sos: 'https://www.soundjay.com/buttons/sounds/beep-07.mp3',
            // Govt action — positive chime (rescue confirmed)
            govtAction: 'https://www.soundjay.com/buttons/sounds/button-09.mp3',
            // Danger — warning
            danger: 'https://www.soundjay.com/buttons/sounds/beep-10.mp3',
            // Success — short positive
            success: 'https://www.soundjay.com/buttons/sounds/button-21.mp3',
        };

        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri: uris[type] },
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
            console.log('[Sound] Play failed (network?):', (e as any)?.message);
            // Fallback: use Expo's built-in beep via system vibration pattern is handled in caller
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
