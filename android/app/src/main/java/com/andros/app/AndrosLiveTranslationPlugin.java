package com.andros.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndrosLiveTranslation")
public final class AndrosLiveTranslationPlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("running", AndrosLiveTranslationService.isRunning());
        result.put("overlayPermission", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext()));
        result.put("message", AndrosLiveTranslationService.isRunning()
            ? "Traduzione live attiva. Usa Arresta per terminare la cattura."
            : "Traduzione live non attiva.");
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext())) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("granted", false);
            result.put("openedSettings", true);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Impossibile aprire l'impostazione per la sovrapposizione.");
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(getContext())) {
            call.reject("Prima consenti a Andros di mostrare la sovrapposizione sopra le altre app.");
            return;
        }
        String target = call.getString("targetLanguage", "it");
        MediaProjectionManager manager = (MediaProjectionManager)
            getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        try {
            Intent intent = manager.createScreenCaptureIntent();
            startActivityForResult(call, intent, "screenCaptureResult");
            call.setKeepAlive(true);
        } catch (Exception exception) {
            call.reject("Impossibile richiedere il consenso Android per acquisire lo schermo.");
        }
    }

    @ActivityCallback
    private void screenCaptureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Acquisizione annullata: non è stato concesso il permesso di catturare lo schermo.");
            return;
        }
        String target = call.getString("targetLanguage", "it");
        Intent service = new Intent(getContext(), AndrosLiveTranslationService.class);
        service.setAction(AndrosLiveTranslationService.ACTION_START);
        service.putExtra(AndrosLiveTranslationService.EXTRA_RESULT_CODE, result.getResultCode());
        service.putExtra(AndrosLiveTranslationService.EXTRA_RESULT_DATA, result.getData());
        service.putExtra(AndrosLiveTranslationService.EXTRA_TARGET_LANGUAGE, target == null ? "it" : target);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(service);
            } else {
                getContext().startService(service);
            }
            JSObject response = new JSObject();
            response.put("started", true);
            response.put("targetLanguage", target == null ? "it" : target);
            response.put("message", "Richiesta avviata. Android mostra una notifica mentre la traduzione live è attiva.");
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("Non è stato possibile avviare la traduzione live. Riapri Andros e riprova.");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent service = new Intent(getContext(), AndrosLiveTranslationService.class);
        service.setAction(AndrosLiveTranslationService.ACTION_STOP);
        try {
            getContext().startService(service);
        } catch (Exception ignored) {
            getContext().stopService(new Intent(getContext(), AndrosLiveTranslationService.class));
        }
        JSObject response = new JSObject();
        response.put("stopped", true);
        call.resolve(response);
    }
}
