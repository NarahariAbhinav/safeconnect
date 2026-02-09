import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useDispatch } from 'react-redux';
import { setOnboarded } from '../../store/uiSlice';

const { width } = Dimensions.get('window');

type AddContactsScreenProps = {
  navigation: any;
};

export default function AddContactsScreen({ navigation }: AddContactsScreenProps) {
  const dispatch = useDispatch();
  const [contacts, setContacts] = useState([
    { id: '1', name: 'Mom', phone: '+91 98765 43210' },
    { id: '2', name: 'Dad', phone: '+91 98765 43211' },
  ]);

  const ContactCard = ({ name, phone, onRemove }: { name: string; phone: string; onRemove: () => void }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactAvatar}>
        <Text style={styles.contactInitial}>{name[0]}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{name}</Text>
        <Text style={styles.contactPhone}>{phone}</Text>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <Text style={styles.removeText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFB', '#E8F4F8']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Your Circle</Text>
        <Text style={styles.subtitle}>
          Add people you want to stay{'\n'}connected with during emergencies
        </Text>

        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContactCard
              name={item.name}
              phone={item.phone}
              onRemove={() =>
                setContacts(contacts.filter((c) => c.id !== item.id))
              }
            />
          )}
          style={styles.contactsList}
          showsVerticalScrollIndicator={false}
        />

        {/* Add Contact Buttons */}
        <View style={styles.addButtonsContainer}>
          <TouchableOpacity style={styles.addButton}>
            <View style={styles.addIconContainer}>
              <Svg height="28" width="28" viewBox="0 0 24 24">
                <Rect x="4" y="4" width="16" height="16" rx="2" stroke="#4A90A4" strokeWidth="2" fill="none" />
                <Path d="M 8 8 L 16 16 M 16 8 L 8 16" stroke="#4A90A4" strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={styles.addButtonText}>Scan QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton}>
            <View style={styles.addIconContainer}>
              <Svg height="28" width="28" viewBox="0 0 24 24">
                <Path d="M 8 6 L 16 6 M 8 12 L 16 12 M 8 18 L 16 18" stroke="#6BBF9A" strokeWidth="2" strokeLinecap="round" />
                <Path d="M 4 4 L 4 20 L 20 20 L 20 4 Z" stroke="#6BBF9A" strokeWidth="2" fill="none" strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={styles.addButtonText}>From Contacts</Text>
          </TouchableOpacity>
        </View>

        {/* Progress dots */}
        <View style={styles.dotsContainer}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            dispatch(setOnboarded(true));
            navigation.navigate('MainTabs');
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4A90A4', '#5FA1B5']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>Complete Setup</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          dispatch(setOnboarded(true));
          navigation.navigate('MainTabs');
        }}>
          <Text style={styles.skipText}>I'll add contacts later</Text>
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
    marginBottom: 24,
  },
  contactsList: {
    marginBottom: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#4A90A4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A90A4',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: '#64748B',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 24,
    color: '#E76F73',
    lineHeight: 24,
  },
  addButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  addIconContainer: {
    marginBottom: 8,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
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