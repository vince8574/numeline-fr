# Firebase Storage Setup for Brands Database

## Option 1: Upload via Firebase Console (Simple - Recommended)

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: **eatsok** (or your project name)
3. Navigate to **Storage** in the left menu
4. Click **Upload file**
5. Upload `android/app/src/main/assets/brands.json`
6. After upload, click on the file and copy the **Download URL**
7. Update `src/services/brandMatcher.ts` line 186:
   ```typescript
   const BRANDS_URL = 'YOUR_DOWNLOAD_URL_HERE';
   ```

## Option 2: Upload via Script (Advanced)

### Prerequisites

1. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin --save-dev
   ```

2. Download Service Account Key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded JSON file as `firebase-admin-key.json` in project root
   - **IMPORTANT**: Add `firebase-admin-key.json` to `.gitignore` (already done)

### Upload

Run the upload script:
```bash
node scripts/uploadBrandsToFirebase.js
```

The script will output the public URL. Copy it and update `src/services/brandMatcher.ts`.

## Testing

After setting the URL, rebuild the app:

```bash
# Rebuild JavaScript bundle
npx expo export:embed --platform android --entry-file index.js --bundle-output android/app/build/generated/assets/react/release/index.android.bundle --assets-dest android/app/build/generated/res/react/release

# Build APK
cd android && ./gradlew assembleRelease

# Install
adb -s YOUR_DEVICE_ID install -r app/build/outputs/apk/release/app-release.apk
```

## How It Works

1. **First Launch**: App downloads brands.json (5.2 MB) from Firebase Storage
2. **Cache**: Brands are saved locally to `FileSystem.documentDirectory/brands.json`
3. **Subsequent Launches**: App loads from local cache instantly (no internet needed)
4. **Offline**: If download fails, app falls back to empty brand list

## File Size & Performance

- **brands.json**: 5.2 MB (286,044 brands)
- **Download time**: ~3-10 seconds on good connection
- **Cache time**: After first download, loads instantly (<1 second)

## Updating Brands

To update the brands database:

1. Regenerate brands.json:
   ```bash
   node scripts/generateAllBrands.js
   ```

2. Upload new file to Firebase Storage (replace existing)

3. Users will continue using cached version until you implement a version check or cache invalidation strategy

## Security

The brands.json file is publicly accessible (read-only). This is intentional as it contains no sensitive data, only brand names from Open Food Facts.
