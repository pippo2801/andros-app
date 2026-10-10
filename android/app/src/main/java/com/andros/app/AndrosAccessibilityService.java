package com.andros.app;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Opt-in Android accessibility bridge foundation.
 *
 * This initial version records only the foreground package and whether it is
 * protected. It does not read view text, click controls, type text, or transmit
 * screen content. Android requires the user to enable this service manually.
 */
public final class AndrosAccessibilityService extends AccessibilityService {
    private static volatile AndrosAccessibilityService instance;
    private static volatile String currentPackage = "";
    private static volatile boolean currentPackageProtected = false;

    private static final Set<String> PROTECTED_PACKAGES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(
            "it.bancoposta",
            "posteitaliane.posteitaliane",
            "it.posteitaliane.posteapp",
            "com.latuabancaperandroid",
            "it.unicredit.mbanking",
            "it.fineco.finecoapp",
            "com.revolut.revolut",
            "com.paypal.android.p2pmobile",
            "it.hype.app",
            "com.satispay",
            "it.gruppobper.bperbanca",
            "com.ingbank",
            "com.bbva.bbva"
        ))
    );

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = event.getPackageName().toString().toLowerCase(Locale.ROOT);
        boolean protectedApp = isProtectedPackage(packageName);

        // Deliberately keep only package metadata. Do not inspect the source
        // node tree, event text, passwords, OTPs, or content of protected apps.
        currentPackage = packageName;
        currentPackageProtected = protectedApp;
    }

    @Override
    public void onInterrupt() {
        currentPackage = "";
        currentPackageProtected = false;
    }

    @Override
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        currentPackage = "";
        currentPackageProtected = false;
        super.onDestroy();
    }

    public static boolean isRunning() {
        return instance != null;
    }

    public static String getCurrentPackage() {
        return currentPackage;
    }

    public static boolean isCurrentPackageProtected() {
        return currentPackageProtected;
    }

    public static boolean isProtectedPackage(String packageName) {
        if (packageName == null || packageName.trim().isEmpty()) {
            return false;
        }
        String normalized = packageName.toLowerCase(Locale.ROOT);
        if (PROTECTED_PACKAGES.contains(normalized)) {
            return true;
        }

        String[] protectedTerms = {
            "bancoposta", "postepay", "posteitaliane", "latuabancaperandroid", "banca", "banking", "bank",
            "unicredit", "intesa", "fineco", "revolut", "paypal",
            "satispay", "bper", "credem", "bancobpm", "bnl",
            "montepaschi", "mps", "hype", "ingbank", "bbva"
        };
        for (String term : protectedTerms) {
            if (normalized.contains(term)) {
                return true;
            }
        }
        return false;
    }
}
