#!/bin/bash

# EAS Build hook - runs before npm install
# Copies brands.json to iOS Resources directory

echo "📦 EAS Pre-Install Hook: Preparing brand assets for iOS..."

# Check if we're building for iOS
if [ "$EAS_BUILD_PLATFORM" = "ios" ]; then
  echo "✓ iOS build detected"

  # Create iOS Resources directory if it doesn't exist
  mkdir -p ios/eatsok/Resources

  # Copy brands.json to iOS Resources
  if [ -f "android/app/src/main/assets/brands.json" ]; then
    cp android/app/src/main/assets/brands.json ios/eatsok/Resources/brands.json
    echo "✓ Copied brands.json to iOS Resources ($(du -h android/app/src/main/assets/brands.json | cut -f1))"
  else
    echo "⚠️  Warning: brands.json not found in android/app/src/main/assets/"
  fi
else
  echo "ℹ️  Skipping iOS assets (platform: $EAS_BUILD_PLATFORM)"
fi

echo "✓ EAS Pre-Install Hook completed"
