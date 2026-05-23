const { withAppDelegate, withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
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

  // Step 2: Copy GoogleService-Info.plist from project root to ios/<AppName>/
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
        console.warn('[withFirebaseSwift] GoogleService-Info.plist not found at project root — skipping copy');
      }
      return config;
    },
  ]);

  // Step 3: Register GoogleService-Info.plist in Xcode project
  config = withXcodeProject(config, (config) => {
    const { projectRoot } = config.modRequest;
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
