import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

type ProfileSetupScreenProps = {
  navigation: any;
};

export default function ProfileSetupScreen({ navigation }: ProfileSetupScreenProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [showMedical, setShowMedical] = useState(false);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFB', '#E8F4F8']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Your Profile</Text>
          <Text style={styles.subtitle}>
            Help your circle recognize you
          </Text>

          {/* Profile Photo Placeholder */}
          <TouchableOpacity style={styles.photoButton}>
            <LinearGradient
              colors={['#4A90A4', '#5FA1B5']}
              style={styles.photoGradient}
            >
              <Text style={styles.photoText}>Add Photo</Text>
              <Text style={styles.photoSubtext}>Optional</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 XXXXX XXXXX"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {/* Medical Info Toggle */}
          <TouchableOpacity
            style={styles.medicalToggle}
            onPress={() => setShowMedical(!showMedical)}
          >
            <Text style={styles.medicalToggleText}>
              {showMedical ? '▼' : '▶'} Add Medical Information
            </Text>
            <Text style={styles.medicalOptional}>Optional</Text>
          </TouchableOpacity>

          {showMedical && (
            <View style={styles.medicalSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Blood Type</Text>
                <View style={styles.bloodTypeGrid}>
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.bloodTypeButton,
                        bloodType === type && styles.bloodTypeActive,
                      ]}
                      onPress={() => setBloodType(type)}
                    >
                      <Text
                        style={[
                          styles.bloodTypeText,
                          bloodType === type && styles.bloodTypeTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Allergies</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Any allergies or medical conditions"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          )}

          {/* Progress dots */}
          <View style={styles.dotsContainer}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('AddContacts')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4A90A4', '#5FA1B5']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
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
    marginBottom: 32,
  },
  photoButton: {
    alignSelf: 'center',
    marginBottom: 32,
    borderRadius: 60,
    overflow: 'hidden',
    shadowColor: '#4A90A4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  photoGradient: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoSubtext: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 80,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  medicalToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  medicalToggleText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A90A4',
  },
  medicalOptional: {
    fontSize: 13,
    color: '#94A3B8',
  },
  medicalSection: {
    backgroundColor: '#F8FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bloodTypeButton: {
    width: (width - 128) / 4,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  bloodTypeActive: {
    backgroundColor: '#4A90A4',
    borderColor: '#4A90A4',
  },
  bloodTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  bloodTypeTextActive: {
    color: '#FFFFFF',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    marginTop: 20,
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
});