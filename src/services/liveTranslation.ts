import { Capacitor, registerPlugin } from '@capacitor/core';

export interface LiveTranslationStatus {
  supported: boolean;
  running: boolean;
  overlayPermission: boolean;
  message: string;
}
export interface LiveTranslationStart {
  started: boolean;
  targetLanguage: string;
  message: string;
}
interface AndrosLiveTranslationNative {
  getStatus(): Promise<LiveTranslationStatus>;
  requestOverlayPermission(): Promise<{ granted: boolean; openedSettings?: boolean }>;
  start(options: { targetLanguage: string }): Promise<LiveTranslationStart>;
  stop(): Promise<{ stopped: boolean }>;
}
const NativeLiveTranslation = registerPlugin<AndrosLiveTranslationNative>('AndrosLiveTranslation');

export async function getLiveTranslationStatus(): Promise<LiveTranslationStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { supported: false, running: false, overlayPermission: false, message: 'Disponibile solo nell’app Android installata.' };
  }
  return NativeLiveTranslation.getStatus();
}
export async function requestLiveTranslationOverlayPermission() {
  if (!Capacitor.isNativePlatform()) throw new Error('Disponibile solo nell’app Android.');
  return NativeLiveTranslation.requestOverlayPermission();
}
export async function startLiveTranslation(targetLanguage: string) {
  if (!Capacitor.isNativePlatform()) throw new Error('La traduzione live richiede l’app Android installata.');
  return NativeLiveTranslation.start({ targetLanguage });
}
export async function stopLiveTranslation() {
  if (!Capacitor.isNativePlatform()) throw new Error('Disponibile solo nell’app Android.');
  return NativeLiveTranslation.stop();
}
