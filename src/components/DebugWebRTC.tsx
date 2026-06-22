import { useEffect, useState } from "react";

export function DebugWebRTC() {
  const [info, setInfo] = useState<any>({});
  useEffect(() => {
    setInfo({
      secure: window.isSecureContext,
      mediaDevices: typeof navigator.mediaDevices,
      rtc: typeof window.RTCPeerConnection,
      protocol: window.location.protocol,
      href: window.location.href,
    });
  }, []);
  return <div className="fixed top-0 left-0 z-50 bg-red-500 text-white p-2 text-xs">
    <pre>{JSON.stringify(info, null, 2)}</pre>
  </div>;
}
