import React from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Avatar, FAB, Surface, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { toggleEmergencyMode } from '../../store/uiSlice';

interface QuickActionProps {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

interface ChatItemProps {
  name: string;
  message: string;
  time: string;
  unread: number;
}

interface EmergencyButtonProps {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
  size?: 'medium' | 'large';
}

interface HomeScreenProps {
  navigation?: any;
}

// --- Components for Normal Mode ---

const QuickAction = ({ icon, label, color, onPress }: QuickActionProps) => {
  const [scale] = React.useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.actionItem, { transform: [{ scale }] }]}>
      <TouchableOpacity 
        onPress={onPress} 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCircle, { backgroundColor: color }]}>
          <MaterialCommunityIcons name={icon} size={26} color="#FFFFFF" />
        </View>
        <Text variant="labelSmall" style={styles.actionLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ChatItem = ({ name, message, time, unread }: ChatItemProps) => {
  const colors = ['#2563eb', '#7c3aed', '#dc2626', '#059669', '#ea580c'];
  const hashCode = name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  const bgColor = colors[hashCode % colors.length];

  return (
    <TouchableOpacity style={styles.chatItemWrapper} activeOpacity={0.6}>
      <View style={styles.chatItemContent}>
        <Avatar.Text 
          size={52} 
          label={name.substring(0, 2).toUpperCase()} 
          style={{ backgroundColor: bgColor }} 
          color="#fff"
          labelStyle={{ fontSize: 18, fontWeight: '600' }}
        />
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text variant="titleMedium" style={styles.chatName}>{name}</Text>
            <Text variant="labelSmall" style={styles.chatTime}>{time}</Text>
          </View>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.chatMessage}>{message}</Text>
        </View>
        {unread > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: bgColor }]}>
            <Text style={styles.unreadText}>{unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// --- Components for Emergency Mode ---

const EmergencyButton = ({ label, icon, color, onPress, size = 'medium' }: EmergencyButtonProps) => {
  const [scale] = React.useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, size === 'large' ? { flex: 1 } : { flex: 1 }]}>
      <TouchableOpacity
        style={[
          styles.emergencyBtn,
          { backgroundColor: color },
          size === 'large' && styles.emergencyBtnLarge
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name={icon} size={size === 'large' ? 56 : 28} color="#fff" />
        <Text variant={size === 'large' ? "headlineMedium" : "titleMedium"} style={styles.emergencyBtnText}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- Main Screen ---

const HomeScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const isEmergency = useSelector((state: RootState) => state.ui.isEmergencyMode);
  const theme = useTheme();

  // Mock Data for Chats
  const mockChats = [
    { id: '1', name: 'Family Group', message: 'Dad: Is everyone home?', time: '10:30 AM', unread: 2 },
    { id: '2', name: 'Rohan', message: 'I sent the PDF file.', time: 'Yesterday', unread: 0 },
    { id: '3', name: 'Team LifeMesh', message: 'Meeting at library?', time: 'Yesterday', unread: 0 },
    { id: '4', name: 'Mom', message: 'Don\'t forget to bring groceries', time: '2 days ago', unread: 0 },
  ];

  return (
    <View style={[styles.container, isEmergency ? styles.containerEmergency : styles.containerNormal]}>
      
      {/* HEADER */}
      <Surface style={[styles.header, isEmergency ? styles.headerEmergency : styles.headerNormal]} elevation={0}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons 
                name={isEmergency ? "alert-octagon" : "shield-check"} 
                size={32} 
                color={isEmergency ? "#dc2626" : "#2563eb"} 
              />
            </View>
            <View style={styles.headerText}>
              <Text variant="headlineSmall" style={[styles.appTitle, isEmergency && styles.appTitleEmergency]}>
                {isEmergency ? 'Emergency Mode' : 'SafeConnect'}
              </Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: isEmergency ? '#ef4444' : '#10b981' }]} />
                <Text variant="labelMedium" style={[styles.statusText, isEmergency ? styles.statusTextEmergency : styles.statusTextNormal]}>
                  {isEmergency ? 'Broadcasting Alert' : 'Active • 3 Nearby'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.switchContainer}>
            <Text variant="labelSmall" style={[styles.switchLabel, isEmergency && styles.switchLabelEmergency]}>
              {isEmergency ? 'ON' : 'OFF'}
            </Text>
            <Switch
              value={isEmergency}
              onValueChange={(value) => { dispatch(toggleEmergencyMode()); }}
              trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
              thumbColor={isEmergency ? '#dc2626' : '#ffffff'}
            />
          </View>
        </View>
      </Surface>

      {/* BODY */}
      {isEmergency ? (
        // --- EMERGENCY LAYOUT ---
        <ScrollView contentContainerStyle={styles.emergencyBody} showsVerticalScrollIndicator={false}>
          
          <View style={styles.emergencyAlertBanner}>
            <MaterialCommunityIcons name="alert-circle" size={24} color="#dc2626" />
            <View style={styles.alertTextContainer}>
              <Text style={styles.alertTitle}>Emergency Protocol Active</Text>
              <Text style={styles.alertSubtitle}>
                Your location and status are being shared via mesh network
              </Text>
            </View>
          </View>

          <View style={styles.sosContainer}>
            <EmergencyButton 
              label="BROADCAST SOS" 
              icon="broadcast" 
              color="#dc2626" 
              size="large"
              onPress={() => Alert.alert('SOS Broadcasting', 'Sending emergency alert to all nearby devices and emergency contacts.')} 
            />
          </View>

          <Text style={styles.sectionTitle}>Update Your Status</Text>
          <View style={styles.statusRow}>
            <EmergencyButton 
              label="I'm Safe" 
              icon="check-circle" 
              color="#059669" 
              onPress={() => Alert.alert('Status Updated', 'Marked as SAFE and notified your network.')}
            />
            <EmergencyButton 
              label="Need Help" 
              icon="alert-octagon" 
              color="#ea580c" 
              onPress={() => Alert.alert('Status Updated', 'Marked as NEED HELP. Broadcasting to nearby users.')}
            />
          </View>

          <Text style={styles.sectionTitle}>Emergency Tools</Text>
          <View style={styles.toolsRow}>
            <TouchableOpacity 
              style={styles.toolBtn} 
              onPress={() => Alert.alert('Flashlight', 'Turning on flashlight...')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="flashlight" size={28} color="#fff" />
              <Text style={styles.toolText}>Flashlight</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.toolBtn} 
              onPress={() => Alert.alert('Siren', 'Playing siren sound...')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="bullhorn" size={28} color="#fff" />
              <Text style={styles.toolText}>Siren</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.toolBtn} 
              onPress={() => Alert.alert('Location', 'Sharing precise GPS location...')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={28} color="#fff" />
              <Text style={styles.toolText}>GPS</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emergencyInfoBox}>
            <MaterialCommunityIcons name="information" size={20} color="#64748b" />
            <Text style={styles.emergencyInfoText}>
              Turn off Emergency Mode when you're safe. This will stop broadcasting your location.
            </Text>
          </View>
        </ScrollView>
      ) : (
        // --- NORMAL LAYOUT ---
        <ScrollView style={styles.normalBody} showsVerticalScrollIndicator={false}>
          
          {/* Quick Actions Grid */}
          <View style={styles.quickActionsContainer}>
            <View style={styles.sectionHeaderContainer}>
              <Text variant="titleMedium" style={styles.sectionHeader}>Quick Actions</Text>
            </View>
            <View style={styles.actionRow}>
              <QuickAction icon="message-text" label="New Chat" color="#2563eb" onPress={() => console.log('New Chat')} />
              <QuickAction icon="broadcast" label="Broadcast" color="#7c3aed" onPress={() => console.log('Broadcast')} />
              <QuickAction icon="share-variant" label="Share File" color="#ea580c" onPress={() => console.log('Share File')} />
              <QuickAction icon="map-marker" label="Location" color="#059669" onPress={() => console.log('Location')} />
            </View>
          </View>

          {/* Recent Chats List */}
          <View style={styles.chatListContainer}>
            <View style={styles.sectionHeaderContainer}>
              <Text variant="titleMedium" style={styles.sectionHeader}>Recent Conversations</Text>
              <TouchableOpacity style={styles.viewAllBtn}>
                <Text style={styles.viewAllText}>View All</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#2563eb" />
              </TouchableOpacity>
            </View>
            
            {mockChats.map((item) => (
              <ChatItem 
                key={item.id}
                name={item.name} 
                message={item.message} 
                time={item.time} 
                unread={item.unread} 
              />
            ))}
          </View>

          {/* Network Status Card */}
          <View style={styles.networkCard}>
            <View style={styles.networkHeader}>
              <MaterialCommunityIcons name="wifi" size={24} color="#059669" />
              <Text style={styles.networkTitle}>Mesh Network Status</Text>
            </View>
            <View style={styles.networkStats}>
              <View style={styles.networkStat}>
                <Text style={styles.networkStatValue}>3</Text>
                <Text style={styles.networkStatLabel}>Nearby Peers</Text>
              </View>
              <View style={styles.networkDivider} />
              <View style={styles.networkStat}>
                <Text style={styles.networkStatValue}>Strong</Text>
                <Text style={styles.networkStatLabel}>Signal</Text>
              </View>
              <View style={styles.networkDivider} />
              <View style={styles.networkStat}>
                <Text style={styles.networkStatValue}>12</Text>
                <Text style={styles.networkStatLabel}>Messages Sent</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Floating Action Button - Only in Normal Mode */}
      {!isEmergency && (
        <FAB
          icon="plus"
          style={styles.fab}
          color="#ffffff"
          onPress={() => Alert.alert('New Action', 'Start a new conversation or share content')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerNormal: { backgroundColor: '#f8fafc' },
  containerEmergency: { backgroundColor: '#1e293b' },

  // Header Styles
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerNormal: { 
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
  },
  headerEmergency: { 
    backgroundColor: '#0f172a',
    borderBottomColor: '#334155',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: { flex: 1 },
  appTitle: {
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  appTitleEmergency: { color: '#ffffff' },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: { 
    fontSize: 12, 
    fontWeight: '500',
  },
  statusTextNormal: { color: '#64748b' },
  statusTextEmergency: { color: '#cbd5e1' },
  switchContainer: { 
    alignItems: 'center',
    gap: 4,
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  switchLabelEmergency: {
    color: '#ef4444',
  },

  // Normal Mode Styles
  normalBody: { 
    flex: 1,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionHeader: {
    fontWeight: '700',
    color: '#0f172a',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    marginRight: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    flex: 1,
  },
  actionCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    color: '#475569',
  },

  chatListContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  chatItemWrapper: {
    marginBottom: 12,
  },
  chatItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatInfo: { flex: 1, marginLeft: 12 },
  chatHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 4,
    alignItems: 'center',
  },
  chatName: { 
    fontWeight: '600', 
    color: '#0f172a', 
    flex: 1,
  },
  chatTime: { 
    color: '#94a3b8', 
    marginLeft: 8,
    fontSize: 11,
  },
  chatMessage: { 
    color: '#64748b',
    fontSize: 14,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700',
  },

  networkCard: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  networkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 10,
  },
  networkStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  networkStat: {
    flex: 1,
    alignItems: 'center',
  },
  networkStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  networkStatLabel: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  networkDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e2e8f0',
  },

  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    backgroundColor: '#2563eb',
    borderRadius: 16,
  },

  // Emergency Mode Styles
  emergencyBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  emergencyAlertBanner: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  alertTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
  sosContainer: {
    width: '100%',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  emergencyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  emergencyBtnLarge: {
    paddingVertical: 56,
    borderRadius: 16,
  },
  emergencyBtnText: {
    color: '#fff',
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  toolBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  toolText: { 
    color: '#e2e8f0', 
    marginTop: 8, 
    fontWeight: '600', 
    fontSize: 13,
  },
  emergencyInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emergencyInfoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
});

export default HomeScreen;