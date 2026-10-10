package com.andros.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndrosAccessibilityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
