# Andros native bridge — device smoke test

Run these checks on the target Android phone after installing the debug APK.

## 1. Install and launch
- Download the `ANDROS-OS-debug-apk` artifact from the successful GitHub Actions run.
- Install the APK and launch Andros.
- Confirm that the existing chat and Ollama settings still open.

## 2. Speech transcription
- Tap the microphone button.
- On the first use, grant microphone permission only if you want to use voice input.
- Speak a short Italian sentence.
- Confirm the recognized text is placed in the input field and is **not sent automatically**.
- Cancel the system recognizer and verify that the app reports cancellation without crashing.
- Deny microphone permission and verify that Andros reports the limitation without crashing.

## 3. Text-to-speech
- Tap the speaker icon on an assistant response.
- Confirm the response is spoken using Android TTS.
- Verify that a long or empty text does not crash the app.

## 4. Accessibility status bridge
- Open Impostazioni in Andros.
- Confirm the bridge initially reports disabled.
- Tap the button to open Android Accessibility settings.
- Enable Andros manually only after reading the disclosure.
- Return to Andros and refresh the status.
- Confirm enabled/running status is reported accurately.

## 5. Protected-app guard
- Open an ordinary app and check that the service reports its package as not protected.
- Open an installed banking/payment app and confirm that the status reports it as protected where its package matches the denylist/heuristics.
- This version does not inspect screen contents or execute actions. The test must not involve credentials, OTPs, payments, or transactions.

## 6. Regression and recovery
- Force-close and reopen Andros; verify chat and settings still work.
- Disable the Accessibility service in Android settings and confirm the app reflects the changed state after refresh.
- If voice input fails, verify microphone permission and the availability of Android's speech-recognition service.
- Record Android version, device model, result, and any crash/logcat details.

## Acceptance boundary
Passing this checklist verifies only push-to-talk transcription, TTS, and the initial accessibility status bridge. It does not verify speaker identity, wake-word listening, autonomous app control, Termux execution, or exclusion of every possible banking app. Those require separate implementation and tests.
