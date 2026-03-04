/**
 * notificationService.ts — Local Push Notifications
 *
 * Handles scheduling and displaying local notifications for:
 *  • Government rescue dispatch received
 *  • Nearby SOS detected via BLE mesh
 *  • Battery critical warning
 *  • Auto-sync completed (messages/SOS uploaded)
 *
 * Uses expo-notifications (local only — no FCM/APNS needed).
 * Works entirely offline since these are device-local notifications.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications look when app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

class NotificationServiceClass {
    private _ready = false;

    /** Request permission and set up channel (call once on app start) */
    async init(): Promise<boolean> {
        try {
            const { status: existing } = await Notifications.getPermissionsAsync();
            let finalStatus = existing;

            if (existing !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('[Notifications] Permission denied');
                return false;
            }

            // Android notification channel
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('safeconnect_alerts', {
                    name: 'SafeConnect Alerts',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 100, 250, 100, 500],
                    lightColor: '#C62828',
                    sound: 'default',
                });
                await Notifications.setNotificationChannelAsync('safeconnect_info', {
                    name: 'SafeConnect Info',
                    importance: Notifications.AndroidImportance.DEFAULT,
                    sound: 'default',
                });
            }
            this._ready = true;
            console.log('[Notifications] Initialized ✅');
            return true;
        } catch (e) {
            console.log('[Notifications] Init failed:', (e as any)?.message);
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
        if (!this._ready) return;
        const statusLabel: Record<string, string> = {
            rescue_dispatched: '🚒 Rescue Dispatched!',
            camp_assigned: '⛺ Camp Assigned!',
            acknowledged: '✅ Your SOS Acknowledged',
            resolved: '✅ SOS Resolved',
        };
        const title = statusLabel[params.status] ?? '🚨 Emergency Update';
        const lines = [params.message];
        if (params.estimatedArrival) lines.push(`⏱ ETA: ${params.estimatedArrival}`);
        if (params.campName) lines.push(`📍 Camp: ${params.campName}`);
        if (params.officerName) lines.push(`👮 Officer: ${params.officerName}`);

        await this._schedule({
            title,
            body: lines.join('\n'),
            channelId: 'safeconnect_alerts',
            data: { type: 'govtAction', ...params },
        });
    }

    /** 📡 Nearby SOS received via BLE mesh */
    async notifyNearbySOS(params: { userName: string; address?: string; hops: number }): Promise<void> {
        if (!this._ready) return;
        const dist = params.hops <= 1 ? 'Very close by' : `~${params.hops} hops away`;
        await this._schedule({
            title: '🆘 Nearby SOS Alert',
            body: `${params.userName} needs help! ${dist}${params.address ? '\n📍 ' + params.address : ''}`,
            channelId: 'safeconnect_alerts',
            data: { type: 'nearbySOS', ...params },
        });
    }

    /** 🪫 Battery critical */
    async notifyBatteryCritical(level: number): Promise<void> {
        if (!this._ready) return;
        await this._schedule({
            title: '🪫 Battery Critical',
            body: `Your phone is at ${Math.round(level * 100)}%. SafeConnect is running in ultra-low-power mode. Keep your SOS active.`,
            channelId: 'safeconnect_alerts',
            data: { type: 'batteryCritical', level },
        });
    }

    /** ✅ Auto-sync completed (came back online) */
    async notifyAutoSync(sosCount: number, chatCount: number): Promise<void> {
        if (!this._ready) return;
        const parts = [];
        if (sosCount > 0) parts.push(`${sosCount} SOS record${sosCount > 1 ? 's' : ''}`);
        if (chatCount > 0) parts.push(`${chatCount} message${chatCount > 1 ? 's' : ''}`);
        if (parts.length === 0) return;
        await this._schedule({
            title: '📶 Back Online — Synced!',
            body: `Uploaded ${parts.join(' and ')} to SafeConnect servers.`,
            channelId: 'safeconnect_info',
            data: { type: 'autoSync' },
        });
    }

    /** Generic info notification */
    async notifyInfo(title: string, body: string): Promise<void> {
        if (!this._ready) return;
        await this._schedule({ title, body, channelId: 'safeconnect_info', data: {} });
    }

    /** Internal schedule helper */
    private async _schedule(params: {
        title: string;
        body: string;
        channelId: string;
        data: object;
    }): Promise<void> {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: params.title,
                    body: params.body,
                    data: params.data,
                    sound: 'default',
                    ...(Platform.OS === 'android' ? { channelId: params.channelId } : {}),
                } as Notifications.NotificationContentInput,
                trigger: null, // show immediately
            });
            console.log('[Notifications] Sent:', params.title);
        } catch (e) {
            console.log('[Notifications] Schedule failed:', (e as any)?.message);
        }
    }

    /** Handle tap on a notification (call in App.tsx) */
    addResponseListener(callback: (data: any) => void): () => void {
        const sub = Notifications.addNotificationResponseReceivedListener(response => {
            callback(response.notification.request.content.data);
        });
        return () => sub.remove();
    }
}

export const notificationService = new NotificationServiceClass();
export default notificationService;
