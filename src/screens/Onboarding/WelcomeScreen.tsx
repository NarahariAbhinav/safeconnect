import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

type WelcomeScreenProps = {
  navigation: any;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 30,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFB', '#E8F4F8', '#DDE9F0']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative background shapes */}
      <Svg height={height} width={width} style={styles.bgShapes}>
        <Circle cx={width * 0.15} cy={height * 0.12} r="60" fill="#4A90A4" opacity="0.08" />
        <Circle cx={width * 0.85} cy={height * 0.75} r="90" fill="#E8B59B" opacity="0.1" />
        <Circle cx={width * 0.5} cy={height * 0.9} r="70" fill="#6BBF9A" opacity="0.08" />
      </Svg>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* No Logo - Direct to Title */}
        <Text style={styles.title}>SafeConnect</Text>
        
        <Text style={styles.subtitle}>
          Stay connected{'\n'}when it matters most
        </Text>

        <Text style={styles.description}>
          Communicate without internet during{'\n'}
          emergencies through mesh networking
        </Text>

        {/* Visual illustration - abstract connection */}
        <View style={styles.illustrationContainer}>
          <Svg height="180" width="220" viewBox="0 0 220 180">
            {/* Three connected nodes */}
            <Circle cx="40" cy="90" r="28" fill="#4A90A4" opacity="0.15" />
            <Circle cx="110" cy="50" r="28" fill="#6BBF9A" opacity="0.15" />
            <Circle cx="180" cy="90" r="28" fill="#E8B59B" opacity="0.15" />
            
            <Circle cx="40" cy="90" r="12" fill="#4A90A4" />
            <Circle cx="110" cy="50" r="12" fill="#6BBF9A" />
            <Circle cx="180" cy="90" r="12" fill="#E8B59B" />
            
            {/* Connecting lines */}
            <Path d="M 40 90 L 110 50" stroke="#4A90A4" strokeWidth="2" strokeDasharray="5,5" opacity="0.4" />
            <Path d="M 110 50 L 180 90" stroke="#6BBF9A" strokeWidth="2" strokeDasharray="5,5" opacity="0.4" />
            <Path d="M 40 90 L 180 90" stroke="#E8B59B" strokeWidth="2" strokeDasharray="5,5" opacity="0.3" />
          </Svg>
        </View>

        {/* Progress dots */}
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Permissions')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4A90A4', '#5FA1B5']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgShapes: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#4A90A4',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  illustrationContainer: {
    marginBottom: 50,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 40,
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
    width: width - 64,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4A90A4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 22,
  },
});