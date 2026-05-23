const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // 1. Add static framework flag at the top
      if (!podfileContent.includes('$RNFirebaseAsStaticFramework')) {
        podfileContent = '$RNFirebaseAsStaticFramework = true\n\n' + podfileContent;
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

      // 3. Patch RNFB source files via pre_install to replace <Firebase/Firebase.h>
      // with <FirebaseCore/FirebaseCore.h>. This prevents RNFBApp (which has
      // CLANG_ENABLE_MODULES=NO) from pulling in FirebaseAuth-Swift.h via the
      // Firebase umbrella header, which cannot be resolved without Clang modules.
      // Using a Podfile pre_install hook avoids patch-package version fragility.
      if (!podfileContent.includes('pre_install do |installer|')) {
        podfileContent = podfileContent + `
pre_install do |installer|
  files_to_patch = [
    File.join(__dir__, '../node_modules/@react-native-firebase/app/ios/RNFBApp/RNFBAppModule.m'),
    File.join(__dir__, '../node_modules/@react-native-firebase/app-check/ios/RNFBAppCheck/RNFBAppCheckModule.m'),
  ]
  files_to_patch.each do |file_path|
    next unless File.exist?(file_path)
    content = File.read(file_path)
    patched = content.gsub('#import <Firebase/Firebase.h>', '#import <FirebaseCore/FirebaseCore.h>')
    if content != patched
      File.write(file_path, patched)
      puts "[withModularHeaders] Patched #{File.basename(file_path)}: replaced Firebase umbrella with FirebaseCore"
    end
  end
end
`;
      }

      // 4. Add post_install hook for build settings
      if (!podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        podfileContent = podfileContent.replace(
          'post_install do |installer|',
          `post_install do |installer|
    # RNFBAppCheck is intentionally excluded: it needs CLANG_ENABLE_MODULES=YES
    # to resolve FirebaseAuth-Swift.h via <Firebase/Firebase.h>
    rnfb_pods = ['RNFBApp', 'RNFBAuth', 'RNFBFirestore']

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.5'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        config.build_settings['CODE_SIGN_IDENTITY'] = ''
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'

        # Disable Clang modules for RNFB legacy ObjC bridge pods to allow React imports
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
