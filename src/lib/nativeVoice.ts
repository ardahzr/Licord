import { invoke, isTauri } from "@tauri-apps/api/core";

export interface NativeVoiceParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  isScreenSharing: boolean;
  isCameraEnabled: boolean;
}

export interface NativeVoiceStatus {
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  participants: NativeVoiceParticipant[];
  screenSharing: boolean;
  cameraEnabled: boolean;
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

export function startNativeScreenShare(height: number, fps: number) {
  return invoke<NativeVoiceStatus>("native_voice_start_screen_share", { height, fps });
}

export function stopNativeScreenShare() {
  return invoke<NativeVoiceStatus>("native_voice_stop_screen_share");
}

export function startNativeCamera() {
  return invoke<NativeVoiceStatus>("native_voice_start_camera");
}

export function stopNativeCamera() {
  return invoke<NativeVoiceStatus>("native_voice_stop_camera");
}

export async function getNativeVideoFrame(
  identity: string,
  source: "screen" | "camera",
): Promise<ArrayBuffer> {
  const value = await invoke<ArrayBuffer | number[]>("native_voice_screen_frame", {
    identity,
    source,
  });
  return value instanceof ArrayBuffer ? value : Uint8Array.from(value).buffer;
}
