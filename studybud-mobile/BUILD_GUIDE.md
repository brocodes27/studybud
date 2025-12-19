# StudyBud Mobile - Build & Export Guide

This guide will help you build and export your StudyBud mobile app for both Android (APK) and iOS.

## Prerequisites

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Configure your project**:
   ```bash
   eas build:configure
   ```
   - This will create an EAS project ID and update your app.json

## Building for Android (APK)

### Option 1: Production APK (Recommended)
```bash
eas build --platform android --profile production
```

### Option 2: Preview APK (For Testing)
```bash
eas build --platform android --profile preview
```

### What happens:
- EAS will build your app in the cloud
- You'll get a download link when the build completes
- The APK will be ready to install on Android devices
- Build time: ~10-15 minutes

### Download the APK:
1. After build completes, you'll get a URL
2. Download the APK file
3. Transfer to your Android device
4. Enable "Install from Unknown Sources" in Android settings
5. Install the APK

## Building for iOS

### Option 1: Production Build (For App Store)
```bash
eas build --platform ios --profile production
```

### Option 2: Simulator Build (For Testing on Mac)
```bash
eas build --platform ios --profile preview
```

### Important iOS Notes:
- **You need an Apple Developer Account** ($99/year)
- **For App Store**: You'll need to configure certificates and provisioning profiles
- **For Testing**: Use TestFlight or simulator builds

### iOS Setup (First Time):
1. Go to https://developer.apple.com
2. Create/login to your Apple Developer account
3. EAS will guide you through certificate creation
4. Follow the prompts to set up provisioning profiles

## Building Both Platforms at Once

```bash
eas build --platform all --profile production
```

## Local Builds (Alternative)

If you prefer to build locally instead of using EAS:

### Android Local Build:
```bash
# Install dependencies
npm install

# Build APK locally
npx expo prebuild
cd android
./gradlew assembleRelease

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

### iOS Local Build (Mac only):
```bash
# Install dependencies
npm install

# Build for iOS
npx expo prebuild
cd ios
pod install
xcodebuild -workspace StudyBud.xcworkspace -scheme StudyBud -configuration Release
```

## Environment Variables

Make sure your `.env` file is properly configured:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_VIDEO_SERVER_URL=your_video_server_url
```

## Build Profiles Explained

### Development
- For testing during development
- Includes development tools
- Larger file size

### Preview
- For internal testing
- Smaller than development
- Android: Builds APK
- iOS: Builds for simulator

### Production
- For app store submission
- Optimized and minified
- Android: Builds APK or AAB
- iOS: Builds for App Store

## Troubleshooting

### Build Fails
1. Check your `app.json` configuration
2. Ensure all dependencies are installed
3. Check EAS build logs for specific errors

### Android APK Not Installing
1. Enable "Install from Unknown Sources"
2. Check if you have enough storage
3. Try uninstalling old version first

### iOS Build Issues
1. Verify Apple Developer account is active
2. Check certificate expiration
3. Ensure bundle identifier matches

## Quick Commands Reference

```bash
# Check build status
eas build:list

# View build details
eas build:view [build-id]

# Cancel a build
eas build:cancel

# Configure project
eas build:configure

# Update credentials
eas credentials
```

## App Store Submission

### Google Play Store (Android):
1. Build AAB instead of APK: `eas build --platform android --profile production`
2. Go to https://play.google.com/console
3. Create a new app
4. Upload the AAB file
5. Fill in store listing details
6. Submit for review

### Apple App Store (iOS):
1. Build for production: `eas build --platform ios --profile production`
2. Go to https://appstoreconnect.apple.com
3. Create a new app
4. Upload build using Transporter or EAS Submit
5. Fill in app information
6. Submit for review

## EAS Submit (Automated Submission)

```bash
# Submit to Google Play
eas submit --platform android

# Submit to App Store
eas submit --platform ios
```

## Notes

- First build may take longer (15-20 minutes)
- Subsequent builds are faster (5-10 minutes)
- You can build for both platforms simultaneously
- Builds are cached for 30 days on EAS servers
- Free tier: 30 builds per month

## Support

For issues or questions:
- Expo Documentation: https://docs.expo.dev/build/introduction/
- EAS Build Docs: https://docs.expo.dev/build/setup/
- Expo Forums: https://forums.expo.dev/
