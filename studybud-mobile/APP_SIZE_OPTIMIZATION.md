# App Size Optimization Guide

Your app is currently **357 MB**, which is quite large. Here's how to reduce it significantly:

## 🎯 Target Size: 20-50 MB

## Why Is It So Large?

1. **Development Dependencies** - Included in build
2. **Source Maps** - Debug files
3. **Unoptimized Assets** - Large images/videos
4. **Unminified Code** - Not compressed
5. **Unused Dependencies** - Extra packages

## ✅ Optimizations Applied

### 1. **Metro Bundler Optimization** (metro.config.js)
- ✅ Removes console.log statements
- ✅ Minifies and mangles code
- ✅ Excludes test files
- **Expected Reduction**: 30-40%

### 2. **Asset Bundle Optimization** (app.json)
- ✅ Only includes necessary assets
- ✅ Excludes documentation and test files
- **Expected Reduction**: 20-30%

### 3. **Hermes Engine** (eas.json)
- ✅ Faster startup time
- ✅ Smaller bundle size
- ✅ Better performance
- **Expected Reduction**: 15-25%

### 4. **ProGuard Minification** (Android)
- ✅ Removes unused code
- ✅ Obfuscates code
- ✅ Shrinks resources
- **Expected Reduction**: 20-30%

### 5. **EAS Ignore** (.easignore)
- ✅ Excludes dev files from build
- ✅ Removes documentation
- ✅ Skips test files
- **Expected Reduction**: 10-15%

## 📦 Additional Optimizations

### Check Your Dependencies

Run this to see large packages:
```bash
npx npkill
```

Or analyze bundle size:
```bash
npx react-native-bundle-visualizer
```

### Remove Unused Dependencies

Check your package.json and remove packages you're not using:
```bash
npm uninstall <package-name>
```

### Optimize Images

1. **Compress images** before adding to assets:
   - Use https://tinypng.com/
   - Or use ImageOptim (Mac) / FileOptimizer (Windows)

2. **Use WebP format** instead of PNG/JPG:
   ```bash
   # Convert images to WebP
   cwebp input.png -o output.webp
   ```

3. **Remove unused images** from assets folder

### Check Asset Folder

```bash
# See what's taking up space
du -sh assets/*
```

Common culprits:
- Large splash screens
- Uncompressed icons
- Video files
- Font files

### Enable App Bundle (AAB) for Android

Instead of APK, use AAB for Google Play:
```json
// In eas.json
"production": {
  "android": {
    "buildType": "app-bundle"  // Changed from "apk"
  }
}
```

AAB is typically 30-50% smaller than APK!

## 🔍 Debugging Large Size

### 1. Check What's in Your Build

After building, download and extract the APK:
```bash
# Extract APK
unzip app-release.apk -d extracted/

# Check sizes
du -sh extracted/*
```

### 2. Common Large Files

- `lib/` - Native libraries (can't reduce much)
- `assets/` - Your images/fonts (optimize these!)
- `classes.dex` - Your code (Hermes/ProGuard helps)
- `resources.arsc` - Android resources

### 3. Analyze JavaScript Bundle

```bash
# In your project
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output bundle.js \
  --sourcemap-output bundle.map

# Then analyze
npx source-map-explorer bundle.js bundle.map
```

## 📊 Expected Results

With all optimizations:

| Before | After | Reduction |
|--------|-------|-----------|
| 357 MB | 30-60 MB | 80-85% |

### Breakdown:
- **Preview Build**: 40-60 MB (includes dev tools)
- **Production Build**: 25-40 MB (fully optimized)
- **AAB (Google Play)**: 20-30 MB (best compression)

## 🚀 Next Steps

1. **Rebuild with optimizations**:
   ```bash
   eas build --platform android --profile production
   ```

2. **Check the new size** when build completes

3. **If still large**, run bundle analyzer to find culprits

4. **Consider splitting** large features into separate bundles

## 💡 Pro Tips

### 1. Use Dynamic Imports
```typescript
// Instead of
import HeavyComponent from './HeavyComponent';

// Use
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

### 2. Remove Unused Expo Modules
Check `app.json` plugins - only include what you need.

### 3. Use CDN for Large Assets
Instead of bundling videos/large images, load them from a CDN.

### 4. Enable Code Splitting
For web builds, enable code splitting in metro config.

## 📱 Platform-Specific Tips

### Android
- Use AAB instead of APK
- Enable ProGuard
- Use Android App Bundle splits
- Remove unused ABIs (arm64-v8a is enough for most)

### iOS
- Enable bitcode
- Use asset catalogs
- Remove unused architectures
- Enable app thinning

## 🔧 Troubleshooting

### Build Still Large?

1. Check if you have large files in assets:
   ```bash
   find assets -type f -size +1M
   ```

2. Look for duplicate dependencies:
   ```bash
   npm ls
   ```

3. Check for dev dependencies in production:
   ```bash
   npm prune --production
   ```

### Build Fails After Optimization?

1. Remove metro.config.js temporarily
2. Build without ProGuard first
3. Add optimizations one by one

## 📈 Monitoring

Track your app size over time:
- EAS Dashboard shows build sizes
- Set up alerts for size increases
- Review before each release

---

**Target**: Get your app under 50 MB for a great user experience!
