@echo off
echo Adding environment variables to EAS...
echo.




echo.
echo [2/3] Adding EXPO_PUBLIC_SUPABASE_ANON_KEY...
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZGNzaGtxZ3pjdWJuaWlud29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0Mzg1NzcsImV4cCI6MjA2NjAxNDU3N30.Pu_uzP2h19NsJTR5q36EQ8hYTT7QzTvb2O0aa4gv7ao" --environment production --visibility plaintext --non-interactive

echo.
echo [3/3] Adding EXPO_PUBLIC_VIDEO_SERVER_URL...
eas env:create --name EXPO_PUBLIC_VIDEO_SERVER_URL --value "https://vikunja.stubud.xyz" --environment production --visibility plaintext --non-interactive

echo.
echo ✓ All environment variables added!
echo.
echo Next steps:
echo 1. Verify: eas env:list
echo 2. Rebuild: eas build --platform android --profile production
echo.
pause
