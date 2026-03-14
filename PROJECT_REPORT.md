# SafeConnect — Project Report

> **Purpose of this document:** A comprehensive overview of the SafeConnect project for context sharing with AI assistants. It covers project purpose, technology stack, architecture, all major features, data flows, file structure, and service descriptions.

---

## 1. Project Overview

**SafeConnect** is a **disaster-response mobile application** built with React Native (Expo). It is designed to keep people connected and coordinated during natural disasters or emergencies — especially when traditional internet infrastructure is unavailable (floods, earthquakes, power outages).

The app works **fully offline**, using Bluetooth/WiFi-Direct mesh networking to communicate between nearby devices. When internet is available, it syncs data to Firebase for broader reach.

**Target Platform:** Android (primary), iOS (secondary)  
**Academic Context:** NMIMS SEM 8 final year project  
**Build Tool:** Expo + EAS Build  

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo ~54 |
| Language | TypeScript 5.9 |
| Navigation | React Navigation v7 (Native Stack) |
| UI Library | React Native Paper v5, React Native Reanimated v4 |
| Animations | react-native-reanimated (Worklets architecture) |
| Offline Storage | AsyncStorage (@react-native-async-storage) |
| Cloud Database | Firebase Realtime Database (asia-southeast1) |
| Mesh Networking | expo-nearby-connections (Google Nearby Connections API) |
| Authentication | Fully local — SHA-256 hashed passwords via expo-crypto |
| Location | expo-location + Google Maps Geocoding API |
| Notifications | expo-notifications |
| Audio | expo-av |
| Contacts | expo-contacts |
| SMS | expo-sms |
| Crypto | expo-crypto |

---

## 3. Core Architecture Principles

### 3.1 Offline-First (DTN — Delay-Tolerant Networking)
Every action (SOS, chat, needs report, resource offer) is saved to **AsyncStorage immediately**, then synced to Firebase when internet becomes available. The app never blocks the user waiting for a network response.

### 3.2 BLE/WiFi Mesh Network (P2P)
The app uses **Google Nearby Connections** (via `expo-nearby-connections`) in `P2P_CLUSTER` strategy, which allows every device to simultaneously advertise and discover peers — creating a true multi-hop mesh. Messages hop device-to-device with a TTL and hop counter to prevent flooding.

### 3.3 Store-First Sync Queue
A sync queue in AsyncStorage accumulates records created offline. A background service periodically flushes the queue to Firebase when internet is detected.

---

## 4. Application Screens

### 4.1 WelcomeScreen
- Entry point of the app
- Shows branding and navigation options (Login / Sign Up)

### 4.2 OnboardingScreen
- First-time user walk-through
- Explains app features and disaster-preparedness tips

### 4.3 LoginScreen / SignupScreen
- Local authentication with SHA-256 hashed passwords stored in AsyncStorage
- No backend server required — works fully offline
- Session persisted via AsyncStorage key `safeconnect_currentUser`

### 4.4 HomeScreen
- Main dashboard after login
- Shows: SOS button, mesh status indicator (pulsing dot), quick-action buttons
- Requests Bluetooth + Location permissions on first load
- Triggers BLE mesh startup and background relay service
- Profile sheet (bottom drawer) with user info and logout

### 4.5 SOSScreen
- One-tap SOS activation
- Saves SOS record to AsyncStorage immediately
- Notifies trusted contacts via SMS (expo-sms) when internet is unavailable
- Broadcasts SOS packet via BLE mesh to all nearby peers
- Syncs to Firebase when online

### 4.6 MeshChatScreen
- Offline P2P chat between trusted contacts
- Messages saved locally first (1 tick = saved)
- Broadcast via BLE mesh to peers (2 ticks = mesh-delivered)
- Synced to Firebase when online (✓✓ = delivered)
- Message types: text, voice, location, sos_alert
- Uses `MeshChatHelper` for queuing undelivered messages

### 4.7 MeshStatusScreen
- Shows real-time BLE mesh status
- Lists connected peers
- Shows pending relay queue size
- Manual mesh start/stop controls

### 4.8 NeedsReportScreen
- Submit "I Need Help" reports with categories (food, water, medicine, shelter, rescue, medical_help)
- Records GPS location
- People count + notes
- Saved offline, synced to Firebase

### 4.9 ResourceOfferScreen
- Submit "I Can Help" offers with categories (food, water, medicine, shelter, vehicle, medical_skills, space)
- Saved offline, synced to Firebase

### 4.10 ReliefMapScreen
- Shows map of:
  - Active SOS signals
  - Needs reports
  - Resource offers
  - Relief camps
- Data loaded from Firebase or local cache

### 4.11 ContactsManagerScreen
- Manage trusted contacts (local phone contacts via expo-contacts)
- Mark contacts as "trusted" for emergency notifications

### 4.12 ContactDetailScreen
- View/edit a specific trusted contact
- See last known location of contact

### 4.13 EmergencyAccessScreen
- Quick access to emergency contacts
- Dial emergency numbers

### 4.14 LocationSharingModal_v2
- Share real-time GPS location with selected trusted contacts
- Optional expiry time
- Location encoded as mesh packet for offline delivery

---

## 5. Services

### 5.1 `auth.ts`
- Fully local authentication (no server required)
- `register()` — hashes password with SHA-256, saves user to AsyncStorage
- `login()` — verifies hash against stored record
- `logout()` — clears AsyncStorage session
- `getCurrentUser()` — reads session from AsyncStorage

### 5.2 `sos.ts`
- Core disaster coordination service
- Types: `SOSRecord`, `NeedsReport`, `ResourceOffer`, `GovtAction`
- `activateSOS()` — creates record, notifies contacts, broadcasts via mesh
- `deactivateSOS()` — marks SOS resolved
- `reportNeeds()` — store needs report
- `offerResource()` — store resource offer
- Sync queue pattern: offline records stored first, flushed to Firebase when online

### 5.3 `chatService.ts`
- Offline-first P2P chat
- Room ID = sorted pair of user IDs (e.g., `chat_room_userA_userB`)
- `sendMessage()` — saves locally, attempts Firebase sync
- `getMessages()` — reads from AsyncStorage, merges with Firebase data
- `syncFromFirebase()` — pulls new messages from Firebase
- Status tracking: `'sending'` → `'saved'` → `'delivered'`

### 5.4 `contacts.ts`
- Manages trusted contacts list in AsyncStorage
- `getTrustedContacts()`, `addTrustedContact()`, `removeTrustedContact()`
- Integration with expo-contacts for phone book access

### 5.5 `location.ts`
- Wraps expo-location
- `getCurrentLocation()` — gets GPS coordinates with timeout
- `reverseGeocode()` — converts coords to human-readable address
- Uses Google Maps Geocoding API with local address caching (2-min TTL, ~55m radius)
- Falls back gracefully when GPS is unavailable

### 5.6 `locationTrailService.ts`
- Records GPS trail for search-and-rescue purposes
- Stores timestamped location history in AsyncStorage

### 5.7 `notificationService.ts`
- Wraps expo-notifications
- `sendLocalNotification()` — in-app push notification
- `requestPermissions()` — asks user for notification permission
- Used for incoming mesh messages, SOS alerts, needs reports

### 5.8 `soundService.ts`
- Wraps expo-av
- Plays alert sounds for incoming SOS, chat messages

### 5.9 `batteryService.ts`
- Monitors device battery level
- Used to show warnings when battery is low during emergency

### 5.10 `permissionService.ts`
- Centralized permission request handler
- Requests: Bluetooth, Location (foreground + background), Notifications, Contacts, Microphone
- Returns permission status map
- Used by HomeScreen on first launch

### 5.11 `messages.ts`
- Firebase-level message helpers (higher-level than chatService)

---

## 6. BLE Mesh Services

### 6.1 `BLEMeshService.ts` (Core)
- Uses `expo-nearby-connections` (Google Nearby Connections on Android, MultipeerConnectivity on iOS)
- Strategy: `P2P_CLUSTER` — all devices advertise + discover simultaneously
- Each device acts as both sender and relay

**Packet Structure (`MeshPacket`):**
```ts
{
  id: string;          // UUID for deduplication
  type: 'sos' | 'needs' | 'resource' | 'ping' | 'govtAction' | 'chat';
  payload: string;     // JSON-stringified data
  origin: string;      // original sender's userId
  hops: number;        // incremented at each relay hop
  ttl: number;         // unix-ms expiry (12-hour window)
  createdAt: number;
}
```

**Key parameters:**
- `MAX_HOPS = 5` — maximum relay hops before packet is dropped
- `TTL_MS = 12 hours` — packets expire after 12 hours
- Seen-packet dedup stored in AsyncStorage (`ble_seen_packets`)
- Relay queue stored in AsyncStorage (`ble_relay_queue`)

**Key methods:**
- `initialize()` — starts advertising + discovery
- `broadcast(packet)` — sends to all connected peers
- `createChatPacket()` — creates a typed `chat` mesh packet
- `onPacket(callback)` — subscribe to incoming packets

### 6.2 `BLEBackgroundRelayService.ts`
- Runs every **30 seconds** in the background
- Fetches pending relay queue from AsyncStorage
- Attempts to re-broadcast all queued packets to currently connected peers
- Stops automatically when no peers are available

### 6.3 `MeshChatHelper.ts`
- Manages a separate pending queue specifically for chat messages (`mesh_chat_pending`)
- `queueForMeshRelay(roomId, message)` — adds message to queue
- `relayPendingMessages()` — attempts to relay all queued chat messages
- Auto-removes messages after **10 attempts** or **24 hours**
- `clearQueue()` — called on logout

### 6.4 `GattServer.ts`
- Legacy GATT server module (kept for backward compatibility)
- Exposes `SC_SERVICE_UUID` and `SC_CHAR_UUID` constants

---

## 7. Firebase Integration

**Database URL:** `https://safeconnect-f509c-default-rtdb.asia-southeast1.firebasedatabase.app`

**Data stored:**
- SOS records (active + historical)
- Needs reports
- Resource offers
- Chat messages (for cross-device sync when online)
- Relief camp data

**Firebase is optional** — the app works fully without it. Firebase is only used to:
1. Sync locally-created records when internet becomes available
2. Allow government dashboard to read disaster data
3. Enable chat delivery between devices not in BLE range

---

## 8. Government Dashboard

Located in `/dashboard/` — a standalone HTML/JS dashboard (`index.html`, `dashboard.js`) that reads from Firebase to display:
- Active SOS alerts on a map
- Needs reports aggregated by area
- Available resources
- Relief camp locations

---

## 9. Data Flow Diagrams

### 9.1 Offline Chat Message Flow
```
[User types message on Device A]
        ↓
[Saved to AsyncStorage immediately] ← offline safe
        ↓
[Broadcast via BLE mesh (Nearby Connections)]
        ↓
[Queued in ble_relay_queue for retry]
        ↓
[Background relay (every 30s) tries re-broadcast]
        ↓
[If Device B is in range → receives via BLE]
        ↓
[If WiFi available → synced to Firebase]
        ↓
[Device A gets "✓✓ Delivered" confirmation]
```

### 9.2 SOS Activation Flow
```
[User taps SOS button]
        ↓
[Gets GPS location]
        ↓
[Creates SOSRecord → saves to AsyncStorage]
        ↓
[Broadcasts SOS MeshPacket via BLE]  ←→  [Nearby devices relay it further]
        ↓
[Sends SMS to trusted contacts (if SMS available)]
        ↓
[If online → uploads to Firebase]
        ↓
[Government dashboard sees alert]
```

### 9.3 App Startup Flow
```
[App launches]
        ↓
[Check AsyncStorage for session]
        ↓ (logged in)
[HomeScreen loads]
        ↓
[Permission modal (if first launch)]
        ↓
[BLEMeshService.initialize()]  ← starts advertising + discovery
        ↓
[BLEBackgroundRelayService.startRelay()]  ← 30s retry loop
        ↓
[App ready for offline operation]
```

---

## 10. Key Design Decisions

| Decision | Reason |
|---|---|
| Expo over bare React Native | Faster development, managed native modules |
| expo-nearby-connections over react-native-ble-plx | BLE-PLX is Central-only on Android; Nearby Connections supports simultaneous advertise+discover for true mesh |
| AsyncStorage-first, Firebase-second | App must work without internet in disaster zones |
| Local auth (no backend server) | Reduces infrastructure dependency; app works offline completely |
| SHA-256 passwords locally | Simple security without requiring a backend auth server |
| P2P_CLUSTER strategy | Many-to-many mesh topology; each device is both sender and relay |
| 12-hour TTL on mesh packets | Balances delivery window vs. storage/bandwidth overhead |
| react-native-reanimated over Animated API | Fixes _tracking TypeError on RN 0.81 + New Architecture |

---

## 11. Project File Structure

```
safeconnect/
├── App.tsx                    # Root component, navigation setup, error boundary
├── index.ts                   # Entry point
├── app.json                   # Expo config
├── eas.json                   # EAS Build profiles
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
│
├── src/
│   ├── screens/
│   │   ├── WelcomeScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── SignupScreen.tsx
│   │   ├── HomeScreen.tsx          # Main dashboard + permission handler
│   │   ├── SOSScreen.tsx           # Emergency SOS
│   │   ├── MeshChatScreen.tsx      # Offline P2P chat
│   │   ├── MeshStatusScreen.tsx    # BLE mesh monitor
│   │   ├── NeedsReportScreen.tsx   # "I Need Help" form
│   │   ├── ResourceOfferScreen.tsx # "I Can Help" form
│   │   ├── ReliefMapScreen.tsx     # Map of SOS/needs/resources
│   │   ├── ContactsManagerScreen.tsx
│   │   ├── ContactDetailScreen.tsx
│   │   ├── EmergencyAccessScreen.tsx
│   │   └── LocationSharingModal_v2.tsx
│   │
│   ├── services/
│   │   ├── auth.ts                 # Local auth (SHA-256, AsyncStorage)
│   │   ├── sos.ts                  # SOS + needs + resource coordination
│   │   ├── chatService.ts          # Offline-first P2P chat
│   │   ├── contacts.ts             # Trusted contacts management
│   │   ├── location.ts             # GPS + reverse geocoding
│   │   ├── locationTrailService.ts # GPS trail recording
│   │   ├── notificationService.ts  # Local push notifications
│   │   ├── soundService.ts         # Alert audio
│   │   ├── batteryService.ts       # Battery level monitoring
│   │   ├── permissionService.ts    # Centralized permission requests
│   │   ├── messages.ts             # Firebase message helpers
│   │   └── ble/
│   │       ├── BLEMeshService.ts         # Core mesh networking
│   │       ├── BLEBackgroundRelayService.ts # 30s background retry loop
│   │       ├── MeshChatHelper.ts         # Chat-specific relay queue
│   │       └── GattServer.ts             # Legacy GATT (compat layer)
│   │
│   └── types/
│       └── expo-location.d.ts      # Type augmentation for expo-location
│
├── android/
│   └── app/src/main/java/.../
│       └── gatt/
│           ├── GattServerModule.kt   # Native Android GATT module
│           └── GattServerPackage.kt  # React Native bridge
│
├── dashboard/
│   ├── index.html              # Government dashboard UI
│   └── dashboard.js            # Firebase data reader + map renderer
│
└── assets/                     # Images, icons, fonts
```

---

## 12. AsyncStorage Keys Reference

| Key | Purpose |
|---|---|
| `safeconnect_currentUser` | Logged-in user session |
| `safeconnect_token` | Auth token |
| `safeconnect_users` | All registered users (local DB) |
| `ble_seen_packets` | Dedup store for mesh packets |
| `ble_relay_queue` | Pending outgoing mesh packets |
| `ble_sms_relayed` | SOS IDs already relayed via SMS |
| `mesh_chat_pending` | Pending chat messages for mesh relay |
| `chat_room_{id1}_{id2}` | Chat room metadata |
| `chat_messages_{roomId}` | Chat messages for a room |
| `trusted_contacts` | User's trusted contacts list |
| `sos_records` | Local SOS history |
| `needs_reports` | Local needs reports |
| `resource_offers` | Local resource offers |

---

## 13. Permissions Required

| Permission | Purpose |
|---|---|
| BLUETOOTH + BLUETOOTH_SCAN + BLUETOOTH_ADVERTISE + BLUETOOTH_CONNECT | BLE mesh networking |
| ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION | GPS for SOS/needs reports; required by Android for BLE scan |
| ACCESS_BACKGROUND_LOCATION | Location trail in background |
| SEND_SMS | Notify trusted contacts when offline |
| READ_CONTACTS | Import trusted contacts from phone |
| POST_NOTIFICATIONS | In-app alerts for incoming messages/SOS |
| RECORD_AUDIO | Voice messages in MeshChat |

---

## 14. Summary

SafeConnect is an **offline-first disaster-response app** that:
1. Works **without internet** using BLE/WiFi-Direct mesh (Google Nearby Connections)
2. Provides **SOS alerts**, **P2P chat**, **needs/resource coordination**, and **location sharing**
3. Syncs data to **Firebase** when connectivity is restored
4. Stores everything locally in **AsyncStorage** first
5. Uses a **relay queue** to deliver messages through intermediate devices (DTN pattern)
6. Has a separate **government dashboard** that reads from Firebase

The primary use case is a **disaster zone** where cell towers are down but people still have their phones — devices form an ad-hoc mesh network to coordinate rescue and relief efforts.
