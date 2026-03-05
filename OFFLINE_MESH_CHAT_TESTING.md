# OFFLINE MODE & MESH CHAT - COMPLETE TESTING GUIDE

## Quick Fix Summary

**What was broken**:
- ❌ Mesh initialization missing from app startup
- ❌ No background relay service
- ❌ MeshChat not properly broadcasting over BLE mesh
- ❌ Offline messages not being relayed to nearby peers

**What's fixed**:
- ✅ BLE initializes when app loads
- ✅ Background relay service continuously tries to relay messages
- ✅ MeshChat properly broadcasts each message via BLE
- ✅ Chat messages relay to nearby devices even offline
- ✅ Automatic relay every 30 seconds
- ✅ Force relay when MeshChat screen opens

---

## Architecture: How Offline Mesh Chat Works

```
Device A (Offline)                Device B (Relay)              Device C (Gateway/Online)
    │                                   │                               │
    │───── sends "Hi" offline ────────>│                               │
    │  (queued in BLE relay)            │                               │
    │                                   │                               │
    │ <── BLE discovers B ────>         │                               │
    │                          (BLE relay broadcasts)                   │
    │                                   │───── relays to Firebase ────>│
    │                                   │    (C has WiFi)               │
    │                                   │                               │
    │ <──────── message delivered ──────┤ <── syncs back to A ────────>│
```

### Message Flow (Offline)

1. **User sends message** on Device A (WiFi OFF)
   - Message saved to AsyncStorage immediately (offline safe)
   - Broadcast via BLE mesh
   - Queued in `ble_relay_queue` for retry

2. **Background relay service** (every 30s)
   - Scans for nearby devices via BLE
   - Sends queued messages to discovered peers
   - Removes messages after successful send

3. **Device B receives message**
   - Processes via BLE mesh listener
   - Stores locally in AsyncStorage
   - If Device B has WiFi → syncs to Firebase
   - If Device B offline → relays to Device C

4. **Message reaches Firebase**
   - Once any device with WiFi receives it
   - Synced back to Device A (eventually)
   - Both sides see "✓✓ Delivered"

---

## Pre-Testing Requirements

### Device Setup
- [ ] 2-3 Android devices (or emulators)
- [ ] Bluetooth enabled on all
- [ ] Location permission granted
- [ ] App installed via EAS APK

### Testing Environment
- [ ] One device with WiFi hotspot enabled
- [ ] Way to toggle WiFi on/off per device
- [ ] USB cable for logcat monitoring (optional but helpful)

---

## Test #1: Basic Offline Chat (2 Devices)

### Setup
- Device A: WiFi OFF, Bluetooth ON
- Device B: WiFi OFF, Bluetooth ON
- Devices within 5-10 meters

### Steps

**Device A:**
1. Open app → Home → "Allow All Permissions"
2. Tap bottom menu → Mesh Chat
3. Tap on a trusted contact (or add one first)
4. Type: "Hello offline world!"
5. Tap send
6. Observe: Message appears on screen with "✓" (saved locally)

**Device B:**
1. Same setup
2. Open Mesh Chat with Device A contact
3. Wait 5-10 seconds
4. Message from Device A should appear

### Expected Logs
```
[Device A logs:]
[MeshChat] Broadcasting message via BLE mesh (offline safe)
[MeshChat] Message queued for BLE mesh relay ✅
[BLE] Enqueued relay packet
[BLERelay] Attempting to relay 1 packet(s)...

[Device B logs:]
[BLE] Found device: Device_A_ID
[BLE] ✅ Connected to peer Device_A_ID. Total peers: 1
[BLE] New packet received: chat from device_A...
[MeshChat] 📦 Received chat packet via BLE mesh: msg_123456
```

### Success Criteria
✅ Message appears on Device B within 30 seconds  
✅ Status shows "✓✓ Delivered" on Device A  
✅ Both devices can reply back  
✅ No error messages

---

## Test #2: Offline Chat with Gateway (3 Devices)

### Setup
- Device A: WiFi OFF (sender)
- Device B: WiFi OFF (relay/middle)
- Device C: WiFi ON (gateway)
- All Bluetooth ON
- Arrange: A — B — C (within 100m each pair)
- A and C NOT in direct range

### Steps

**Device A:**
1. Send message to B via Mesh Chat: "Can you relay?"
2. See message queued

**Device B:**
1. Receives message from A
2. Sees it in Mesh Chat

**Now enable WiFi on Device B:** (or use Device C)
- If B gets WiFi: Message auto-syncs to Firebase
- Check relief map: Should see chat message

**Device C (Gateway):**
1. WiFi already ON
2. Mesh Chat with B
3. Should see A's relayed message
4. Confirms message went through relay chain

### Expected Behavior

```
Timeline:
T=0s   Device A sends message (offline, queued)
T=2s   Background relay scans, finds B
T=3s   Message relayed from A to B (via BLE)
T=5s   Device B receives message (BLE listener)
T=7s   Background relay tries B to C
       (If B has WiFi) Syncs to Firebase
T=10s  Message appears on C & A confirmed delivered
```

### Success Criteria
✅ Message travels A → B → C  
✅ Appears on all 3 devices  
✅ Firebase has record (check in console)  
✅ Delivery status updates correctly

---

## Test #3: Re-entering Online (WiFi Recovery)

### Setup
- Device A: Send message while offline
- Device B: Online with WiFi
- Both devices within range

### Steps

1. **Disable WiFi on Device A**
   - Ensure it stays off
   - Open Mesh Chat

2. **Send message** from A: "Testing offline"
   - Should show: "✓ Saved locally"
   - May show in relay queue

3. **Device B receives via BLE** (within 30s)
   - Message appears in Mesh Chat
   - Automatically syncs to Firebase (B has WiFi)

4. **Device A turns WiFi back ON**
   - Wait 10 seconds
   - Check message status
   - Should update to: "✓✓ Delivered"

### Expected Behavior
```
Device A (offline then online):
[MeshChat] Broadcasting message via BLE mesh (offline safe)
[BLE] Enqueued relay packet
[BLERelay] Attempting to relay 1 packet(s)...
--- WiFi enabled ---
[Chat] Message delivered to Firebase ✅
Message status: ✓✓ Delivered
```

### Success Criteria
✅ Message shows "✓" when offline  
✅ B receives via BLE while A still offline  
✅ Status changes to "✓✓" when A gets WiFi  
✅ Message confirms delivery on both ends

---

## Test #4: Continuous Relay (Background Service)

### Purpose
Verify the background relay service works every 30 seconds

### Setup
- Device A: WiFi OFF, message sending mode
- Device B: WiFi OFF, receiving mode  
- Start BLE monitor (adb logcat)

### Steps

1. **Device A:** Send multiple messages: "Message 1", "Message 2", "Message 3"
2. **Watch logcat on Device A:**
   ```bash
   adb -s [device_id] logcat | grep BLERelay
   ```
3. **Expected every 30 seconds:**
   ```
   [BLERelay] Attempting to relay 1 packet(s)...
   [BLE] Found device: Device_B_ID
   [BLE] ✅ Connected to peer Device_B_ID. Total peers: 1
   ```

4. **Device B:** Receive messages as they're relayed
   - May not arrive all at once
   - Should arrive within 30 second retry window

### Success Criteria
✅ Background relay logs appear every ~30s  
✅ Device B receives all queued messages  
✅ No errors or crashes  
✅ App remains responsive

---

## Test #5: Multiple Users Relaying (Mesh Chain)

### Setup
4 devices: A, B, C, D
- A: Offline, originator
- B, C, D: All offline
- All Bluetooth ON
- Arranged: A—B—C—D (linear)

### Steps

1. **A sends:** "Hello mesh!"
2. **Background relay works:**
   - T=3s: A relays to B (within range)
   - T=6s: B relays to C (within range)
   - T=9s: C relays to D (within range)

3. **WiFi turned ON on D** (gateway)
   - Message syncs to Firebase
   - Response comes back: "Received from chain!"
   - Message propagates back: D→C→B→A

4. **Check all 4 devices:**
   - All see same message thread
   - Delivery statuses consistent

### Expected Packet Flow
```
A creates packet: {hops: 0, ttl: now + 12h}
→ B receives, increments: {hops: 1}
→ C receives, increments: {hops: 2}
→ D receives, increments: {hops: 3}
→ D has WiFi, uploads to Firebase
```

### Success Criteria
✅ Message travels through 4 hops  
✅ Hop count incremented correctly  
✅ TTL prevents infinite loops  
✅ Message appears on all devices  
✅ Firebase shows with max hops reached

---

## Debugging & Monitoring

### Key Log Patterns

```bash
# Watch all mesh activity
adb logcat | grep -E "\[BLE\]|\[MeshChat\]|\[BLERelay\]"

# Watch relay attempts
adb logcat | grep BLERelay

# Watch mesh packet flow
adb logcat | grep "packet"

# Watch chat events
adb logcat | grep Chat

# Check peer discoveries
adb logcat | grep "Found device\|peers:"
```

### Common Issues & Fixes

**Issue: Messages don't arrive offline**
```bash
# Check if background relay is running
adb logcat | grep "BLERelay.*Attempting"
# Should see every 30 seconds

# Check if packet is queued
adb logcat | grep "Enqueued relay"

# Check if BLE is scanning
adb logcat | grep "Scanning started"
```

**Issue: Status stuck on "✓ Saved"**
```bash
# Check if device is reaching WiFi
adb logcat | grep "Firebase\|isOnline"

# Manually check queue
adb shell dumpsys shared_preferences | grep -i chat
```

**Issue: Too many "Connected to peer" logs**
```bash
# BLE discovering same device multiple times
# This is normal! Means actively scanning

# But should filter duplicates
adb logcat | grep "Total peers"
# Should show stable count, not increasing infinitely
```

---

## Performance Monitoring

### Battery Drain
- Continuous scanning uses ~5-10% per hour
- Background relay every 30s is acceptable battery cost
- Optimize: Only scan when in Mesh Chat or SOS active

### Memory Usage
- Monitor for leaks:
  ```bash
  adb shell am dumpheap com.abhinav031.safeconnect /data/anr/heap.dump
  ```

### Network Traffic
- Each relay scan: ~1-2 KB
- Each chat message: ~500 bytes
- Minimal data impact

---

## Final Verification Checklist

After all tests pass:

| Feature | Test | Status |
|---------|------|--------|
| BLE initializes | Test #1 | [ ] ✅ |
| Offline messaging | Test #1 | [ ] ✅ |
| Chat via BLE mesh | Test #1 | [ ] ✅ |
| Multiple hops | Test #2 | [ ] ✅ |
| WiFi recovery | Test #3 | [ ] ✅ |
| Background relay | Test #4 | [ ] ✅ |
| Mesh chain (4+) | Test #5 | [ ] ✅ |
| No crashes | All tests | [ ] ✅ |
| Reasonable battery | All tests | [ ] ✅ |

---

## Building & Deploying

```bash
# Navigate to project
cd c:\Users\Abhinav\Documents\NMIMS\SEM 8\safeconnect

# Build APK
eas build --platform android --profile preview

# Deploy to EAS
# Use scanner QR code to install

# Or local build
npm install
npm run android
```

---

## Support

If tests fail, collect:
1. Full logcat output: `adb logcat > mesh_debug.log`
2. Device model and Android version
3. Steps to reproduce
4. Expected vs actual behavior

Email/share with: Debug logs + test results
