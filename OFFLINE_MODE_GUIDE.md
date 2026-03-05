# SafeConnect Offline Mode - Implementation Guide

## Current Architecture

### Limitations with react-native-ble-plx
- **Central-only on Android**: Can scan for devices but cannot advertise/be discovered
- **Effect**: In offline mode, devices can only act as scanners, not broadcasters
- **Range limitation**: ~100 meters for BLE communication

## Current Workaround: Relay Queue System

Your app already has a relay system in place:

```typescript
// User A sends SOS (WiFi OFF)
bleMeshService.broadcast(packet)
  → Packet queued in AsyncStorage (ble_relay_queue)
  → Scanner finds User B nearby
  → Writes queued packets to User B
  → User B relays to User C (if User C is gateway with WiFi)
  → User C syncs to Firebase
```

### How It Works

1. **Packet Queue** (`_enqueueRelay`): Stores up to 50 undelivered packets
2. **Deduplication** (`_isSeen`): Prevents duplicate processing
3. **TTL Check**: Packets expire after 12 hours
4. **Hop Limiting**: Max 5 relays to prevent infinite loops
5. **Gateway Sync** (`_tryGatewaySync`): If internet available, upload immediately

## Solutions for True Offline Mode

### Solution 1: Use Native Bluetooth Modules (Recommended)

**Option A: BLE Peripheral Support**
```bash
npm install react-native-ble-android
# or
npm install @react-native-community/ble-android
```

This would require:
1. Custom native Bluetooth code for advertising
2. GATT server implementation
3. A significant rewrite of BLEMeshService

**Option B: Use Both react-native-ble-plx + NearbyConnections**
```bash
npm install react-native-nearby-connections
```

This uses Google's Nearby Connections API which handles both discovery AND peer-to-peer without needing Bluetooth advertising.

### Solution 2: Workaround with Current Library (What You Have Now)

**Improve the polling mechanism**:
```typescript
// Instead of "scanning only when explicitly started"
// Have a background task that:
// 1. Runs every 30 seconds
// 2. Scans for nearby devices
// 3. Auto-relays any queued packets
// 4. Checks for new messages from peers
```

## Implementation: Background Relay Service

I recommend adding a background relay service that works continuously:

```typescript
// services/ble/BLERelayService.ts

class BLERelayService {
  private relayInterval: NodeJS.Timeout | null = null;
  private isRelaying = false;

  async startBackgroundRelay(): Promise<void> {
    if (this.relayInterval) return;
    
    console.log('[BLERelay] Starting background relay...');
    
    // Relay every 30 seconds
    this.relayInterval = setInterval(async () => {
      await this._doRelay();
    }, 30000);
    
    // Also try immediately
    await this._doRelay();
  }

  private async _doRelay(): Promise<void> {
    if (this.isRelaying || !bleMeshService.ready) return;
    this.isRelaying = true;

    try {
      // This triggers _scanAndRelay which:
      // 1. Scans for nearby devices
      // 2. Writes queued packets to each device
      // 3. Listens for responses
      await bleMeshService.broadcast(null);
    } catch (e) {
      console.log('[BLERelay] Relay error:', e);
    } finally {
      this.isRelaying = false;
    }
  }

  stopBackgroundRelay(): void {
    if (this.relayInterval) {
      clearInterval(this.relayInterval);
      this.relayInterval = null;
    }
  }
}

export const bleRelayService = new BLERelayService();
```

Then in HomeScreen when mesh is enabled:
```typescript
// Start relay immediately and keep it running
bleRelayService.startBackgroundRelay();
```

## Migration Path: Make it Work Now → Improve Later

### Phase 1: Current (react-native-ble-plx only)
✅ What works:
- Scanning for nearby devices
- Reading GATT characteristics
- Relay queue persistence
- TTL/hop limiting
- Multiple hop relaying

⚠️ Limitations:
- Can't advertise (devices must scan)
- Requires explicit scanning start
- ~100m range

### Phase 2: Add Background Relay (2-3 hours work)
Add continuous relay service so packets are shared automatically without user action.

### Phase 3: Add Nearby Connections (1-2 days)
Integrate Google Nearby library for true bidirectional discovery.

### Phase 4: Add Native BLE Peripheral (2-3 days)
Full custom Bluetooth implementation for complete offline mesh.

## Quick Test to Verify Current System Works

```typescript
// Add this to MeshStatusScreen or a new test screen
const testOfflineMesh = async () => {
  // Simulate no internet (WiFi OFF)
  const pkt = bleMeshService.createSOSPacket(userId, {
    userId,
    gps: { latitude: 19.076, longitude: 72.877, address: 'Test' },
  });
  
  // Queue it
  await bleMeshService.broadcast(pkt);
  
  // Check if it was queued
  const queue = await AsyncStorage.getItem('ble_relay_queue');
  console.log('Relay queue:', queue);
  
  // Simulate finding nearby device by manually calling scan
  await bleMeshService.startScanning();
  
  // After 30 seconds, check if peer count increased
  setTimeout(() => {
    console.log('Peer count:', bleMeshService.getPeerCount());
  }, 30000);
};
```

## Recommended Next Steps

1. **Immediate** (This session):
   - ✅ Initialize BLE on app startup
   - ✅ Add peer count tracking
   - ✅ Improve permission verification
   - Create PermissionService (done)

2. **Short-term** (This week):
   - Implement background relay service
   - Add foreground service for Android (keep scanning when app in background)
   - Test with 2-3 devices in offline mode

3. **Medium-term** (Next sprint):
   - Consider integrating React Native Nearby Connections
   - Add battery optimization (adaptive scanning)
   - Implement proper offline DTN with hop visualization

4. **Long-term** (Next release):
   - Full Bluetooth Peripheral support
   - True mesh routing algorithm
   - Offline SOS alert propagation visualization

## Notes for Your Use Case

For **disaster relief scenarios**, the current system is actually quite good because:
- Relief workers can keep WiFi on (gateway nodes)
- Stranded users send SOS via offline relay
- Each device auto-relays if someone with WiFi is nearby

The main limitation is that a **completely isolated user** (no gateway within ~100m) can't reach help. But in most emergency scenarios, there will be some WiFi connectivity in nearby buildings/vehicles.

To handle complete isolation, you'd need:
1. Satellite messaging (Garmin InReach, etc.)
2. Radio mesh networks (LoRaWAN)
3. Emergency broadcast systems

The BLE mesh is best used as a **local coordination tool** between nearby users and gateway devices.
