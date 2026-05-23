const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // 1. Add static framework flag and Firebase SDK version override at the top
      if (!podfileContent.includes('$RNFirebaseAsStaticFramework')) {
        // Force Firebase iOS SDK 11.x to resolve nanopb conflict with GoogleMLKit 8.0.0
        // react-native-firebase v20 ships with 10.29.0 but 11.x uses the same
        // GoogleDataTransport 10.x + nanopb 3.x that MLKit requires
        podfileContent = '$RNFirebaseAsStaticFramework = true\n$FirebaseSDKVersion = \'11.0.0\'\n\n' + podfileContent;
      }

      // 2. Add modular headers for Firebase deps after use_expo_modules!
      if (!podfileContent.includes("pod 'FirebaseCore', :modular_headers => true")) {
        podfileContent = podfileContent.replace(
          'use_expo_modules!',
          `use_expo_modules!

  # Firebase pods with modular headers for Swift compatibility
  pod 'FirebaseCore', :modular_headers => true
  pod 'FirebaseCoreExtension', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true
  pod 'FirebaseAuth', :modular_headers => true
  pod 'FirebaseAuthInterop', :modular_headers => true
  pod 'FirebaseAppCheckInterop', :modular_headers => true
  pod 'FirebaseFirestore', :modular_headers => true
  pod 'FirebaseFirestoreInternal', :modular_headers => true
  pod 'FirebaseSharedSwift', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true`
        );
      }

      // 3. Add post_install hook for build settings
      if (!podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        podfileContent = podfileContent.replace(
          'post_install do |installer|',
          `post_install do |installer|
    # Pods that need special module handling
    rnfb_pods = ['RNFBApp', 'RNFBAuth', 'RNFBFirestore', 'RNFBAppCheck']

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.5'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        config.build_settings['CODE_SIGN_IDENTITY'] = ''
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'

        # Disable Clang modules for RNFB pods to allow React imports
        if rnfb_pods.include?(target.name)
          config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'
        end

        # Suppress nullability warnings (expo-file-system)
        if target.name == 'expo-file-system'
          config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
        end
      end
    end`
        );
      }

      fs.writeFileSync(podfilePath, podfileContent);

      return config;
    },
  ]);
};
