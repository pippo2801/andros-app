import { Capacitor, registerPlugin } from '@capacitor/core';

export interface VoiceRecognitionResult {
  cancelled: boolean;
  text: string;
  confidence?: number;
  identityVerified: false;
}

interface AndrosVoicePlugin {
  recognizeOnce(options?: { locale?: string }): Promise<VoiceRecognitionResult>;
  speak(options: { text: string }): Promise<{ accepted: boolean }>;
  stopSpeaking(): Promise<void>;
}

const NativeVoice = registerPlugin<AndrosVoicePlugin>('AndrosVoice');

export function isVoiceBridgeAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function recognizeOnce(locale = 'it-IT'): Promise<VoiceRecognitionResult> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Il riconoscimento vocale nativo è disponibile nell’app Android.');
  }
  return NativeVoice.recognizeOnce({ locale });
}

export async function speakText(text: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return;
    }
    throw new Error('Sintesi vocale non disponibile in questo browser.');
  }
  await NativeVoice.speak({ text });
}

export async function stopSpeaking(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    return;
  }
  await NativeVoice.stopSpeaking();
}
