import React from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Divider, List, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const GovtServicesScreen = () => {
  const theme = useTheme();

  // Helper to open phone dialer
  const callNumber = (phone: string) => {
    let phoneNumber = phone;
    if (Platform.OS !== 'android') {
      phoneNumber = `telprompt:${phone}`;
    } else {
      phoneNumber = `tel:${phone}`;
    }
    Linking.openURL(phoneNumber);
  };

  // Helper to open SMS with pre-filled text
  const sendReport = (service: string) => {
    const body = `EMERGENCY REPORT: I need ${service} assistance. My location is: [GPS Lat/Long will be auto-filled here].`;
    const url = `sms:112${Platform.OS === 'ios' ? '&' : '?'}body=${body}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>Official Aid</Text>
        <Text variant="bodyMedium" style={styles.headerSub}>Offline Directory & Reporting</Text>
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>One-Tap Emergency Calls</Text>
        <View style={styles.grid}>
          <Card style={[styles.card, { backgroundColor: '#ffebee' }]} onPress={() => callNumber('100')}>
            <Card.Content style={styles.cardContent}>
              <MaterialCommunityIcons name="police-badge" size={32} color="#d32f2f" />
              <Text style={styles.cardText}>Police (100)</Text>
            </Card.Content>
          </Card>
          
          <Card style={[styles.card, { backgroundColor: '#e8f5e9' }]} onPress={() => callNumber('108')}>
            <Card.Content style={styles.cardContent}>
              <MaterialCommunityIcons name="ambulance" size={32} color="#2e7d32" />
              <Text style={styles.cardText}>Ambulance (108)</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.card, { backgroundColor: '#fff3e0' }]} onPress={() => callNumber('101')}>
            <Card.Content style={styles.cardContent}>
              <MaterialCommunityIcons name="fire-truck" size={32} color="#ef6c00" />
              <Text style={styles.cardText}>Fire (101)</Text>
            </Card.Content>
          </Card>

          <Card style={[styles.card, { backgroundColor: '#e3f2fd' }]} onPress={() => callNumber('1078')}>
            <Card.Content style={styles.cardContent}>
              <MaterialCommunityIcons name="lifebuoy" size={32} color="#0277bd" />
              <Text style={styles.cardText}>Disaster (1078)</Text>
            </Card.Content>
          </Card>
        </View>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Report Incident (SMS)</Text>
        <Text variant="bodySmall" style={{marginBottom: 10, color: '#666'}}>
          Generates a formatted SMS to send to authorities if internet is down.
        </Text>
        
        <List.Item
          title="Report Fire"
          description="Send location & fire alert"
          left={props => <List.Icon {...props} icon="fire" color="#ef6c00" />}
          right={props => <List.Icon {...props} icon="message-arrow-right-outline" />}
          onPress={() => sendReport('FIRE')}
          style={styles.listItem}
        />
        <Divider />
        <List.Item
          title="Report Medical Emergency"
          description="Send location & casualty info"
          left={props => <List.Icon {...props} icon="medical-bag" color="#d32f2f" />}
          right={props => <List.Icon {...props} icon="message-arrow-right-outline" />}
          onPress={() => sendReport('MEDICAL')}
          style={styles.listItem}
        />
        <Divider />
        <List.Item
          title="Request Rescue"
          description="Flood/Earthquake entrapment"
          left={props => <List.Icon {...props} icon="human-handsup" color="#0277bd" />}
          right={props => <List.Icon {...props} icon="message-arrow-right-outline" />}
          onPress={() => sendReport('RESCUE')}
          style={styles.listItem}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    elevation: 2,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#333',
  },
  headerSub: {
    color: '#666',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#444',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 12,
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cardText: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 5,
  },
  listItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});

export default GovtServicesScreen;