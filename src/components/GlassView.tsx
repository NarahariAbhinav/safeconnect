import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';

interface GlassViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}

export default function GlassView({ children, style, intensity = 50 }: GlassViewProps) {
  // Android doesn't always handle real-time blur well, so we use a translucent fallback
  // iOS will look like real frosted glass
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.androidGlass, style]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} style={[styles.iosGlass, style]} tint="light">
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  iosGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Semi-transparent white
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
  },
  androidGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // Slightly more opaque for Android readability
    borderRadius: 20,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
  }
});