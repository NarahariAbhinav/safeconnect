/**
 * permissionService.ts — Centralized Permission Management
 * Handles BLE, Location, and other runtime permissions with proper verification
 */

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { bleBackgroundRelayService } from './ble/BLEBackgroundRelayService';
import { bleMeshService } from './ble/BLEMeshService';

interface PermissionStatus {
    bluetooth: boolean;
    location: boolean;
    nearbyWifi: boolean;
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
            status.bluetooth =
                results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED ||
                results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

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
     * Start mesh scanning after permissions are verified
     */
    async enableMesh(): Promise<boolean> {
        // First, request permissions
        const perms = await this.requestAllPermissions();

        if (!perms.bluetooth) {
            console.warn('[PermissionService] Bluetooth permission not granted');
            this._showBTAlert();
            return false;
        }

        // Check if BLE service is ready
        if (!bleMeshService.ready) {
            console.warn('[PermissionService] BLE service not ready yet');
            // Wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 500));

            if (!bleMeshService.ready) {
                Alert.alert(
                    '❌ Bluetooth Not Available',
                    'Your device Bluetooth is disabled or not responding. Please:\n\n' +
                    '1. Swipe down → tap Bluetooth icon to turn ON\n' +
                    '2. Restart the app\n\n' +
                    'If that doesn\'t work, restart your phone.'
                );
                return false;
            }
        }

        // All good - start scanning
        console.log('[PermissionService] Starting mesh with permission check passed');
        bleMeshService.startScanning();

        // Also start background relay for offline messages
        await bleBackgroundRelayService.startRelay();

        Alert.alert(
            '✅ SafeConnect Mesh Enabled',
            'Your device is now broadcasting and scanning for nearby SafeConnect users.\n\n' +
            '📍 SOS alerts and messages can be shared via mesh even without internet!\n\n' +
            '💡 Keep Bluetooth ON for best results.'
        );

        return true;
    }

    /**
     * Check if BLE is currently enabled without requesting permissions
     */
    isBLEReady(): boolean {
        return bleMeshService.ready;
    }

    /**
     * Stop mesh scanning
     */
    disableMesh(): void {
        bleMeshService.stopScanning();
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
                '🔵 Enable Bluetooth',
                'Bluetooth is required for mesh networking.\n\n' +
                'You can either:\n' +
                '1. Tap "Settings" to enable it now\n' +
                '2. Or swipe down and tap the Bluetooth icon',
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

