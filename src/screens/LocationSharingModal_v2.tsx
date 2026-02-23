/**
 * Simplified Location Sharing Modal - Robust Version
 * No reanimated, simpler layout for better reliability
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Path } from 'react-native-svg';
import { locationService } from '../services/location';

const COLORS = {
  bg: '#EBF4F7',
  orange: '#E05A2B',
  orangeLight: 'rgba(224,90,43,0.12)',
  brown: '#2C1A0E',
  green: '#2A7A5A',
  greenLight: 'rgba(42,122,90,0.12)',
  muted: '#8C7060',
  white: '#FFFFFF',
  red: '#D32F2F',
  blue: '#1565C0',
  blueLight: 'rgba(21,101,192,0.10)',
};

const LocationIcon = ({ color = COLORS.orange, size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      stroke={color}
      strokeWidth="1.8"
      fill="none"
    />
    <Circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
  </Svg>
);

const CheckIcon = ({ color = COLORS.green, size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" fill="none" />
    <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

interface LocationSharingModalProps {
  visible: boolean;
  userName: string;
  onClose: () => void;
  onShare: (duration: number) => void;
}

const LocationSharingModal: React.FC<LocationSharingModalProps> = ({
  visible,
  userName,
  onClose,
  onShare,
}) => {
  const [step, setStep] = useState<'permission' | 'location' | 'duration' | 'sharing'>('permission');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStep('permission');
      setIsLoading(false);
      setSelectedDuration(null);
      setCurrentLocation(null);
      setAddress(null);
      checkPermission();
    }
  }, [visible]);

  const checkPermission = async () => {
    try {
      const hasPermission = await locationService.checkLocationPermission();
      if (hasPermission) {
        await getLocation();
      } else {
        setStep('permission');
        await requestPermission(true);
      }
    } catch {
      setStep('permission');
    }
  };

  const requestPermission = async (autoTriggered = false) => {
    setIsLoading(true);
    try {
      const granted = await locationService.requestLocationPermission();
      if (granted) {
        await getLocation();
      } else {
        Alert.alert(
          'Permission Denied',
          autoTriggered
            ? 'To share your live location, allow location permission.\n\nIf no permission popup appears, open app settings and enable Location.'
            : 'Location access is required to share your location.\n\nPlease:\n1. Go to Settings\n2. Find SafeConnect\n3. Enable Location permission\n4. Return to the app',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to request location permission: ' + String(err).substring(0, 100));
    } finally {
      setIsLoading(false);
    }
  };

  const getLocation = async () => {
    setIsLoading(true);
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
        setStep('duration');
        try {
          const addr = await locationService.getAddressFromCoordinates(
            location.latitude,
            location.longitude
          );
          if (addr) setAddress(addr);
        } catch {
          // Address is optional — continue without it
        }
      } else {
        Alert.alert('Error', 'Unable to get current location. Please ensure:\n1. Location is enabled\n2. App has location permissions\n3. You are in an area with GPS signal');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to get location: ' + String(err).substring(0, 100));
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    if (!selectedDuration) {
      Alert.alert('Select Duration', 'Please select a sharing duration');
      return;
    }
    setStep('sharing');
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onShare(selectedDuration);
      setTimeout(() => {
        onClose();
        setStep('permission');
        setSelectedDuration(null);
        setCurrentLocation(null);
        setAddress(null);
      }, 1500);
    }, 1000);
  };

  const durations = [
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: 'Until I stop sharing', value: -1 },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        {/* Overlay background */}
        <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1} />

        {/* Modal */}
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Share Location</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Content */}
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Permission Step */}
            {step === 'permission' && (
              <View style={styles.stepContent}>
                <LocationIcon size={50} color={COLORS.orange} />
                <Text style={styles.stepTitle}>Enable Location</Text>
                <Text style={styles.stepText}>
                  SafeConnect needs access to your location to share it with your trusted contacts.
                </Text>
                <View style={styles.featureList}>
                  <View style={styles.featureItem}>
                    <Text style={styles.featureDot}>✓</Text>
                    <Text style={styles.featureText}>Real-time location tracking</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Text style={styles.featureDot}>✓</Text>
                    <Text style={styles.featureText}>Share with trusted contacts</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Text style={styles.featureDot}>✓</Text>
                    <Text style={styles.featureText}>Control sharing duration</Text>
                  </View>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>💡 Make sure:</Text>
                  <Text style={styles.infoSubtext}>• Location services are enabled on your phone</Text>
                  <Text style={styles.infoSubtext}>• You have GPS or network connectivity</Text>
                  <Text style={styles.infoSubtext}>• The app has permission to access location</Text>
                </View>
              </View>
            )}

            {/* Duration Step */}
            {step === 'duration' && currentLocation && (
              <View style={styles.stepContent}>
                <CheckIcon size={50} color={COLORS.green} />
                <Text style={styles.stepTitle}>Your Location </Text>
                <View style={styles.locationBox}>
                  <Text style={styles.locationText}>
                    📍 {locationService.formatLocationForDisplay(currentLocation)}
                  </Text>
                  {address && <Text style={styles.addressText}>{address}</Text>}
                  <Text style={styles.accuracyText}>
                    Accuracy: ±{Math.round(currentLocation.accuracy || 0)}m
                  </Text>
                </View>
                <Text style={styles.stepTitle}>Select Duration</Text>
                {durations.map((duration) => (
                  <TouchableOpacity
                    key={duration.value}
                    style={[
                      styles.durationBtn,
                      selectedDuration === duration.value && styles.durationBtnSelected,
                    ]}
                    onPress={() => setSelectedDuration(duration.value)}
                  >
                    <View style={styles.radioBtn}>
                      {selectedDuration === duration.value && <View style={styles.radioDot} />}
                    </View>
                    <Text style={styles.durationText}>{duration.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Sharing Step */}
            {step === 'sharing' && (
              <View style={[styles.stepContent, styles.sharingContent]}>
                {isLoading ? (
                  <>
                    <ActivityIndicator size="large" color={COLORS.blue} />
                    <Text style={styles.stepTitle}>Sharing...</Text>
                  </>
                ) : (
                  <>
                    <CheckIcon size={50} color={COLORS.green} />
                    <Text style={styles.stepTitle}>Location Shared!</Text>
                    <Text style={styles.stepText}>
                      Your location is now being shared for{' '}
                      {selectedDuration === -1 ? 'continuous tracking' : `${selectedDuration} minutes`}
                    </Text>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            {step === 'permission' && (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => requestPermission()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.btnText}>Enable Location</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.btn} onPress={onClose}>
                  <Text style={styles.btnTextSecondary}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'duration' && (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleShare}
                disabled={!selectedDuration || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnText}>Share Location</Text>
                )}
              </TouchableOpacity>
            )}

            {step === 'sharing' && !isLoading && (
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onClose}>
                <Text style={styles.btnText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    width: width * 0.92,
    height: height * 0.82,
    maxHeight: height * 0.85,
    minHeight: 460,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 24,
    color: COLORS.brown,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.brown,
  },
  content: {
    flex: 1,
    minHeight: 320,
  },
  contentContainer: {
    paddingHorizontal: 22,
    paddingVertical: 22,
    paddingBottom: 28,
  },
  stepContent: {
    alignItems: 'center',
  },
  sharingContent: {
    justifyContent: 'center',
    minHeight: 250,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.brown,
    marginTop: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  stepText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 22,
  },
  featureList: {
    width: '100%',
    backgroundColor: COLORS.greenLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureDot: {
    fontSize: 16,
    color: COLORS.green,
    fontWeight: 'bold',
    marginRight: 10,
  },
  featureText: {
    fontSize: 12,
    color: COLORS.brown,
    flex: 1,
  },
  infoBox: {
    width: '100%',
    backgroundColor: 'rgba(224, 90, 43, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.orange,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.brown,
    marginBottom: 6,
  },
  infoSubtext: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 3,
  },
  locationBox: {
    width: '100%',
    backgroundColor: COLORS.blueLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.blue,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.brown,
    marginBottom: 6,
  },
  addressText: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 6,
  },
  accuracyText: {
    fontSize: 12,
    color: COLORS.blue,
    fontWeight: '500',
  },
  durationBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: COLORS.white,
  },
  durationBtnSelected: {
    backgroundColor: COLORS.orangeLight,
    borderColor: COLORS.orange,
  },
  radioBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.orange,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.brown,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 8,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.orange,
  },
  btnPrimary: {
    backgroundColor: COLORS.orange,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  btnTextSecondary: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.orange,
  },
});

export default LocationSharingModal;
