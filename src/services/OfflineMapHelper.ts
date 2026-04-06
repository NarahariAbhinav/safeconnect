import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const MAP_TILES_DIR = ((FileSystem as any).documentDirectory || 'file:///data/user/0/com.safeconnect/files/') + 'maptiles/';

// Download tiles for a specific region (simulated logic for specific city bounds)
export const downloadOfflineTiles = async (lat: number, lon: number) => {
    try {
        const dirInfo = await FileSystem.getInfoAsync(MAP_TILES_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(MAP_TILES_DIR, { intermediates: true });
        }

        // Simplified bounds for demo: Z=14 around target area
        const zoom = 14;
        const tileX = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
        const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

        // Download a 3x3 grid around the user
        console.log('[OfflineMap] Downloading 9 tiles around user for offline use...');
        for (let x = tileX - 1; x <= tileX + 1; x++) {
            for (let y = tileY - 1; y <= tileY + 1; y++) {
                const url = `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
                const localPath = `${MAP_TILES_DIR}${zoom}_${x}_${y}.png`;

                const fileInfo = await FileSystem.getInfoAsync(localPath);
                if (!fileInfo.exists) {
                    await FileSystem.downloadAsync(url, localPath);
                }
            }
        }
        await AsyncStorage.setItem('offline_tiles_ready', 'true');
        console.log('[OfflineMap] ✅ Tiles cached successfully.');
    } catch (error) {
        console.log('[OfflineMap] Error downloading tiles:', error);
    }
};

export const getTilePath = () => {
    return MAP_TILES_DIR + '{z}_{x}_{y}.png';
};
