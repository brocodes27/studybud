# App Crash Fix Guide

## Problem: App closes immediately on startup

This is a common issue with React Native/Expo apps. Here are the solutions:

## ✅ Quick Fixes Applied

1. **Disabled Hermes Engine** - Can cause compatibility issues
2. **Disabled ProGuard** - Can break code obfuscation
3. **Simplified Metro Config** - Removed aggressive minification

## 🔍 Common Causes & Solutions

### 1. Missing Environment Variables

**Problem**: App can't connect to Supabase because `.env` variables aren't included in the build.

**Solution**: Add environment variables to EAS build:

```bash
# Set environment secrets
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your_supabase_url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_anon_key"
eas secret:create --scope project --name EXPO_PUBLIC_VIDEO_SERVER_URL --value "your_server_url"
```

Or update `eas.json`:
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your_url_here",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your_key_here",
        "EXPO_PUBLIC_VIDEO_SERVER_URL": "your_server_here"
      }
    }
  }
}
```

### 2. Check Crash Logs

**On Android**:
```bash
# Connect device via USB
adb logcat | grep -i "crash\|error\|exception"
```

**Or use Android Studio**:
1. Open Android Studio
2. View → Tool Windows → Logcat
3. Install and open the app
4. Look for red error messages

### 3. Build in Development Mode First

Test with a development build to see detailed errors:

```bash
eas build --platform android --profile development
```

Then install and run - you'll see the actual error message.

### 4. Common Crash Causes

#### A. Supabase Connection Error
```typescript
// Add error handling in lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials!');
  // Don't crash, use fallback
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
```

#### B. Missing Permissions
Check `app.json` has all required permissions:
```json
{
  "android": {
    "permissions": [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE"
    ]
  }
}
```

#### C. Incompatible Dependencies
Some packages don't work in production builds. Check:
```bash
npm ls
```

Look for warnings about peer dependencies.

### 5. Test Locally First

Before building with EAS, test locally:

```bash
# Android
npx expo run:android --variant release

# This builds a release version locally
# You can see errors immediately
```

### 6. Enable Crash Reporting

Add Sentry for crash reporting:

```bash
npm install @sentry/react-native
```

```typescript
// In App.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'your-sentry-dsn',
  enableInExpoDevelopment: true,
});
```

## 🚀 Recommended Build Process

1. **Test locally first**:
   ```bash
   npx expo run:android --variant release
   ```

2. **If it works locally**, build with EAS:
   ```bash
   eas build --platform android --profile preview
   ```

3. **If it crashes**, check logs:
   ```bash
   adb logcat
   ```

4. **Fix the error** and rebuild

## 📱 Quick Debug Build

Build with development profile to see errors:

```bash
# This includes dev tools and shows errors
eas build --platform android --profile development
```

Install it and you'll see the actual error message on screen!

## 🔧 Emergency Fixes

### If app keeps crashing:

1. **Remove all optimizations**:
   - Delete `metro.config.js`
   - Simplify `eas.json` to bare minimum
   - Remove custom plugins from `app.json`

2. **Build minimal version**:
   ```bash
   eas build --platform android --profile preview
   ```

3. **Add features back one by one**

### Check for these specific issues:

```typescript
// 1. Async storage initialization
import AsyncStorage from '@react-native-async-storage/async-storage';

// Make sure it's initialized before use
AsyncStorage.getItem('test').catch(err => {
  console.error('AsyncStorage not ready:', err);
});

// 2. Supabase client
// Add try-catch around supabase calls
try {
  const { data } = await supabase.from('table').select();
} catch (error) {
  console.error('Supabase error:', error);
}

// 3. Navigation
// Ensure all routes are properly defined
```

## 📊 Debugging Checklist

- [ ] Environment variables are set
- [ ] All permissions are in app.json
- [ ] No missing dependencies
- [ ] Supabase credentials are valid
- [ ] Internet permission is granted
- [ ] No aggressive minification
- [ ] Tested locally first
- [ ] Checked crash logs

## 💡 Pro Tips

1. **Always test release builds locally first**
2. **Use development builds for debugging**
3. **Add error boundaries in your app**
4. **Log errors to a service (Sentry/Bugsnag)**
5. **Test on multiple devices**

## 🆘 Still Crashing?

Share the crash logs:
```bash
adb logcat > crash.log
```

Look for lines with:
- `FATAL EXCEPTION`
- `AndroidRuntime`
- `Process: com.elevenfolks.studybud`

The error will be right before the crash!

---

**Next Step**: Build a development version to see the actual error:
```bash
eas build --platform android --profile development
```
