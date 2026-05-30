# Android APK

The app is packaged with Capacitor and builds locally from this frontend project. No global npm packages are required.

## Build a debug APK

```bash
cd workout-tracker-frontend
npm run android:setup-sdk
npm run android:apk
```

The APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Install on a phone

Copy `app-debug.apk` to your Android phone and open it. Android may ask you to allow installing apps from that file source.

The APK uses local device storage by default, so workouts, schedule, completion state, progress, and timer history work without running the Spring Boot backend.

## Use the backend instead

Set this in `.env` before building:

```env
REACT_APP_STORAGE_MODE=api
REACT_APP_API_BASE_URL=http://YOUR_COMPUTER_IP:8080
```

Then rebuild with `npm run android:apk`. Do not use `localhost` for an APK unless the backend is running on the phone itself.
