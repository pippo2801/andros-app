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
        result.put("currentPackageProtected",
            AndrosAccessibilityService.isCurrentPackageProtected());
        result.put("canAutomate", false);
        result.put("message",
            "Bridge iniziale: rileva solo lo stato e il package in primo piano; non esegue tocchi.");
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
        String expected = new ComponentName(getContext(),
            AndrosAccessibilityService.class).flattenToString();
        String enabledServices = Settings.Secure.getString(
            getContext().getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        if (TextUtils.isEmpty(enabledServices)) {
            return false;
        }
        TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
        splitter.setString(enabledServices);
        while (splitter.hasNext()) {
            if (expected.equalsIgnoreCase(splitter.next())) {
                return true;
            }
        }
        return false;
    }
}
