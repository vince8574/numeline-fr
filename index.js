import 'react-native-gesture-handler';
// Register background TaskManager.defineTask side effects BEFORE expo-router boots,
// so the task definitions exist in JS BEFORE the native TaskService can dispatch
// executeTask at foreground launch — otherwise NPE before any React mount.
import './src/services/backgroundService';
import './src/services/backgroundRecallCheck';
import 'expo-router/entry';
