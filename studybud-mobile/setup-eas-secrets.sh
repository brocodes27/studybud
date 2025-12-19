# EAS Environment Variables Setup Script

# IMPORTANT: Replace the placeholder values below with your actual credentials from .env file

# Step 1: Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "REPLACE_WITH_YOUR_SUPABASE_URL"

# Step 2: Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY"

# Step 3: Set Video Server URL
eas secret:create --scope project --name EXPO_PUBLIC_VIDEO_SERVER_URL --value "REPLACE_WITH_YOUR_VIDEO_SERVER_URL"

# After running these commands, rebuild your app:
# eas build --platform android --profile preview

# To verify secrets were added:
# eas secret:list

# To update a secret:
# eas secret:delete --name EXPO_PUBLIC_SUPABASE_URL
# eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "new_value"
