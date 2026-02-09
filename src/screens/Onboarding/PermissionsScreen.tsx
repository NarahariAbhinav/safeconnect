import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

const PermissionCard = ({ icon, title, description }: { icon: React.ReactElement; title: string; description: string }) => (
  <View style={styles.permissionCard}>
    <View style={styles.iconCircle}>{icon}</View>
    <View style={styles.permissionText}>
      <Text style={styles.permissionTitle}>{title}</Text>
      <Text style={styles.permissionDesc}>{description}</Text>
    </View>
  </View>
);

type PermissionsScreenProps = {
  navigation: any;
};

export default function PermissionsScreen({ navigation }: PermissionsScreenProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFB', '#E8F4F8']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Quick Setup</Text>
        <Text style={styles.subtitle}>
          We need a few permissions to{'\n'}make SafeConnect work offline
        </Text>

        <View style={styles.permissionsContainer}>
          <PermissionCard
            icon={
              <Svg height="32" width="32" viewBox="0 0 24 24">
                <Circle cx="12" cy="12" r="3" fill="#4A90A4" />
                <Circle cx="12" cy="12" r="8" stroke="#4A90A4" strokeWidth="2" fill="none" />
                <Path d="M 12 2 L 12 5 M 12 19 L 12 22 M 2 12 L 5 12 M 19 12 L 22 12" stroke="#4A90A4" strokeWidth="2" strokeLinecap="round" />
              </Svg>
            }
            title="Location"
            description="To show you and your circle on the map"
          />

          <PermissionCard
            icon={
              <Svg height="32" width="32" viewBox="0 0 24 24">
                <Circle cx="12" cy="8" r="4" stroke="#6BBF9A" strokeWidth="2" fill="none" />
                <Path d="M 8 18 Q 12 15 16 18" stroke="#6BBF9A" strokeWidth="2" fill="none" strokeLinecap="round" />
                <Path d="M 5 12 Q 2 12 2 15 M 19 12 Q 22 12 22 15" stroke="#6BBF9A" strokeWidth="1.5" strokeLinecap="round" />
              </Svg>
            }
            title="Bluetooth"
            description="To connect with nearby devices via mesh"
          />

          <PermissionCard
            icon={
              <Svg height="32" width="32" viewBox="0 0 24 24">
                <Path d="M 18 8 L 6 8 L 6 18 L 18 18 L 18 8" stroke="#E8B59B" strokeWidth="2" fill="none" strokeLinecap="round" />
                <Path d="M 9 8 L 9 5 Q 9 3 11 3 L 13 3 Q 15 3 15 5 L 15 8" stroke="#E8B59B" strokeWidth="2" fill="none" strokeLinecap="round" />
                <Circle cx="12" cy="13" r="1.5" fill="#E8B59B" />
              </Svg>
            }
            title="Notifications"
            description="For emergency alerts and messages"
          />
        </View>

        {/* Progress dots */}
        <View style={styles.dotsContainer}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('ProfileSetup')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4A90A4', '#5FA1B5']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>Allow Permissions</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('ProfileSetup')}>
          <Text style={styles.skipText}>I'll do this later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
    marginBottom: 40,
  },
  permissionsContainer: {
    gap: 16,
    marginBottom: 50,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#4A90A4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  permissionDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    backgroundColor: '#4A90A4',
    width: 32,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#4A90A4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  skipText: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
});