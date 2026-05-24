const { withAppDelegate, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
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
  // Uses the same approach as the official @react-native-firebase/app plugin:
  // addResourceFileToGroup with filepath = "<ProjectName>/GoogleService-Info.plist"
  config = withXcodeProject(config, (config) => {
    const { projectRoot } = config.modRequest;

    const srcPlist = path.join(projectRoot, 'GoogleService-Info.plist');
    if (!fs.existsSync(srcPlist)) {
      throw new Error(
        `[withFirebaseSwift] GoogleService-Info.plist not found at ${srcPlist}.\n` +
        `Set the EAS secret GOOGLE_SERVICE_INFO_PLIST_BASE64 or place the file at the project root.`
      );
    }

    // Copy to ios/<AppName>/ (same destination as official RNFB plugin)
    const destDir = IOSConfig.Paths.getSourceRoot(projectRoot);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPlist, path.join(destDir, 'GoogleService-Info.plist'));
    console.log('[withFirebaseSwift] Copied GoogleService-Info.plist to', destDir);

    // Register in Xcode project — identical to official @react-native-firebase/app plugin
    const project = config.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const plistFilePath = `${projectName}/GoogleService-Info.plist`;

    if (!project.hasFile(plistFilePath)) {
      config.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: plistFilePath,
        groupName: projectName,
        project,
        isBuildFile: true,
      });
      console.log('[withFirebaseSwift] Registered GoogleService-Info.plist in Xcode project');
    }

    return config;
  });

  return config;
};
