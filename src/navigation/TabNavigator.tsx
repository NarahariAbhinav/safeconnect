import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

// Import Screens
import { Text, View } from 'react-native';
import GovtServicesScreen from '../screens/GovtServicesScreen';
import HomeScreen from '../screens/Home/HomeScreen';

// Placeholder screens for Phase 2
const MapPlaceholder = () => <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Text>Offline Map (Phase 2)</Text></View>;
const SettingsPlaceholder = () => <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Text>Settings (Phase 2)</Text></View>;

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const isEmergency = useSelector((state: RootState) => state.ui.isEmergencyMode);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isEmergency ? '#1e1e1e' : '#ffffff',
          borderTopColor: isEmergency ? '#333' : '#e0e0e0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: isEmergency ? '#ff5252' : '#2196f3',
        tabBarInactiveTintColor: isEmergency ? '#666' : '#757575',
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'circle';

          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'GovtServices') iconName = focused ? 'bank' : 'bank-outline';
          else if (route.name === 'Settings') iconName = focused ? 'cog' : 'cog-outline';

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Connect' }} />
      <Tab.Screen name="Map" component={MapPlaceholder} options={{ tabBarLabel: 'Radar' }} />
      <Tab.Screen name="GovtServices" component={GovtServicesScreen} options={{ tabBarLabel: 'Services' }} />
      <Tab.Screen name="Settings" component={SettingsPlaceholder} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
};

export default TabNavigator;