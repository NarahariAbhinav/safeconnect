import React from 'react';
import { StatusBar } from 'react-native';
import { MD3LightTheme, Provider as PaperProvider } from 'react-native-paper';
import { Provider as ReduxProvider } from 'react-redux';
import AppNavigator from './src/navigation/AppNavigator';
import { store } from './src/store/store';

const App = () => {
  // We can eventually link this to the Redux state, 
  // but for now we'll stick to a default theme provider wrapping
  
  return (
    <ReduxProvider store={store}>
      <PaperProvider theme={MD3LightTheme}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <AppNavigator />
      </PaperProvider>
    </ReduxProvider>
  );
};

export default App;