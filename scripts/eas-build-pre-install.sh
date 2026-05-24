#!/bin/bash

set -euo pipefail

echo "[eas-build-pre-install] Start (platform: ${EAS_BUILD_PLATFORM:-unknown})"

prepare_android_google_services() {
  mkdir -p android/app

  if [ -n "${GOOGLE_SERVICES_JSON:-}" ] && [ -f "${GOOGLE_SERVICES_JSON}" ]; then
    cp "${GOOGLE_SERVICES_JSON}" android/app/google-services.json
    echo "[eas-build-pre-install] Using GOOGLE_SERVICES_JSON file secret"
    return
  fi

  if [ -n "${GOOGLE_SERVICES_JSON_BASE64:-}" ]; then
    printf '%s' "${GOOGLE_SERVICES_JSON_BASE64}" | base64 --decode > android/app/google-services.json
    echo "[eas-build-pre-install] Using GOOGLE_SERVICES_JSON_BASE64 env secret"
    return
  fi

  if [ -f "android/app/google-services.json" ]; then
    echo "[eas-build-pre-install] Using existing android/app/google-services.json"
    return
  fi

  echo "[eas-build-pre-install] ERROR: Missing google-services.json for Android build"
  echo "[eas-build-pre-install] Provide one of:"
  echo "  1) EAS file secret: GOOGLE_SERVICES_JSON"
  echo "  2) EAS env secret: GOOGLE_SERVICES_JSON_BASE64"
  exit 1
}

prepare_ios_google_services() {
  if [ -n "${GOOGLE_SERVICE_INFO_PLIST:-}" ] && [ -f "${GOOGLE_SERVICE_INFO_PLIST}" ]; then
    cp "${GOOGLE_SERVICE_INFO_PLIST}" GoogleService-Info.plist
    echo "[eas-build-pre-install] Using GOOGLE_SERVICE_INFO_PLIST file secret"
    return
  fi

  if [ -n "${GOOGLE_SERVICE_INFO_PLIST_BASE64:-}" ]; then
    printf '%s' "${GOOGLE_SERVICE_INFO_PLIST_BASE64}" | base64 --decode > GoogleService-Info.plist
    echo "[eas-build-pre-install] Using GOOGLE_SERVICE_INFO_PLIST_BASE64 env secret"
    if ! plutil -lint GoogleService-Info.plist > /dev/null 2>&1; then
      echo "[eas-build-pre-install] ERROR: GoogleService-Info.plist is not a valid property list"
      exit 1
    fi
    return
  fi

  if [ -f "GoogleService-Info.plist" ]; then
    echo "[eas-build-pre-install] Using existing GoogleService-Info.plist"
    return
  fi

  echo "[eas-build-pre-install] ERROR: Missing GoogleService-Info.plist for iOS build"
  echo "[eas-build-pre-install] Provide one of:"
  echo "  1) EAS file secret: GOOGLE_SERVICE_INFO_PLIST"
  echo "  2) EAS env secret: GOOGLE_SERVICE_INFO_PLIST_BASE64"
  exit 1
}

if [ "${EAS_BUILD_PLATFORM:-}" = "android" ]; then
  prepare_android_google_services
elif [ "${EAS_BUILD_PLATFORM:-}" = "ios" ]; then
  prepare_ios_google_services
else
  echo "[eas-build-pre-install] Skipping platform setup (platform: ${EAS_BUILD_PLATFORM:-unknown})"
fi

echo "[eas-build-pre-install] Completed"
