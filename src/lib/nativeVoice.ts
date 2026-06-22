import { invoke, isTauri } from "@tauri-apps/api/core";

export interface NativeVoiceParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
}

export interface NativeVoiceStatus {
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  participants: NativeVoiceParticipant[];
}

export function canUseNativeVoice(): boolean {
  return isTauri();
}

export function connectNativeVoice(url: string, token: string) {
  return invoke<NativeVoiceStatus>("native_voice_connect", { url, token });
}

export function getNativeVoiceStatus() {
  return invoke<NativeVoiceStatus>("native_voice_status");
}

export function setNativeVoiceMuted(muted: boolean) {
  return invoke<NativeVoiceStatus>("native_voice_set_muted", { muted });
}

export function setNativeVoiceDeafened(deafened: boolean) {
  return invoke<NativeVoiceStatus>("native_voice_set_deafened", { deafened });
}

export function disconnectNativeVoice() {
  return invoke<void>("native_voice_disconnect");
}
