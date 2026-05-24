const { withAppDelegate, withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

module.exports = function withFirebaseSwift(config) {
  // Step 1: Inject FirebaseApp.configure() into Swift AppDelegate
  config = withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;

    if (appDelegate.language !== 'swift') return config;

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

  // Step 2: Copy GoogleService-Info.plist and register it in the Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const { projectRoot, platformProjectRoot, projectName } = config.modRequest;

    const srcPlist = path.join(projectRoot, 'GoogleService-Info.plist');
    const destDir = path.join(platformProjectRoot, projectName);
    const destPlist = path.join(destDir, 'GoogleService-Info.plist');

    if (!fs.existsSync(srcPlist)) {
      throw new Error(
        `[withFirebaseSwift] GoogleService-Info.plist not found at ${srcPlist}.\n` +
        `Set the EAS secret GOOGLE_SERVICE_INFO_PLIST_BASE64 or place the file at the project root before running prebuild.`
      );
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPlist, destPlist);
    console.log('[withFirebaseSwift] Copied GoogleService-Info.plist to', destPlist);

    // Path relative to .xcodeproj (ios/): projectName/GoogleService-Info.plist
    const plistXcodePath = path.join(projectName, 'GoogleService-Info.plist');
    if (!xcodeProject.hasFile(plistXcodePath)) {
      xcodeProject.addResourceFile(plistXcodePath, {
        target: xcodeProject.getFirstTarget().uuid,
        lastKnownFileType: 'text.plist.xml',
      });
      console.log('[withFirebaseSwift] Added GoogleService-Info.plist to Xcode bundle resources');
    } else {
      console.log('[withFirebaseSwift] GoogleService-Info.plist already in Xcode project');
    }

    return config;
  });

  return config;
};
