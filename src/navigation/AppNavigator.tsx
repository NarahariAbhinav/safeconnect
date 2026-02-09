import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { useSelector } from 'react-redux';
import AddContactsScreen from '../screens/Onboarding/AddContactsScreen';
import PermissionsScreen from '../screens/Onboarding/PermissionsScreen';
import ProfileSetupScreen from '../screens/Onboarding/ProfileSetupScreen';
import WelcomeScreen from '../screens/Onboarding/WelcomeScreen';
import { RootState } from '../store/store';
import TabNavigator from './TabNavigator';

export type RootStackParamList = {
  Welcome: undefined;
  Permissions: undefined;
  ProfileSetup: undefined;
  AddContacts: undefined;
  MainTabs: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const isOnboarded = useSelector((state: RootState) => state.ui.isOnboarded);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isOnboarded ? (
          // Onboarding Stack
          <>
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
            />
            <Stack.Screen
              name="Permissions"
              component={PermissionsScreen}
            />
            <Stack.Screen
              name="ProfileSetup"
              component={ProfileSetupScreen}
            />
            <Stack.Screen
              name="AddContacts"
              component={AddContactsScreen}
            />
          </>
        ) : (
          // Main App Stack
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;