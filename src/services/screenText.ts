import { Capacitor, registerPlugin } from '@capacitor/core';

export interface ScreenTextSnapshot {
  supported: boolean;
  text: string;
  sourcePackage: string;
  capturedAt: number;
  protected: boolean;
  message: string;
}

interface AndrosScreenTextPlugin {
  getLastVisibleText(): Promise<ScreenTextSnapshot>;
}

const NativeScreenText = registerPlugin<AndrosScreenTextPlugin>('AndrosAccessibility');

export async function getLastVisibleScreenText(): Promise<ScreenTextSnapshot> {
  if (!Capacitor.isNativePlatform()) {
    return {
      supported: false,
      text: '',
      sourcePackage: '',
      capturedAt: 0,
      protected: false,
      message: 'L’acquisizione del testo dello schermo è disponibile solo nell’app Android.',
    };
  }
  return NativeScreenText.getLastVisibleText();
}
