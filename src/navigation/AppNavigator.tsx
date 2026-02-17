import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import OnboardingScreen from '../screens/OnboardingScreen';

// Placeholder for the next screen (Login) so the button doesn't crash the app
const LoginScreenPlaceholder = () => <></>; 

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreenPlaceholder} />
    </Stack.Navigator>
  );
}