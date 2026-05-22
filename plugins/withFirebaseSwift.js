const { withAppDelegate, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Expo config plugin to:
 * 1. Inject FirebaseApp.configure() into the Swift AppDelegate
 * 2. Copy GoogleService-Info.plist from project root to ios/<AppName>/
 *    (Xcode project registration is handled in the CI workflow)
 */
module.exports = function withFirebaseSwift(config) {
  // Step 1: Inject FirebaseApp.configure() into Swift AppDelegate
  config = withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;

    if (appDelegate.language !== 'swift') {
      return config;
    }

    if (!appDelegate.contents.includes('import FirebaseCore')) {
      appDelegate.contents = appDelegate.contents.replace(
        'import ReactAppDependencyProvider',
        'import FirebaseCore\nimport ReactAppDependencyProvider'
      );
    }

    if (!appDelegate.contents.includes('FirebaseApp.configure()')) {
      appDelegate.contents = appDelegate.contents.replace(
        'let delegate = ReactNativeDelegate()',
        'FirebaseApp.configure()\n\n    let delegate = ReactNativeDelegate()'
      );
    }

    return config;
  });

  // Step 2: Copy GoogleService-Info.plist to ios/<AppName>/ if it exists at project root
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      const srcPlist = path.join(projectRoot, 'GoogleService-Info.plist');
      const destDir = path.join(platformProjectRoot, projectName);
      const destPlist = path.join(destDir, 'GoogleService-Info.plist');

      if (fs.existsSync(srcPlist)) {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(srcPlist, destPlist);
        console.log('[withFirebaseSwift] Copied GoogleService-Info.plist to', destPlist);
      } else {
        console.warn('[withFirebaseSwift] GoogleService-Info.plist not found — will be copied in CI workflow');
      }

      return config;
    },
  ]);

  return config;
};
