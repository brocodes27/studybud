import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { VideoGenerationProvider } from '../lib/VideoGenerationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <VideoGenerationProvider>
                <StatusBar style="light" />
                <Slot />
            </VideoGenerationProvider>
        </SafeAreaProvider>
    );
}
