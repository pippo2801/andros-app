package com.andros.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;

import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(
    name = "AndrosVoice",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public final class AndrosVoicePlugin extends Plugin {
    private TextToSpeech textToSpeech;
    private volatile boolean ttsReady = false;

    @Override
    public void load() {
        textToSpeech = new TextToSpeech(getContext(), status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) {
                textToSpeech.setLanguage(Locale.ITALIAN);
            }
        });
    }

    @PluginMethod
    public void recognizeOnce(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        launchRecognizer(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Permesso microfono negato. Puoi abilitarlo dalle impostazioni Android.");
            return;
        }
        launchRecognizer(call);
    }

    private void launchRecognizer(PluginCall call) {
        try {
            String locale = call.getString("locale", "it-IT");
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale);
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Parla con Andros");
            startActivityForResult(call, intent, "speechRecognitionResult");
        } catch (Exception exception) {
            call.reject("Riconoscimento vocale non disponibile su questo dispositivo.");
        }
    }

    @ActivityCallback
    private void speechRecognitionResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            cancelled.put("text", "");
            call.resolve(cancelled);
            return;
        }

        ArrayList<String> matches = result.getData().getStringArrayListExtra(
            RecognizerIntent.EXTRA_RESULTS);
        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("text", matches != null && !matches.isEmpty() ? matches.get(0) : "");
        float[] scores = result.getData().getFloatArrayExtra(
            RecognizerIntent.EXTRA_CONFIDENCE_SCORES);
        if (scores != null && scores.length > 0) {
            response.put("confidence", scores[0]);
        }
        // Speech transcription is not speaker authentication. Never return an
        // "identity verified" field from this API.
        response.put("identityVerified", false);
        call.resolve(response);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("Il testo da leggere è vuoto.");
            return;
        }
        if (text.length() > 4000) {
            call.reject("Il testo supera il limite di 4000 caratteri.");
            return;
        }
        if (!ttsReady || textToSpeech == null) {
            call.reject("Sintesi vocale non ancora disponibile.");
            return;
        }

        String utteranceId = UUID.randomUUID().toString();
        int status = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), utteranceId);
        if (status == TextToSpeech.ERROR) {
            call.reject("La sintesi vocale non è riuscita ad avviare la lettura.");
            return;
        }
        JSObject response = new JSObject();
        response.put("accepted", true);
        call.resolve(response);
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        ttsReady = false;
    }
}
