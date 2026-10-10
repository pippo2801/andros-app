package com.andros.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndrosAccessibilityPlugin.class);
        registerPlugin(AndrosVoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
