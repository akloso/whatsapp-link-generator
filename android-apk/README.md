# Splitzap Android APK test shell

This folder is intentionally isolated from the Splitzap web application. It builds an installable Android APK that opens the live Splitzap app at:

https://www.zapora.in/splitzap

## Why this approach

- No changes to the production Splitzap web source are required.
- Existing Supabase/account/shared-group logic remains on the live web app.
- Android-specific handling is added for UPI/custom app links and file/photo selection.
- The APK follows future live Splitzap web updates automatically.

## Build

The GitHub Action `Build Splitzap Android APK` creates a debug-signed APK that can be installed directly on an Android device for testing.

Artifact name: `splitzap-android-debug`

APK file: `Splitzap-Android-debug.apk`

## Important test note

Google can restrict OAuth sign-in inside embedded Android WebViews. Guest mode and email/password should be used as the first APK test paths. Google sign-in must be verified on a real device before we claim it is supported in this wrapper.

This is a test APK architecture, not the final Play Store signing/release setup.
