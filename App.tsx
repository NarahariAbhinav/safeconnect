import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { StatusBar } from 'react-native';
import { MD3LightTheme, Provider as PaperProvider } from 'react-native-paper';
import AppNavigator from './src/navigation/AppNavigator';

// Define the "Calm in Chaos" Theme (Teal/Emerald)
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#00695C',       // Dark Teal (Safety)
    onPrimary: '#FFFFFF',
    secondary: '#4DB6AC',     // Light Teal
    tertiary: '#D32F2F',      // Emergency Red
    background: '#FFFFFF',
    surface: '#F5F5F5',
  },
};

const App = () => {
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <AppNavigator />
      </NavigationContainer>
    </PaperProvider>
  );
};

export default App;