import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { VideoGenerationProvider } from '../lib/VideoGenerationContext';

export default function RootLayout() {
    return (
        <VideoGenerationProvider>
            <StatusBar style="light" />
            <Slot />
        </VideoGenerationProvider>
    );
}
