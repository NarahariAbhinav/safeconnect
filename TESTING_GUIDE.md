# SafeConnect Mesh Testing & Debugging Guide

## Pre-Testing Checklist

- [ ] All code changes applied from this fix session
- [ ] Device has Bluetooth capability (check in Settings)
- [ ] Location services available
- [ ] Two or more Android devices for testing
- [ ] USB cable for adb logcat
- [ ] Test WiFi hotspot available (for online testing)

## Setup: Build and Deploy

### Build with EAS (Via Scanner/APK)

```bash
cd c:\Users\Abhinav\Documents\NMIMS\SEM 8\safeconnect

# Build for Android
eas build --platform android --profile preview

# Or, if you have dev client set up:
eas build --platform android --profile development
```

### Local Development Testing

```bash
# Install dependencies
npm install

# Start development server
npm run android

# Keep terminal open - you'll see logs
```

## Test Scenario 1: Permissions & Initialization

**What we're testing**: BLE initializes, permissions are requested and verified

### Steps
1. Open app fresh on new device
2. Go to Home screen
3. Wait 600ms, permission modal should appear
4. Tap "Allow All Permissions"
5. Check system responds to requests
6. Observe alerts about Bluetooth/Location

### Expected Behavior
```
[App] BLE Mesh initialized successfully
[Permission] Requesting BLE & Location permissions...
[Permission] BLE granted: true
[Permission] Location granted: true  
[Permission] ✅ BLE Service is ready!
[Permission] Starting mesh scanning...
✅ Mesh Enabled (alert appears)
```

### Debug with Logs
```bash
# Terminal 1: Monitor BLE logs
adb logcat | grep "\[BLE\]\|\[Permission\]"

# Should see:
# [BLE] Manager created, waiting for Bluetooth state...
# [BLE] Bluetooth state changed: PoweredOn
# [BLE] ✅ Ready - Bluetooth is ON
# [Permission] ✅ BLE Service is ready!
```

---

## Test Scenario 2: Peer Discovery (Online, Wi-Fi)

**What we're testing**: Two devices can find each other via BLE

### Setup
- Device A & Device B, both with app installed
- Both on same WiFi network
- Bluetooth ON, Location ON
- Devices within 5-10 meters

### Steps

#### On Device A:
1. Open app, go to **Home** screen  
2. Tap "Allow All Permissions" → see "✅ Mesh Enabled"
3. Tap **Menu** (bottom right) → **Mesh Monitor** (or navigate to MeshStatusScreen)
4. See "BLE Ready ✅"
5. Tap **📡 Start Scanning**
6. Leave scanning running

#### On Device B:
1. Open app, go to **Home** screen
2. Tap "Allow All Permissions" → see "✅ Mesh Enabled"  
3. Go to **Mesh Monitor**
4. See "BLE Ready ✅"
5. Tap **Send Test Packet** to broadcast an SOS

### Expected Behavior

**Device A (scanner):**
```
[BLE] Scanning started...
[BLE] Found device: ABC123 unnamed
[BLE] ✅ Connected to peer ABC123. Total peers: 1
📦 Packet received! Type: sos Hops: 0 From: device_B...
```

**Device B (broadcaster):**
```
Broadcasting TEST SOS packet via BLE...
[BLE] Enqueued relay packet
Test SOS packet broadcast complete ✅
```

**Home screen shows:**
- "Nearby Nodes: 1"  
- Device name visible in the list

### Debug Commands
```bash
# Watch peer count change
adb logcat | grep "Total peers"

# Watch packet exchange
adb logcat | grep "Found device\|Packet received\|Connected to peer"

# Check queued packets
adb logcat | grep "relay queue"
```

---

## Test Scenario 3: Offline Mode (WiFi OFF, Relay Only)

**What we're testing**: Packets relay through devices without internet

### Setup
- Device A & Device B
- Bluetooth ON
- **WiFi OFF and Mobile Data OFF** (airplane mode is easiest)
- Devices within 100m of each other
- App should still run (you tested this on APK)

### Steps

#### Device A (Originator):
1. Open app → Home → Settings → (scroll to Mesh section)
2. Tap **Send SOS (Test)**
3. Observe: Message says "queued for relay"
4. Check **Mesh Monitor** → "Relay queue: 1"

#### Device B (Relay/Gateway):
1. Open  app → Home → **Mesh Monitor**
2. Tap **Start Scanning**
3. Wait 10-15 seconds
4. Should detect Device A and exchange packets
5. Packet shows in "Packets Received" section

### Expected Behavior

**Device A logs:**
```
[BLE] New packet received: sos from device_A
[BLE] Gateway sync: queued for relay (no internet)
[BLE→Relay] Enqueued 1 packet waiting for gateway
```

**Device B logs:**
```
[BLE] Found device: Device_A_ID
[BLE] ✅ Connected to peer. Total peers: 1
[BLE] Relay queue: 1 packet(s) to broadcast
[BLE] Gateway sync: uploaded ✅ (if WiFi later enabled)
```

### Test WiFi Gateway

1. **Without changing app**: Turn WiFi ON on Device B
2. Both devices should still see each other  
3. Messages should sync to Firebase
4. Check relief map for SOS marker

**Logs when WiFi enabled:**
```
[BLE→Gateway] Uploading 1 SOS records to Firebase ✅
Synced 1 chat messages ✅
```

---

## Test Scenario 4: Multiple Hops (3+ Devices)

**What we're testing**: Relay through intermediate nodes

### Setup
- 3 devices: A (sender), B (relay), C (gateway with WiFi)
- Arrange in a line: A-----B-----C
- B and C within 100m, A and B within 100m
- A and C NOT in direct range (>100m or blocked)
- A and B: WiFi OFF, Bluetooth ON
- C: WiFi ON, Bluetooth ON

### Steps

1. **Device B (middle)**: Start scanning
2. **Device C (gateway)**: Start scanning  
3. **Device A (isolated)**: 
   - Trigger SOS
   - Message queued (no direct path to WiFi)
4. Wait 30 seconds...
5. **Device B** should discover **Device A**, exchange packets
6. **Device B** discovers **Device C**, sends relayed message
7. **Device C** syncs to Firebase
8. Check relief map - SOS appears with **hops: 2**

### Expected Details

**Device A → Device B → Device C → Firebase**

Packet structure should show:
```json
{
  "hops": 2,  // A→B is hop 1, B→C is hop 2
  "origin": "device_A_id",
  "ttl": 43200000,  // Still valid
}
```

---

## Performance Profiling

### Battery Impact Test

1. Start app, enable mesh
2. Monitor battery with ADB:
   ```bash
   adb shell dumpsys batteryproperties
   ```
3. Leave scanning ON for 1 hour
4. Compare battery drain

**Expected**: ~5-10% per hour continuous scanning


### Memory Leak Check

```bash
# Monitor memory usage
adb shell am dumpheap <pid> /data/anr/heap.dump
```

Should stay stable over time, not increase continuously.

---

## Common Issues & Debugging

### Issue 1: "[BLE] Not available: Unauthorized"

**Cause**: Bluetooth permission not granted  
**Fix**:
```bash
# Check permission status
adb shell dumpsys package com.abhinav031.safeconnect | grep permission

# Manually grant (for testing)
adb shell pm grant com.abhinav031.safeconnect android.permission.BLUETOOTH_SCAN
adb shell pm grant com.abhinav031.safeconnect android.permission.BLUETOOTH_CONNECT
```

### Issue 2: "[BLE] Init timeout — Bluetooth may be disabled"

**Cause**: Bluetooth is OFF or service initialization stalled  
**Fix**:
1. Ensure Bluetooth is ON in system settings
2. Restart the app
3. Check for app crashes in Android Studio logcat

### Issue 3: No "Nearby Nodes" showing on Home

**Cause**: Peer count not updating  
**Check**:
```bash
# Verify peer count is being tracked
adb logcat | grep "Total peers"

# Should show increases when devices connect
```

### Issue 4: Packets not relaying offline

**Cause**: Scanning not running continuously  
**Fix**: 
1. HomeScreen should call `bleMeshService.startScanning()` after permissions
2. Add to a `useEffect()` or on screen focus
3. Or manually tap "Start Scanning" in MeshStatusScreen

---

## Verification Checklist

After running tests, verify all these metrics:

| Scenario | Metric | Expected | Actual |
|----------|--------|----------|--------|
| Init | BLE ready | ✅ | [ ] |
| Init | Permissions requested | ✅ | [ ] |
| Discovery | Peer count > 0 | ✅ | [ ] |
| Offline | Relay queue populated | ✅ | [ ] |
| Offline | Message queued (no internet) | ✅ | [ ] |
| Online | Message synced to Firebase | ✅ | [ ] |
| Multiple Hops | Hops incremented correctly | ✅ | [ ] |
| Multiple Hops | TTL checked | ✅ | [ ] |

---

## Getting Help / Reporting Issues

If you encounter problems:

1. **Collect logs:**
   ```bash
   adb logcat > mesh_debug_<date>.log
   ```

2. **Include in bug report:**
   - Device model & Android version  
   - Full logcat output
   - Steps to reproduce
   - Expected vs actual behavior

3. **Key log patterns to look for:**
   - `[BLE]` - Bluetooth state changes
   - `[Permission]` - Permission request status
   - `[Relay]` - Queue operations
   - `ERROR` or `Exception` - Any crashes

---

## Success Criteria

Your mesh feature is **working correctly** when:

✅ **Single Device**:
- App initializes without errors
- BLE shows "Ready ✅"
- Peer count visible in Home screen

✅ **Two Devices**:  
- Each device discovers the other
- Peer count shows "1"
- Can send test SOS between devices

✅ **Offline Mode**:
- SOS queued when WiFi OFF
- Relayed through discoverable peers
- Appears on relief map when gateway syncs

✅ **Multiple Hops**:
- 3+ device chain works
- Hop count increments
- TTL prevents infinite loops

Once all these pass, your mesh is **production ready** for disaster scenarios!
