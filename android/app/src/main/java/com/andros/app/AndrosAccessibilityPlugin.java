package com.andros.app;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndrosAccessibility")
public final class AndrosAccessibilityPlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("enabled", isServiceEnabled());
        result.put("running", AndrosAccessibilityService.isRunning());
        result.put("currentPackage", AndrosAccessibilityService.getCurrentPackage());
        result.put("currentPackageProtected", AndrosAccessibilityService.isCurrentPackageProtected());
        result.put("canAutomate", false);
        result.put("canReadVisibleText", true);
        result.put("message", "Servizio opt-in: legge testo accessibile dalle app non protette per la traduzione; non esegue tocchi.");
        call.resolve(result);
    }

    @PluginMethod
    public void getLastVisibleText(PluginCall call) {
        JSObject result = new JSObject();
        boolean protectedApp = AndrosAccessibilityService.isCurrentPackageProtected();
        String text = protectedApp ? "" : AndrosAccessibilityService.getLastVisibleText();
        result.put("supported", true);
        result.put("text", text);
        result.put("sourcePackage", protectedApp ? "" : AndrosAccessibilityService.getLastVisiblePackage());
        result.put("capturedAt", protectedApp ? 0L : AndrosAccessibilityService.getLastVisibleCapturedAt());
        result.put("protected", protectedApp);
        result.put("message", protectedApp
            ? "Schermata di un’app protetta: acquisizione disabilitata."
            : (text.isEmpty()
                ? "Nessun testo accessibile disponibile. Alcune app disegnano il testo come immagine e richiedono OCR."
                : "Testo accessibile acquisito dalla schermata dell’app non protetta."));
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Impossibile aprire le impostazioni di Accessibilità Android.");
        }
    }

    private boolean isServiceEnabled() {
        String expected = new ComponentName(getContext(), AndrosAccessibilityService.class).flattenToString();
        String enabledServices = Settings.Secure.getString(
            getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (TextUtils.isEmpty(enabledServices)) return false;
        TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
        splitter.setString(enabledServices);
        while (splitter.hasNext()) {
            if (expected.equalsIgnoreCase(splitter.next())) return true;
        }
        return false;
    }
}
