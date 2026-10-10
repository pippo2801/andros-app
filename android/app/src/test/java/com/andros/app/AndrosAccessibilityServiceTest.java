package com.andros.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AndrosAccessibilityServiceTest {
    @Test
    public void blocksKnownBankingAndPaymentPackageNames() {
        assertTrue(AndrosAccessibilityService.isProtectedPackage("it.bancoposta"));
        assertTrue(AndrosAccessibilityService.isProtectedPackage("com.example.banking.app"));
        assertTrue(AndrosAccessibilityService.isProtectedPackage("com.paypal.android.p2pmobile"));
    }

    @Test
    public void doesNotBlockOrdinaryNonFinancialPackages() {
        assertFalse(AndrosAccessibilityService.isProtectedPackage("com.example.calendar"));
        assertFalse(AndrosAccessibilityService.isProtectedPackage("com.example.musicplayer"));
    }
}
