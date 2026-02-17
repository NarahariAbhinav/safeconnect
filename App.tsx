import React from 'react';
import { StatusBar } from 'react-native';
import WelcomeScreen from './src/screens/WelcomeScreen';

const App = () => {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <WelcomeScreen />
    </>
  );
};

export default App;