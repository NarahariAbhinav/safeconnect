// Buffer polyfill — must be first import, needed for Nearby Connections data encoding
import { Buffer } from 'buffer';
(global as any).Buffer = Buffer;

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
