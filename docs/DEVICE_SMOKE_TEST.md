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

## 5. Multilingual and live screen translation
- Open the translator icon in the Andros header.
- Translate harmless sample phrases from at least two languages with Ollama reachable.
- Confirm copy and text-to-speech controls work.
- Enable the Accessibility service manually from Android settings.
- Grant “Display over other apps” only if you want a floating translation panel.
- Tap **Avvia traduzione live** and approve Android's screen-capture prompt.
- Open a harmless app with visible text. Confirm the translated overlay appears and updates when the text changes.
- Confirm the persistent notification contains an **Arresta** action and that stopping it removes the overlay.
- Test a short Latin-script phrase and, if available, a CJK/Devanagari phrase. First-use language-model downloads may require network access.
- Open a banking/payment app and confirm the live translation pauses if the package is detected as protected. Do not enter credentials, OTPs, payments or transactions.
- Cancel the screen-capture prompt and verify Andros reports cancellation without crashing.
- Verify that image-only text, small text and some protected app content may not be recognized; the feature is experimental.

## 6. Regression and recovery
- Force-close and reopen Andros; verify chat and settings still work.
- Disable the Accessibility service in Android settings and confirm the app reflects the changed state after refresh.
- If voice input fails, verify microphone permission and the availability of Android's speech-recognition service.
- Record Android version, device model, result, and any crash/logcat details.

## Acceptance boundary
Passing this checklist verifies only the functions actually tested on this device. It does not verify speaker identity, wake-word listening, autonomous app control, Termux execution, OCR accuracy for every script, or exclusion of every possible banking app. Those require separate implementation and tests.
