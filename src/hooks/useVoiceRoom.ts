import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  isBrowserSupported,
  type Participant,
} from "livekit-client";
import { fetchLiveKitToken, livekitUrl } from "@/lib/livekit";
import {
  canUseNativeVoice,
  connectNativeVoice,
  disconnectNativeVoice,
  getNativeVoiceStatus,
  setNativeVoiceDeafened,
  setNativeVoiceMuted,
  type NativeVoiceStatus,
} from "@/lib/nativeVoice";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";

// Voice is a call-level resource, not a page-level resource. Keep the browser
// room alive while React routes between chat, friends and the call screen.
let persistentRoom: Room | null = null;

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

// ── Public types ────────────────────────────────────────────────────
export interface VoiceParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isLocal: boolean;
  /** Attach to a <video> element for camera. */
  videoTrack: MediaStreamTrack | null;
  /** Attach to a <video> element for screen share. */
  screenTrack: MediaStreamTrack | null;
  /** Attach to an <audio> element. */
  audioTrack: MediaStreamTrack | null;
}

export interface UseVoiceRoom {
  /** Current connection state. */
  state: ConnectionState;
  /** All participants (local first, then remotes). */
  participants: VoiceParticipant[];
  /** The participant currently screen-sharing (if any). */
  screenSharer: VoiceParticipant | null;
  /** Connect to the voice room. */
  connect: () => Promise<void>;
  /** Disconnect from the voice room. */
  disconnect: () => void;
  /** Toggle local microphone. */
  toggleMic: () => Promise<void>;
  /** Toggle local camera. */
  toggleCamera: () => Promise<void>;
  /** Toggle screen share. */
  toggleScreenShare: () => Promise<void>;
  /** Local mic muted state. */
  isMicMuted: boolean;
  /** Local camera off state. */
  isCameraOff: boolean;
  /** Local screen sharing state. */
  isScreenSharing: boolean;
  /** Error message (cleared on successful connect). */
  error: string | null;
}

// ── Hook ────────────────────────────────────────────────────────────
export function useVoiceRoom(channelId: string, channelName: string): UseVoiceRoom {
  const { session, profile } = useAuth();
  const roomRef = useRef<Room | null>(persistentRoom);
  const nativeVoice = canUseNativeVoice() && !isBrowserSupported();

  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  
  const isMicMuted = useAppStore((state) => state.isMicMuted);
  const isCameraOff = useAppStore((state) => state.isCameraOff);
  const isScreenSharing = useAppStore((state) => state.isScreenSharing);
  const setMicMuted = useAppStore((state) => state.setMicMuted);
  const setDeafened = useAppStore((state) => state.setDeafened);
  const setCameraOff = useAppStore((state) => state.setCameraOff);
  const setScreenSharing = useAppStore((state) => state.setScreenSharing);
  const setActiveVoiceChannel = useAppStore((state) => state.setActiveVoiceChannel);
  const activeVoiceChannelId = useAppStore((state) => state.activeVoiceChannelId);

  const [error, setError] = useState<string | null>(null);

  const syncNativeStatus = useCallback(
    (status: NativeVoiceStatus) => {
      setState(
        status.connected ? ConnectionState.Connected : ConnectionState.Disconnected,
      );
      setMicMuted(status.muted);
      setDeafened(status.deafened);
      setParticipants(
        status.participants.map((participant) => ({
          identity: participant.identity,
          name: participant.name || participant.identity,
          isSpeaking: false,
          isMicMuted: participant.isLocal ? status.muted : false,
          isCameraOff: true,
          isScreenSharing: false,
          isLocal: participant.isLocal,
          videoTrack: null,
          screenTrack: null,
          audioTrack: null,
        })),
      );
    },
    [setDeafened, setMicMuted],
  );

  // ── Helpers ──
  const buildParticipant = useCallback(
    (p: Participant, isLocal: boolean): VoiceParticipant => {
      let videoTrack: MediaStreamTrack | null = null;
      let screenTrack: MediaStreamTrack | null = null;
      let audioTrack: MediaStreamTrack | null = null;
      let isSharingScreen = false;

      for (const pub of p.trackPublications.values()) {
        const track = pub.track;
        if (!track) continue;
        if (pub.source === Track.Source.Camera) {
          videoTrack = track.mediaStreamTrack;
        } else if (pub.source === Track.Source.Microphone) {
          audioTrack = track.mediaStreamTrack;
        } else if (pub.source === Track.Source.ScreenShare) {
          screenTrack = track.mediaStreamTrack;
          isSharingScreen = true;
        }
      }

      return {
        identity: p.identity,
        name: p.name ?? p.identity,
        isSpeaking: p.isSpeaking,
        isMicMuted: !p.isMicrophoneEnabled,
        isCameraOff: !p.isCameraEnabled,
        isScreenSharing: isSharingScreen,
        isLocal,
        videoTrack,
        screenTrack,
        audioTrack,
      };
    },
    [],
  );

  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const list: VoiceParticipant[] = [];
    list.push(buildParticipant(room.localParticipant, true));
    for (const rp of room.remoteParticipants.values()) {
      const deafened = useAppStore.getState().isDeafened;
      for (const publication of rp.trackPublications.values()) {
        if (publication.kind === Track.Kind.Audio) {
          publication.setEnabled(!deafened);
        }
      }
      list.push(buildParticipant(rp, false));
    }
    setParticipants(list);
  }, [buildParticipant]);

  // ── Connect ──
  const connect = useCallback(async () => {
    if (!session || !livekitUrl) {
      setError("LiveKit not configured or not authenticated");
      return;
    }

    try {
      setError(null);
      const displayName = profile?.username ?? session.user.id;
      const token = await withTimeout(
        fetchLiveKitToken(channelId, displayName),
        15_000,
        "LiveKit token request timed out. Please try again.",
      );

      if (nativeVoice) {
        setState(ConnectionState.Connecting);
        const status = await connectNativeVoice(livekitUrl, token);
        syncNativeStatus(status);
        setCameraOff(true);
        setScreenSharing(false);
        const directCall = channelId.startsWith("direct-");
        const path = directCall
          ? `/call/${channelId.slice("direct-".length)}?name=${encodeURIComponent(channelName.replace(/^Call with /, ""))}`
          : `/voice/${channelId}`;
        setActiveVoiceChannel(
          channelId,
          directCall ? channelName : `#${channelName}`,
          path,
        );
        return;
      }

      if (persistentRoom) {
        persistentRoom.disconnect(true);
        persistentRoom = null;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          // Chromium-based clients use this stronger filter when supported and
          // gracefully fall back to noiseSuppression on older WebViews.
          voiceIsolation: true,
        },
      });

      roomRef.current = room;
      persistentRoom = room;

      // Wire up events before connecting
      const resync = () => syncParticipants();

      room.on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
        setState(s);
        if (s === ConnectionState.Connected) resync();
      });
      room.on(RoomEvent.ParticipantConnected, resync);
      room.on(RoomEvent.ParticipantDisconnected, resync);
      room.on(RoomEvent.TrackSubscribed, resync);
      room.on(RoomEvent.TrackUnsubscribed, resync);
      room.on(RoomEvent.TrackMuted, resync);
      room.on(RoomEvent.TrackUnmuted, resync);
      room.on(RoomEvent.ActiveSpeakersChanged, resync);
      room.on(RoomEvent.LocalTrackPublished, resync);
      room.on(RoomEvent.LocalTrackUnpublished, resync);

      await room.connect(livekitUrl, token);

      // Publish mic by default (unmuted)
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicMuted(false);
      setCameraOff(true);
      setScreenSharing(false);
      const directCall = channelId.startsWith("direct-");
      const path = directCall
        ? `/call/${channelId.slice("direct-".length)}?name=${encodeURIComponent(channelName.replace(/^Call with /, ""))}`
        : `/voice/${channelId}`;
      setActiveVoiceChannel(
        channelId,
        directCall ? channelName : `#${channelName}`,
        path,
      );

      resync();
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      let msg = rawMessage;
      if (/failed to fetch|signal connection/i.test(rawMessage)) {
        msg = `LiveKit signaling server is unreachable (${livekitUrl}). Check your network connection or server status.`;
      } else if (rawMessage.includes("403")) {
        msg = "Erişim engellendi: Bu sesli odaya bağlanma yetkiniz yok (Yan hesapla farklı sunucudaysan eklenmemiş olabilirsin).";
      }
      console.error("Voice room connect error:", msg);
      roomRef.current?.disconnect(true);
      roomRef.current = null;
      persistentRoom = null;
      setState(ConnectionState.Disconnected);
      setActiveVoiceChannel(null);
      setError(msg);
    }
  }, [session, profile, channelId, channelName, nativeVoice, syncNativeStatus, syncParticipants, setMicMuted, setCameraOff, setScreenSharing, setActiveVoiceChannel]);

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    if (nativeVoice) {
      void disconnectNativeVoice().catch((err) => {
        console.error("Native voice disconnect error:", err);
      });
    }
    const room = roomRef.current;
    if (room) {
      room.disconnect(true);
      roomRef.current = null;
      persistentRoom = null;
    }
    setState(ConnectionState.Disconnected);
    setParticipants([]);
    setMicMuted(false);
    setDeafened(false);
    setCameraOff(true);
    setScreenSharing(false);
    setActiveVoiceChannel(null);
  }, [nativeVoice, setMicMuted, setDeafened, setCameraOff, setScreenSharing, setActiveVoiceChannel]);

  // ── Toggles ──
  const toggleMic = useCallback(async () => {
    if (nativeVoice) {
      try {
        const status = await setNativeVoiceMuted(!isMicMuted);
        syncNativeStatus(status);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicMuted(!next);
      setError(null);
      syncParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission failed");
    }
  }, [nativeVoice, isMicMuted, syncNativeStatus, syncParticipants, setMicMuted]);

  const toggleCamera = useCallback(async () => {
    if (nativeVoice) {
      setError("Camera is not available in the Linux desktop voice engine yet.");
      return;
    }
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setCameraOff(!next);
      setError(null);
      syncParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission failed");
    }
  }, [nativeVoice, syncParticipants, setCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (nativeVoice) {
      setError("Screen sharing is not available in the Linux desktop voice engine yet.");
      return;
    }
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !room.localParticipant.isScreenShareEnabled;
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenSharing(next);
      setError(null);
      syncParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screen sharing failed");
    }
  }, [nativeVoice, syncParticipants, setScreenSharing]);

  // The native SDK owns its event loop. Poll its small status object so React
  // reflects people joining/leaving and local mute changes.
  useEffect(() => {
    if (!nativeVoice || state !== ConnectionState.Connected) return;
    const timer = window.setInterval(() => {
      void getNativeVoiceStatus()
        .then(syncNativeStatus)
        .catch((err) => console.error("Native voice status error:", err));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [nativeVoice, state, syncNativeStatus]);

  // A new VoiceRoom screen may mount for an already-running browser call.
  // Subscribe that screen to the persistent room without owning its lifetime.
  useEffect(() => {
    if (nativeVoice || activeVoiceChannelId !== channelId || !persistentRoom) {
      return;
    }
    const room = persistentRoom;
    const resync = () => syncParticipants();
    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ] as const;
    for (const event of events) room.on(event, resync);
    return () => {
      for (const event of events) room.off(event, resync);
    };
  }, [activeVoiceChannelId, channelId, nativeVoice, syncParticipants]);

  // ── Restore a call when returning to its screen ──
  useEffect(() => {
    if (activeVoiceChannelId !== channelId) return;

    if (nativeVoice) {
      void getNativeVoiceStatus()
        .then((status) => {
          if (status.connected) syncNativeStatus(status);
        })
        .catch((err) => console.error("Native voice restore error:", err));
      return;
    }

    if (persistentRoom) {
      roomRef.current = persistentRoom;
      setState(persistentRoom.state);
      syncParticipants();
    }
  }, [activeVoiceChannelId, channelId, nativeVoice, syncNativeStatus, syncParticipants]);

  // ── Derived ──
  const screenSharer = participants.find((p) => p.isScreenSharing) ?? null;

  return {
    state,
    participants,
    screenSharer,
    connect,
    disconnect,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    error,
  };
}

/** Controls for the persistent Discord-like voice panel outside the call page. */
export async function setActiveVoiceMuted(muted: boolean): Promise<void> {
  if (canUseNativeVoice() && !isBrowserSupported()) {
    await setNativeVoiceMuted(muted);
  } else if (persistentRoom) {
    await persistentRoom.localParticipant.setMicrophoneEnabled(!muted);
  }
  useAppStore.getState().setMicMuted(muted);
}

export async function setActiveVoiceDeafened(deafened: boolean): Promise<void> {
  if (canUseNativeVoice() && !isBrowserSupported()) {
    await setNativeVoiceDeafened(deafened);
  } else if (persistentRoom) {
    for (const participant of persistentRoom.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.kind === Track.Kind.Audio) {
          publication.setEnabled(!deafened);
        }
      }
    }
  }
  useAppStore.getState().setDeafened(deafened);
}

export async function disconnectActiveVoice(): Promise<void> {
  if (canUseNativeVoice() && !isBrowserSupported()) {
    await disconnectNativeVoice();
  }
  if (persistentRoom) {
    persistentRoom.disconnect(true);
    persistentRoom = null;
  }
  const store = useAppStore.getState();
  store.setActiveVoiceChannel(null);
  store.setMicMuted(false);
  store.setDeafened(false);
  store.setCameraOff(true);
  store.setScreenSharing(false);
}
