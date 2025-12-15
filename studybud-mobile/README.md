# ElevenFolks Mobile

A React Native mobile app for ElevenFolks learning platform, built with Expo and TypeScript.

## Features

- 🔐 **Authentication** - Secure login and signup with Supabase
- 📅 **Today's Schedule** - View and complete today's study tasks
- 📚 **Study Plans** - Browse all your study plans
- ✨ **Create Plans** - Generate AI-powered study plans
- 👤 **Profile** - Manage account settings

## Tech Stack

- **Expo** - React Native framework
- **Expo Router** - File-based navigation
- **Supabase** - Backend & authentication
- **TypeScript** - Type safety
- **AsyncStorage** - Local session storage

## Setup Instructions

### 1. Install Dependencies

```bash
cd studybud-mobile
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Copy these values from your Supabase project settings.

### 3. Run the App

```bash
# Start Expo dev server
npx expo start

# Scan QR code with Expo Go app (iOS/Android)
# Or press 'w' for web preview
```

## Project Structure

```
studybud-mobile/
├── app/                      # Expo Router screens
│   ├── index.tsx            # Auth redirect
│   ├── landing.tsx          # Landing page
│   ├── _layout.tsx          # Root layout
│   ├── auth/                # Auth screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── (tabs)/              # Tab navigation
│       ├── _layout.tsx      # Tab layout
│       ├── home.tsx         # Today's schedule
│       ├── plans.tsx        # Study plans list
│       ├── create.tsx       # Create new plan
│       └── profile.tsx      # User profile
├── lib/
│   └── supabase.ts          # Supabase client
├── constants/
│   └── theme.ts             # Design system
└── package.json
```

## Backend Integration

The app connects to the same Supabase backend as the web app:

- **Auth**: `@supabase/supabase-js`
- **API**: Supabase Edge Functions
  - `generate-study-plan` - Creates AI study plans
  - `openai-proxy` - AI features

## Design System

### Colors
- **Background**: `#0a0a0f` (Dark)
- **Primary**: `#00f3ff` (Neon Cyan)
- **Accent**: `#39ff14` (Neon Green)

### Navigation
Bottom tabs with 4 main screens:
1. Home - Today's study schedule
2. Plans - All study plans
3. Create - Generate new plan
4. Profile - User settings

## Development

### Run on iOS

```bash
npx expo start --ios
```

Requires Xcode and iOS Simulator.

### Run on Android

```bash
npx expo start --android
```

Requires Android Studio and emulator.

### Run on Web

```bash
npx expo start --web
```

## Building for Production

### iOS

```bash
eas build --platform ios
```

### Android

```bash
eas build --platform android
```

Requires [EAS CLI](https://docs.expo.dev/build/setup/) setup.

## Troubleshooting

### Common Issues

1. **"Supabase URL not set"**
   - Ensure `.env` file exists with `EXPO_PUBLIC_SUPABASE_URL`

2. **"Module not found"**
   - Run `npm install` again
   - Clear cache: `npx expo start --clear`

3. **Login fails**
   - Verify Supabase credentials
   - Check network connection

## License

MIT
