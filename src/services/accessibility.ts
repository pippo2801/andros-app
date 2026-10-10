import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AndrosAccessibilityStatus {
  supported: boolean;
  enabled: boolean;
  running: boolean;
  currentPackage: string;
  currentPackageProtected: boolean;
  canAutomate: boolean;
  message: string;
}

interface AndrosAccessibilityPlugin {
  getStatus(): Promise<AndrosAccessibilityStatus>;
  openAccessibilitySettings(): Promise<void>;
}

const NativeAccessibility = registerPlugin<AndrosAccessibilityPlugin>('AndrosAccessibility');

export function isAccessibilityBridgeAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function getAccessibilityStatus(): Promise<AndrosAccessibilityStatus> {
  if (!Capacitor.isNativePlatform()) {
    return {
      supported: false,
      enabled: false,
      running: false,
      currentPackage: '',
      currentPackageProtected: false,
      canAutomate: false,
      message: 'Il controllo Accessibilità è disponibile solo nell’app Android nativa.',
    };
  }
  return NativeAccessibility.getStatus();
}

export async function openAccessibilitySettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Apri Andros su Android per configurare l’Accessibilità.');
  }
  await NativeAccessibility.openAccessibilitySettings();
}
