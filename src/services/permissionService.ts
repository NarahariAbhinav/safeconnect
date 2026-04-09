/**
 * permissionService.ts — Centralized Permission Management
 * Handles Nearby Connections, Location, and other runtime permissions
 */

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { bleBackgroundRelayService } from './ble/BLEBackgroundRelayService';
import { bleMeshService, MeshPacket } from './ble/BLEMeshService';

interface PermissionStatus {
    bluetooth: boolean;
    location: boolean;
    nearbyWifi: boolean;
}

interface MeshEnableOptions {
    displayName?: string;
    onPacket?: (pkt: MeshPacket) => void;
    showEnabledAlert?: boolean;
}

class PermissionService {
    /**
     * Request all required permissions for mesh networking
     */
    async requestAllPermissions(): Promise<PermissionStatus> {
        const status: PermissionStatus = {
            bluetooth: false,
            location: false,
            nearbyWifi: false,
        };

        if (Platform.OS !== 'android') {
            // iOS permissions are handled through App.tsx native config
            return { bluetooth: true, location: true, nearbyWifi: true };
        }

        try {
            console.log('[PermissionService] Requesting Android runtime permissions...');

            const results = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                ...(Platform.Version >= 31 ? [
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                ] : []),
                ...(Platform.Version >= 33 ? [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] : []),
            ]);

            // Evaluate results
            status.bluetooth = Platform.Version < 31 ? true : (
                results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED ||
                results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
            );

            status.location =
                results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

            status.nearbyWifi =
                Platform.Version >= 33
                    ? results[PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] === PermissionsAndroid.RESULTS.GRANTED
                    : true;

            console.log('[PermissionService] Permission results:', status);

            return status;
        } catch (e) {
            console.error('[PermissionService] Permission request error:', e);
            return status;
        }
    }

    /**
     * Start mesh networking after permissions are verified
     */
    async enableMesh(options: MeshEnableOptions = {}): Promise<boolean> {
        // First, request permissions
        const perms = await this.requestAllPermissions();

        if (!perms.bluetooth || !perms.location) {
            console.warn('[PermissionService] Required permissions not granted');
            if (!perms.bluetooth) this._showBTAlert();
            if (!perms.location) {
                Alert.alert(
                    '❌ Location Required',
                    'Location permission is needed for mesh networking to discover nearby devices.\n\n' +
                    'Please grant location access in Settings.',
                    [
                        { text: 'Settings', onPress: () => Linking.openSettings() },
                        { text: 'Later', style: 'cancel' },
                    ]
                );
            }
            return false;
        }

        // Initialize mesh networking (starts advertise + discover)
        const ready = await bleMeshService.init(options.displayName);

        if (!ready) {
            Alert.alert(
                '❌ Mesh Networking Unavailable',
                'Could not start mesh networking. Please:\n\n' +
                '1. Turn ON Bluetooth (swipe down → tap BT icon)\n' +
                '2. Turn ON Wi-Fi\n' +
                '3. Turn ON Location\n' +
                '4. Restart the app\n\n' +
                'If that doesn\'t work, restart your phone.'
            );
            return false;
        }

        // All good - start scanning for peers
        console.log('[PermissionService] Starting mesh with permission check passed');
        await bleMeshService.startScanning(options.onPacket);

        // Also start background relay for offline messages
        await bleBackgroundRelayService.startRelay();

        if (options.showEnabledAlert !== false) {
            Alert.alert(
                '✅ SafeConnect Mesh Enabled',
                'Your device is now broadcasting and scanning for nearby SafeConnect users.\n\n' +
                '📍 SOS alerts and messages can be shared via mesh even without internet!\n\n' +
                '💡 Keep Bluetooth and Wi-Fi ON for best results.'
            );
        }

        return true;
    }

    /**
     * Check if mesh networking is currently active
     */
    isBLEReady(): boolean {
        return bleMeshService.ready;
    }

    /**
     * Stop mesh networking
     */
    disableMesh(): void {
        bleBackgroundRelayService.stopRelay();
        bleMeshService.destroy();
    }

    /**
     * Get peer count
     */
    getPeerCount(): number {
        return bleMeshService.getPeerCount();
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private _showBTAlert(): void {
        setTimeout(() => {
            const IL = this._getIntentLauncher();
            Alert.alert(
                '🔵 Enable Bluetooth & Wi-Fi',
                'Bluetooth and Wi-Fi are required for mesh networking.\n\n' +
                'You can either:\n' +
                '1. Tap "Settings" to enable them now\n' +
                '2. Or swipe down and tap the Bluetooth & Wi-Fi icons',
                [
                    {
                        text: 'Settings',
                        onPress: () => {
                            if (IL) {
                                IL.startActivityAsync(IL.ActivityAction.BLUETOOTH_SETTINGS).catch(() => {
                                    Linking.openSettings();
                                });
                            } else {
                                Linking.openSettings();
                            }
                        },
                    },
                    { text: 'Later', style: 'cancel' },
                ]
            );
        }, 100);
    }

    private _getIntentLauncher(): typeof import('expo-intent-launcher') | null {
        try {
            return require('expo-intent-launcher');
        } catch {
            return null;
        }
    }
}

export const permissionService = new PermissionService();
export default permissionService;
export type { PermissionStatus };

