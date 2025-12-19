# EAS Environment Variables Setup Script (PowerShell)
# Run this in PowerShell after replacing the placeholder values

Write-Host "Setting up EAS environment secrets..." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Edit this file and replace REPLACE_WITH_YOUR_* values with actual credentials from your .env file" -ForegroundColor Yellow
Write-Host ""

# TODO: Replace these values with your actual credentials from .env file
$SUPABASE_URL = "REPLACE_WITH_YOUR_SUPABASE_URL"
$SUPABASE_ANON_KEY = "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY"
$VIDEO_SERVER_URL = "REPLACE_WITH_YOUR_VIDEO_SERVER_URL"

# Check if values were replaced
if ($SUPABASE_URL -like "*REPLACE_WITH*") {
    Write-Host "ERROR: Please edit this file and replace the placeholder values first!" -ForegroundColor Red
    Write-Host ""
    Write-Host "1. Open your .env file" -ForegroundColor Cyan
    Write-Host "2. Copy the values for:" -ForegroundColor Cyan
    Write-Host "   - EXPO_PUBLIC_SUPABASE_URL" -ForegroundColor Cyan
    Write-Host "   - EXPO_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Cyan
    Write-Host "   - EXPO_PUBLIC_VIDEO_SERVER_URL" -ForegroundColor Cyan
    Write-Host "3. Replace the REPLACE_WITH_YOUR_* values in this script" -ForegroundColor Cyan
    Write-Host "4. Run this script again" -ForegroundColor Cyan
    exit 1
}

Write-Host "Creating EAS secrets..." -ForegroundColor Green

# Create secrets
Write-Host "Setting EXPO_PUBLIC_SUPABASE_URL..." -ForegroundColor Cyan
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value $SUPABASE_URL

Write-Host "Setting EXPO_PUBLIC_SUPABASE_ANON_KEY..." -ForegroundColor Cyan
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value $SUPABASE_ANON_KEY

Write-Host "Setting EXPO_PUBLIC_VIDEO_SERVER_URL..." -ForegroundColor Cyan
eas secret:create --scope project --name EXPO_PUBLIC_VIDEO_SERVER_URL --value $VIDEO_SERVER_URL

Write-Host ""
Write-Host "✓ All secrets created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Verify secrets: eas secret:list" -ForegroundColor Cyan
Write-Host "2. Rebuild your app: eas build --platform android --profile preview" -ForegroundColor Cyan
Write-Host ""
