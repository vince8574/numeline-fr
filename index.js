import 'react-native-gesture-handler';
// Register background TaskManager.defineTask side effects BEFORE React/expo-router
// boots, so the task definitions exist when Android launches the app headless
// for a background fetch — otherwise TaskService.executeTask throws NPE natively.
import './src/services/backgroundService';
import './src/services/backgroundRecallCheck';
import 'expo-router/entry';
