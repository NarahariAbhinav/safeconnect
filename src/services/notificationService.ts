/**
 * notificationService.ts — Local Push Notifications
 *
 * Gracefully degrades in Expo Go (where native push module is unavailable).
 * In Expo Go: logs to console only, no crash.
 * In dev builds: full local push notifications.
 *
 * Uses lazy dynamic require() so the native module is only loaded
 * after init() is called, inside a try/catch — prevents the crash
 * "Cannot find native module 'ExpoPushTokenManager'" in Expo Go.
 */

import * as SMS from 'expo-sms';
import { Platform } from 'react-native';

class NotificationServiceClass {
    private _ready = false;
    private _N: any = null; // lazy-loaded expo-notifications

    /** Load the module safely — returns null if unavailable (Expo Go) */
    private _load(): any {
        if (this._N) return this._N;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mod = require('expo-notifications');
            this._N = mod;
            return mod;
        } catch {
            return null;
        }
    }

    /** Request permission and set up channel (call once on app start) */
    async init(): Promise<boolean> {
        const N = this._load();
        if (!N) {
            console.log('[Notifications] expo-notifications not available (Expo Go) — skipped');
            return false;
        }

        try {
            // Configure foreground behaviour
            N.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: true,
                    shouldSetBadge: false,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });

            const { status: existing } = await N.getPermissionsAsync();
            let finalStatus = existing;
            if (existing !== 'granted') {
                const { status } = await N.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('[Notifications] Permission denied');
                return false;
            }

            // Android notification channels
            if (Platform.OS === 'android') {
                await N.setNotificationChannelAsync('safeconnect_alerts', {
                    name: 'SafeConnect Alerts',
                    importance: N.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 100, 250, 100, 500],
                    lightColor: '#C62828',
                    sound: 'default',
                });
                await N.setNotificationChannelAsync('safeconnect_info', {
                    name: 'SafeConnect Info',
                    importance: N.AndroidImportance.DEFAULT,
                    sound: 'default',
                });
            }

            this._ready = true;
            console.log('[Notifications] Initialized ✅');
            return true;
        } catch (e) {
            console.log('[Notifications] Init error:', (e as any)?.message);
            return false;
        }
    }

    get ready(): boolean { return this._ready; }

    /** 🚒 Govt action received — high priority */
    async notifyGovtAction(params: {
        status: string;
        message: string;
        officerName?: string;
        estimatedArrival?: string;
        campName?: string;
    }): Promise<void> {
        const label: Record<string, string> = {
            rescue_dispatched: '🚒 Rescue Dispatched!',
            camp_assigned: '⛺ Camp Assigned!',
            acknowledged: '✅ SOS Acknowledged',
            resolved: '✅ SOS Resolved',
        };
        const lines = [params.message];
        if (params.estimatedArrival) lines.push(`⏱ ETA: ${params.estimatedArrival}`);
        if (params.campName) lines.push(`📍 Camp: ${params.campName}`);
        if (params.officerName) lines.push(`👮 Officer: ${params.officerName}`);
        await this._schedule({
            title: label[params.status] ?? '🚨 Emergency Update',
            body: lines.join('\n'),
            channelId: 'safeconnect_alerts',
        });
    }

    /** 📡 Nearby SOS received via BLE mesh */
    async notifyNearbySOS(params: { userName: string; address?: string; hops: number }): Promise<void> {
        const dist = params.hops <= 1 ? 'Very close by' : `~${params.hops} hops away`;
        await this._schedule({
            title: '🆘 Nearby SOS Alert',
            body: `${params.userName} needs help! ${dist}${params.address ? '\n📍 ' + params.address : ''}`,
            channelId: 'safeconnect_alerts',
        });
    }

    /** 🪫 Battery critical */
    async notifyBatteryCritical(level: number): Promise<void> {
        await this._schedule({
            title: '🪫 Battery Critical',
            body: `Your phone is at ${Math.round(level * 100)}%. SafeConnect is in ultra-low-power mode.`,
            channelId: 'safeconnect_alerts',
        });
    }

    /** ✅ Auto-sync completed */
    async notifyAutoSync(sosCount: number, chatCount: number): Promise<void> {
        const parts: string[] = [];
        if (sosCount > 0) parts.push(`${sosCount} SOS record${sosCount > 1 ? 's' : ''}`);
        if (chatCount > 0) parts.push(`${chatCount} message${chatCount > 1 ? 's' : ''}`);
        if (parts.length === 0) return;
        await this._schedule({
            title: '📶 Back Online — Synced!',
            body: `Uploaded ${parts.join(' and ')} to SafeConnect servers.`,
            channelId: 'safeconnect_info',
        });
    }

    /** Generic info notification */
    async notifyInfo(title: string, body: string): Promise<void> {
        await this._schedule({ title, body, channelId: 'safeconnect_info' });
    }

    /** Internal schedule helper — no-ops in Expo Go */
    private async _schedule(params: {
        title: string;
        body: string;
        channelId: string;
    }): Promise<void> {
        if (!this._ready) {
            console.log(`[Notifications] (Expo Go fallback) ${params.title}: ${params.body}`);
            return;
        }
        const N = this._load();
        if (!N) return;
        try {
            await N.scheduleNotificationAsync({
                content: {
                    title: params.title,
                    body: params.body,
                    sound: 'default',
                    ...(Platform.OS === 'android' ? { channelId: params.channelId } : {}),
                },
                trigger: null, // show immediately
            });
            console.log('[Notifications] Sent:', params.title);
        } catch (e) {
            console.log('[Notifications] Schedule failed:', (e as any)?.message);
        }
    }

    /** 📱 Send SMS emergency alerts to contacts */
    async sendSMSAlert(phoneNumbers: string[], message: string): Promise<boolean> {
        try {
            const available = await SMS.isAvailableAsync();
            if (!available) {
                console.log('[SMS] SMS not available on this device');
                return false;
            }

            // Send SMS to all emergency contacts
            const result = await SMS.sendSMSAsync(
                phoneNumbers,
                message
            );

            console.log('[SMS] ✅ Alert sent to', phoneNumbers.length, 'contacts');
            return result.result === 'sent' || result.result === 'unknown';
        } catch (e) {
            console.error('[SMS] Failed to send alert:', e);
            return false;
        }
    }

    /** Handle tap on a notification */
    addResponseListener(callback: (data: any) => void): () => void {
        const N = this._load();
        if (!N) return () => { };
        try {
            const sub = N.addNotificationResponseReceivedListener((response: any) => {
                callback(response.notification.request.content.data);
            });
            return () => sub.remove();
        } catch {
            return () => { };
        }
    }
}

export const notificationService = new NotificationServiceClass();
export default notificationService;
