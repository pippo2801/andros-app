package com.andros.app;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * User-enabled accessibility bridge. It caches only readable text from the
 * most recent non-protected external app, in memory only. No clicks, typing,
 * screenshots, network transmission, or disk persistence are performed here.
 */
public final class AndrosAccessibilityService extends AccessibilityService {
    private static volatile AndrosAccessibilityService instance;
    private static volatile String currentPackage = "";
    private static volatile boolean currentPackageProtected = false;
    private static volatile String lastVisibleText = "";
    private static volatile String lastVisiblePackage = "";
    private static volatile long lastVisibleCapturedAt = 0L;
    private static final int MAX_NODES = 300;
    private static final int MAX_CHARS = 10000;
    private static final String OWN_PACKAGE = "com.andros.app";

    private static final Set<String> PROTECTED_PACKAGES = Collections.unmodifiableSet(
        new HashSet<>(Arrays.asList(
            "it.bancoposta", "posteitaliane.posteitaliane", "it.posteitaliane.posteapp",
            "com.latuabancaperandroid", "it.unicredit.mbanking", "it.fineco.finecoapp",
            "com.revolut.revolut", "com.paypal.android.p2pmobile", "it.hype.app",
            "com.satispay", "it.gruppobper.bperbanca", "com.ingbank", "com.bbva.bbva"
        ))
    );

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString().toLowerCase(Locale.ROOT);
        boolean protectedApp = isProtectedPackage(packageName);
        currentPackage = packageName;
        currentPackageProtected = protectedApp;

        // Never inspect the window tree of a protected app or Andros itself.
        if (protectedApp) {
            clearSnapshot();
            return;
        }
        if (OWN_PACKAGE.equals(packageName)) return;

        AccessibilityNodeInfo root = null;
        try {
            root = getRootInActiveWindow();
            if (root == null) return;
            StringBuilder collected = new StringBuilder();
            int[] count = new int[] { 0 };
            collectText(root, collected, count);
            String text = collected.toString().trim();
            if (!text.isEmpty()) {
                lastVisibleText = text.length() > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;
                lastVisiblePackage = packageName;
                lastVisibleCapturedAt = System.currentTimeMillis();
            } else {
                lastVisibleText = "";
                lastVisiblePackage = packageName;
                lastVisibleCapturedAt = System.currentTimeMillis();
            }
        } catch (Exception ignored) {
            // Fail closed: leave no stale text if a snapshot cannot be read.
            clearSnapshot();
        } finally {
            if (root != null) root.recycle();
        }
    }

    private void collectText(AccessibilityNodeInfo node, StringBuilder out, int[] count) {
        if (node == null || count[0] >= MAX_NODES || out.length() >= MAX_CHARS) return;
        count[0]++;
        if (!node.isPassword()) {
            CharSequence text = node.getText();
            if (text == null || text.length() == 0) text = node.getContentDescription();
            if (text != null && text.length() > 0) {
                String value = text.toString().trim();
                if (!value.isEmpty() && !value.equals(out.toString())) {
                    if (out.length() > 0) out.append('\n');
                    out.append(value);
                }
            }
        }
        for (int i = 0; i < node.getChildCount() && count[0] < MAX_NODES && out.length() < MAX_CHARS; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectText(child, out, count);
                child.recycle();
            }
        }
    }

    private static void clearSnapshot() {
        lastVisibleText = "";
        lastVisiblePackage = "";
        lastVisibleCapturedAt = 0L;
    }

    @Override
    public void onInterrupt() {
        currentPackage = "";
        currentPackageProtected = false;
        clearSnapshot();
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        currentPackage = "";
        currentPackageProtected = false;
        clearSnapshot();
        super.onDestroy();
    }

    public static boolean isRunning() { return instance != null; }
    public static String getCurrentPackage() { return currentPackage; }
    public static boolean isCurrentPackageProtected() { return currentPackageProtected; }
    public static String getLastVisibleText() { return currentPackageProtected ? "" : lastVisibleText; }
    public static String getLastVisiblePackage() { return currentPackageProtected ? "" : lastVisiblePackage; }
    public static long getLastVisibleCapturedAt() { return currentPackageProtected ? 0L : lastVisibleCapturedAt; }

    public static boolean isProtectedPackage(String packageName) {
        if (packageName == null || packageName.trim().isEmpty()) return false;
        String normalized = packageName.toLowerCase(Locale.ROOT);
        if (PROTECTED_PACKAGES.contains(normalized)) return true;
        String[] protectedTerms = {
            "bancoposta", "postepay", "posteitaliane", "latuabancaperandroid", "banca", "banking", "bank",
            "unicredit", "intesa", "fineco", "revolut", "paypal", "satispay", "bper", "credem",
            "bancobpm", "bnl", "montepaschi", "mps", "hype", "ingbank", "bbva"
        };
        for (String term : protectedTerms) if (normalized.contains(term)) return true;
        return false;
    }
}
