/**
 * IMPLEMENTATION GUIDE: Using permissionService for Mesh Setup
 * 
 * This shows how to update HomeScreen.tsx requestAllPermissions() function
 * to use the new permissionService
 */

// ===== At the top of HomeScreen.tsx, add this import =====
// import { permissionService } from '../services/permissionService';

// ===== Replace the entire requestAllPermissions function with this: =====

const requestAllPermissions = async () => {
    setShowPermModal(false);
    console.log('[HomeScreen] User tapped Allow Permissions');

    // Use the centralized permission service
    const success = await permissionService.enableMesh();
    
    if (success) {
        console.log('[HomeScreen] Mesh enabled successfully');
        // Optional: You could add additional UI updates here
        // For example, show a success banner or start a mesh indicator animation
    } else {
        console.warn('[HomeScreen] Mesh enablement failed - check permissions');
        // The permissionService already shows appropriate alerts
    }
};

// ===== That's it! The permissionService handles: =====
// 1. ✅ Requesting all permissions (BLE, Location, Nearby WiFi)
// 2. ✅ Verifying permissions were actually granted
// 3. ✅ Checking if BLE service is ready
// 4. ✅ Starting mesh scanning automatically
// 5. ✅ Showing appropriate alerts for any failures
// 6. ✅ Logging for debugging

// ===== To check mesh status anywhere in the app: =====
// import { permissionService } from '../services/permissionService';
//
// const isMeshActive = permissionService.isBLEReady();
// const nearbyCount = permissionService.getPeerCount();
// const canStart = !isMeshActive; // If not active, show "Enable Mesh" button

// ===== To disable mesh when user logs out or disables it: =====
// permissionService.disableMesh();

// ===== Full diff for minimal change =====
/*

BEFORE:
    const requestAllPermissions = async () => {
        setShowPermModal(false);

        // ── Step 1: Grant runtime permissions (Android only) ──────────
        if (Platform.OS === 'android') {
            try {
                await PermissionsAndroid.requestMultiple([
                    // ... lots of permission code ...
                ]);
            } catch {
                // Permission request errors are non-critical
            }
        }

        // ── Step 2: Open Bluetooth Settings via proper Android Intent ──
        try {
            if (Platform.OS === 'android') {
                const IL = getIntentLauncher();
                if (IL) {
                    await IL.startActivityAsync(IL.ActivityAction.BLUETOOTH_SETTINGS);
                }
            }
        } catch {
            // silently ignored — tip dialog below covers this case
        }

        // ... more settings code ...

        setTimeout(() => {
            Alert.alert(
                '📱 Enable 3 Things',
                // ...
            );
        }, 1500);
    };

AFTER:
    const requestAllPermissions = async () => {
        setShowPermModal(false);
        const success = await permissionService.enableMesh();
    };

That's all you need! 🎉

*/
