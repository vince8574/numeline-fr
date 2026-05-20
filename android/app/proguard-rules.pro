# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# expo-sharing / expo-modules-core: FilePermissionService referenced at runtime
-keep class expo.modules.kotlin.services.** { *; }
-dontwarn expo.modules.kotlin.services.**

# Nitro modules — keep JNI bridge classes
-keep class com.margelo.nitro.** { *; }
-dontwarn com.margelo.nitro.**

# react-native-iap
-keep class com.dooboolab.** { *; }
-dontwarn com.dooboolab.**
