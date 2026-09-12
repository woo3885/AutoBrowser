import { useEffect, useRef, useState } from 'react';

import type { PublicOverlayTarget } from '../model/overlay-types';

const FRAME_PROTOCOL = 'ddd.browser-frame.v1';
const MAX_FRAME_BYTES = 5 * 1024 * 1024;

interface FrameMetadata {
  sessionId: string;
  sequence: number;
  width: number;
  height: number;
  mimeType: 'image/png';
  byteLength: number;
}

interface RemoteBrowserViewerProps {
  sessionId: string;
  target: PublicOverlayTarget | null;
  backendBaseUrl: string;
}

function frameUrl(baseUrl: string, sessionId: string): string {
  const url = new URL(`/ws/sessions/${encodeURIComponent(sessionId)}/frames`, baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function parseRemoteFrameMetadata(value: unknown, sessionId: string): FrameMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (item.type !== 'BROWSER_FRAME' || item.sessionId !== sessionId ||
      !Number.isSafeInteger(item.sequence) || Number(item.sequence) < 1 ||
      !Number.isFinite(item.width) || Number(item.width) <= 0 ||
      !Number.isFinite(item.height) || Number(item.height) <= 0 ||
      item.mimeType !== 'image/png' || !Number.isSafeInteger(item.byteLength) ||
      Number(item.byteLength) < 1 || Number(item.byteLength) > MAX_FRAME_BYTES) return null;
  return {
    sessionId,
    sequence: Number(item.sequence),
    width: Number(item.width),
    height: Number(item.height),
    mimeType: 'image/png',
    byteLength: Number(item.byteLength)
  };
}

export default function RemoteBrowserViewer({
  sessionId,
  target,
  backendBaseUrl
}: RemoteBrowserViewerProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FrameMetadata | null>(null);
  const [status, setStatus] = useState('원격 화면 연결 중');
  const currentUrl = useRef<string | null>(null);

  useEffect(() => {
    let pending: FrameMetadata | null = null;
    let latestSequence = 0;
    const socket = new WebSocket(frameUrl(backendBaseUrl, sessionId), FRAME_PROTOCOL);
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => setStatus('원격 화면 연결됨');
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try { pending = parseRemoteFrameMetadata(JSON.parse(event.data), sessionId); }
        catch { pending = null; }
        if (!pending) setStatus('원격 화면 정보를 확인할 수 없습니다.');
        return;
      }
      const frame = pending;
      pending = null;
      if (!frame || !(event.data instanceof ArrayBuffer) ||
          event.data.byteLength !== frame.byteLength || frame.sequence <= latestSequence) return;
      latestSequence = frame.sequence;
      const nextUrl = URL.createObjectURL(new Blob([event.data], { type: frame.mimeType }));
      const previousUrl = currentUrl.current;
      currentUrl.current = nextUrl;
      setMetadata(frame);
      setImageSrc(nextUrl);
      setStatus('AI가 조작하는 원격 화면');
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    };
    socket.onerror = () => setStatus('원격 화면 연결을 확인해 주세요.');
    socket.onclose = () => setStatus('원격 화면 연결이 종료되었습니다.');
    return () => {
      socket.close(1000, 'viewer closed');
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = null;
    };
  }, [backendBaseUrl, sessionId]);

  const visibleTarget = target && metadata &&
    target.viewport.width === metadata.width && target.viewport.height === metadata.height
    ? target : null;
  const highlightStyle = visibleTarget ? {
    left: `${visibleTarget.rectangle.x / visibleTarget.viewport.width * 100}%`,
    top: `${visibleTarget.rectangle.y / visibleTarget.viewport.height * 100}%`,
    width: `${visibleTarget.rectangle.width / visibleTarget.viewport.width * 100}%`,
    height: `${visibleTarget.rectangle.height / visibleTarget.viewport.height * 100}%`
  } : undefined;

  return (
    <section className="remote-browser-viewer" aria-label="AI 원격 브라우저 화면">
      <div className="remote-browser-heading">
        <strong>원격 브라우저</strong>
        <span role="status">{status}</span>
      </div>
      <div className="remote-browser-frame">
        {imageSrc ? <img src={imageSrc} alt="AI가 조작 중인 웹사이트 화면" /> : (
          <p>첫 화면을 기다리고 있습니다.</p>
        )}
        {visibleTarget && highlightStyle ? (
          <div className="remote-browser-highlight" style={highlightStyle} aria-label={visibleTarget.label}>
            <span>{visibleTarget.guide}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
