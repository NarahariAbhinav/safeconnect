/**
 * Declaration shim for expo-location
 *
 * expo-location v19 does not have an `exports` field in its package.json,
 * which is required by `moduleResolution: "bundler"`. This shim tells
 * TypeScript where to find the types so the import resolves correctly.
 */
declare module 'expo-location' {
    export * from 'expo-location/build/index';
}
