package com.anonymous.safeconnect.gatt

import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID

/**
 * Native Android GATT Server + BLE Advertiser for SafeConnect Mesh.
 *
 * This module creates a GATT server that:
 *   1. Advertises SC_SERVICE_UUID so other phones scanning can find this device
 *   2. Hosts a read/write characteristic (SC_CHAR_UUID) for mesh packet exchange
 *   3. Emits events to JS when a remote device writes a packet
 *
 * Combined with the existing Central (scanner) in BLEMeshService.ts,
 * this gives true bidirectional BLE mesh between SafeConnect phones.
 */
class GattServerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "GattServer"
        private val SC_SERVICE_UUID = UUID.fromString("4fafc201-1fb5-459e-8fcc-c5c9c331914b")
        private val SC_CHAR_UUID = UUID.fromString("beb5483e-36e1-4688-b7f5-ea07361b26a8")

        // Standard Client Characteristic Configuration Descriptor
        private val CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    }

    override fun getName(): String = "GattServerModule"

    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var isAdvertising = false
    private var isServerRunning = false

    // The latest packet to serve when a Central reads our characteristic
    private var currentPayload: ByteArray = ByteArray(0)

    // Track connected devices for notification
    private val connectedDevices = mutableSetOf<BluetoothDevice>()

    // ─── JS-callable methods ─────────────────────────────────────────

    /**
     * Start GATT server + BLE advertising.
     * Call once on app launch (after BLE permissions granted).
     */
    @ReactMethod
    fun startServer(promise: Promise) {
        try {
            val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            if (bluetoothManager == null) {
                promise.reject("BT_UNAVAILABLE", "BluetoothManager not available")
                return
            }

            val adapter = bluetoothManager.adapter
            if (adapter == null || !adapter.isEnabled) {
                promise.reject("BT_OFF", "Bluetooth is not enabled")
                return
            }

            // Create GATT server
            gattServer = bluetoothManager.openGattServer(reactContext, gattCallback)
            if (gattServer == null) {
                promise.reject("GATT_FAIL", "Could not open GATT server")
                return
            }

            // Build the SafeConnect service with a read/write/notify characteristic
            val characteristic = BluetoothGattCharacteristic(
                SC_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ or
                        BluetoothGattCharacteristic.PROPERTY_WRITE or
                        BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE or
                        BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ or
                        BluetoothGattCharacteristic.PERMISSION_WRITE
            )

            // Add CCCD for notifications
            val cccd = BluetoothGattDescriptor(
                CCCD_UUID,
                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
            )
            characteristic.addDescriptor(cccd)

            val service = BluetoothGattService(
                SC_SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
            )
            service.addCharacteristic(characteristic)

            gattServer!!.addService(service)
            isServerRunning = true
            Log.i(TAG, "GATT server started with service $SC_SERVICE_UUID")

            // Start advertising
            startAdvertising(adapter, promise)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Bluetooth permissions not granted: ${e.message}")
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to start GATT server: ${e.message}")
        }
    }

    /**
     * Stop GATT server + advertising.
     */
    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            stopAdvertising()
            gattServer?.close()
            gattServer = null
            isServerRunning = false
            connectedDevices.clear()
            Log.i(TAG, "GATT server stopped")
            promise.resolve(true)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", e.message)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Update the payload that will be served to scanning devices.
     * Call this whenever you have a new mesh packet to share.
     * @param base64Data Base64-encoded JSON mesh packet
     */
    @ReactMethod
    fun setPayload(base64Data: String, promise: Promise) {
        try {
            currentPayload = Base64.decode(base64Data, Base64.NO_WRAP)
            Log.d(TAG, "Payload updated (${currentPayload.size} bytes)")

            // Notify connected devices about the new payload
            notifyConnectedDevices()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set payload: ${e.message}")
        }
    }

    /**
     * Check if the GATT server is currently running and advertising.
     */
    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(isServerRunning && isAdvertising)
    }

    /**
     * Get count of currently connected Central devices.
     */
    @ReactMethod
    fun getConnectedCount(promise: Promise) {
        promise.resolve(connectedDevices.size)
    }

    // ─── Advertising ─────────────────────────────────────────────────

    private fun startAdvertising(adapter: BluetoothAdapter, promise: Promise) {
        advertiser = adapter.bluetoothLeAdvertiser
        if (advertiser == null) {
            // Device doesn't support BLE advertising
            Log.w(TAG, "BLE advertising not supported on this device")
            promise.resolve("server_only")  // Server works, just can't advertise
            return
        }

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0)  // Advertise indefinitely
            .build()

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)  // Save space in advertisement
            .addServiceUuid(ParcelUuid(SC_SERVICE_UUID))
            .build()

        try {
            advertiser!!.startAdvertising(settings, data, object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                    isAdvertising = true
                    Log.i(TAG, "BLE advertising started for $SC_SERVICE_UUID")
                    promise.resolve("advertising")
                }

                override fun onStartFailure(errorCode: Int) {
                    isAdvertising = false
                    val reason = when (errorCode) {
                        ADVERTISE_FAILED_DATA_TOO_LARGE -> "Data too large"
                        ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "Too many advertisers"
                        ADVERTISE_FAILED_ALREADY_STARTED -> "Already started"
                        ADVERTISE_FAILED_INTERNAL_ERROR -> "Internal error"
                        ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "Feature unsupported"
                        else -> "Unknown error $errorCode"
                    }
                    Log.w(TAG, "Advertising failed: $reason")
                    // Still resolve — server is running even without advertising
                    promise.resolve("server_only")
                }
            })
        } catch (e: SecurityException) {
            Log.w(TAG, "Advertising permission denied: ${e.message}")
            promise.resolve("server_only")
        }
    }

    private fun stopAdvertising() {
        try {
            if (isAdvertising && advertiser != null) {
                advertiser!!.stopAdvertising(object : AdvertiseCallback() {})
                isAdvertising = false
                Log.i(TAG, "Advertising stopped")
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Stop advertising permission error: ${e.message}")
        }
    }

    // ─── Notify connected devices of new data ───────────────────────

    private fun notifyConnectedDevices() {
        if (!isServerRunning || connectedDevices.isEmpty()) return

        val service = gattServer?.getService(SC_SERVICE_UUID) ?: return
        val characteristic = service.getCharacteristic(SC_CHAR_UUID) ?: return

        try {
            for (device in connectedDevices.toList()) {
                try {
                    characteristic.value = currentPayload
                    gattServer?.notifyCharacteristicChanged(device, characteristic, false)
                } catch (e: SecurityException) {
                    Log.w(TAG, "Notify failed for ${device.address}: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Notification error: ${e.message}")
        }
    }

    // ─── GATT Server Callback ────────────────────────────────────────

    private val gattCallback = object : BluetoothGattServerCallback() {

        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            try {
                if (newState == BluetoothGattServer.STATE_CONNECTED) {
                    connectedDevices.add(device)
                    Log.i(TAG, "Device connected: ${device.address} (${connectedDevices.size} total)")
                    sendEvent("onPeerConnected", Arguments.createMap().apply {
                        putString("deviceId", device.address)
                        putInt("peerCount", connectedDevices.size)
                    })
                } else if (newState == BluetoothGattServer.STATE_DISCONNECTED) {
                    connectedDevices.remove(device)
                    Log.i(TAG, "Device disconnected: ${device.address} (${connectedDevices.size} total)")
                    sendEvent("onPeerDisconnected", Arguments.createMap().apply {
                        putString("deviceId", device.address)
                        putInt("peerCount", connectedDevices.size)
                    })
                }
            } catch (e: SecurityException) {
                Log.w(TAG, "Connection state change error: ${e.message}")
            }
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic
        ) {
            try {
                if (characteristic.uuid == SC_CHAR_UUID) {
                    val responseData = if (offset < currentPayload.size) {
                        currentPayload.copyOfRange(offset, currentPayload.size)
                    } else {
                        ByteArray(0)
                    }
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, responseData)
                    Log.d(TAG, "Read request served: ${responseData.size} bytes to ${device.address}")
                } else {
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, 0, null)
                }
            } catch (e: SecurityException) {
                Log.w(TAG, "Read request error: ${e.message}")
            }
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            try {
                if (characteristic.uuid == SC_CHAR_UUID && value != null) {
                    // Send acknowledgement first
                    if (responseNeeded) {
                        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
                    }

                    // Emit the received data to JS
                    val base64Value = Base64.encodeToString(value, Base64.NO_WRAP)
                    Log.i(TAG, "Write received: ${value.size} bytes from ${device.address}")

                    sendEvent("onPacketReceived", Arguments.createMap().apply {
                        putString("data", base64Value)
                        putString("deviceId", device.address)
                    })
                } else {
                    if (responseNeeded) {
                        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, 0, null)
                    }
                }
            } catch (e: SecurityException) {
                Log.w(TAG, "Write request error: ${e.message}")
            }
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            try {
                // Handle CCCD writes for notification subscriptions
                if (responseNeeded) {
                    gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
                }
                Log.d(TAG, "Descriptor write from ${device.address}: notification ${if (value?.contentEquals(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == true) "enabled" else "disabled"}")
            } catch (e: SecurityException) {
                Log.w(TAG, "Descriptor write error: ${e.message}")
            }
        }
    }

    // ─── Event Emitter ───────────────────────────────────────────────

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
