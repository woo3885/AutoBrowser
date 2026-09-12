import { useEffect, useRef, useState } from 'react';

import type { PublicOverlayTarget } from '../model/overlay-types';

const FRAME_PROTOCOL = 'ddd.browser-frame.v1';
const MAX_FRAME_BYTES = 5 * 1024 * 1024;

interface FrameMetadata {
  sessionId: string;
  frameId: string;
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
      typeof item.frameId !== 'string' || item.frameId.length < 1 || item.frameId.length > 100 ||
      !Number.isSafeInteger(item.sequence) || Number(item.sequence) < 1 ||
      !Number.isFinite(item.width) || Number(item.width) <= 0 ||
      !Number.isFinite(item.height) || Number(item.height) <= 0 ||
      item.mimeType !== 'image/png' || !Number.isSafeInteger(item.byteLength) ||
      Number(item.byteLength) < 1 || Number(item.byteLength) > MAX_FRAME_BYTES) return null;
  return {
    sessionId,
    frameId: item.frameId,
    sequence: Number(item.sequence),
    width: Number(item.width),
    height: Number(item.height),
    mimeType: 'image/png',
    byteLength: Number(item.byteLength)
  };
}

export function viewerCoordinates(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number } | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const scale = Math.min(bounds.width / frameWidth, bounds.height / frameHeight);
  const renderedWidth = frameWidth * scale;
  const renderedHeight = frameHeight * scale;
  const offsetX = bounds.left + (bounds.width - renderedWidth) / 2;
  const offsetY = bounds.top + (bounds.height - renderedHeight) / 2;
  const x = (clientX - offsetX) / scale;
  const y = (clientY - offsetY) / scale;
  if (x < 0 || y < 0 || x >= frameWidth || y >= frameHeight) return null;
  return { x: Math.floor(x), y: Math.floor(y) };
}

export default function RemoteBrowserViewer({ sessionId, target, backendBaseUrl }: RemoteBrowserViewerProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FrameMetadata | null>(null);
  const [status, setStatus] = useState('원격 화면 연결 중');
  const currentUrl = useRef<string | null>(null);
  const actionPending = useRef(false);

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
        if (!pending) setStatus('원격 화면 정보를 확인하지 못했습니다.');
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
      setStatus('클릭하거나 스크롤하여 직접 조작할 수 있습니다.');
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

  const executeAction = async (body: Record<string, unknown>) => {
    if (!metadata || actionPending.current) return;
    actionPending.current = true;
    try {
      const response = await fetch(
        new URL(`/api/v1/sessions/${encodeURIComponent(sessionId)}/actions`, backendBaseUrl),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            requestId: `viewer-${crypto.randomUUID()}`,
            source: 'USER_VIEWER',
            elementId: null,
            expectedFrameId: metadata.frameId,
            expectedSequence: metadata.sequence,
            ...body
          })
        }
      );
      if (!response.ok) throw new Error('ACTION_FAILED');
      setStatus('조작을 반영하고 있습니다.');
    } catch {
      setStatus('조작하지 못했습니다. 최신 화면에서 다시 시도해 주세요.');
    } finally {
      actionPending.current = false;
    }
  };

  const pointFromEvent = (clientX: number, clientY: number, element: HTMLElement) =>
    metadata ? viewerCoordinates(clientX, clientY, element.getBoundingClientRect(), metadata.width, metadata.height) : null;

  const visibleTarget = target && metadata &&
    target.viewport.width === metadata.width && target.viewport.height === metadata.height ? target : null;
  const highlightStyle = visibleTarget ? {
    left: `${visibleTarget.rectangle.x / visibleTarget.viewport.width * 100}%`,
    top: `${visibleTarget.rectangle.y / visibleTarget.viewport.height * 100}%`,
    width: `${visibleTarget.rectangle.width / visibleTarget.viewport.width * 100}%`,
    height: `${visibleTarget.rectangle.height / visibleTarget.viewport.height * 100}%`
  } : undefined;

  return (
    <section className="remote-browser-viewer" aria-label="원격 브라우저 화면">
      <div className="remote-browser-heading">
        <strong>원격 브라우저</strong>
        <span role="status">{status}</span>
      </div>
      <div
        className="remote-browser-frame"
        onClick={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY, event.currentTarget);
          if (point) void executeAction({ actionType: 'CLICK', ...point, deltaX: null, deltaY: null });
        }}
        onWheel={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY, event.currentTarget);
          if (!point) return;
          event.preventDefault();
          const deltaX = Math.max(-3000, Math.min(3000, Math.round(event.deltaX)));
          const deltaY = Math.max(-3000, Math.min(3000, Math.round(event.deltaY)));
          if (deltaX || deltaY) void executeAction({ actionType: 'SCROLL', ...point, deltaX, deltaY });
        }}
      >
        {imageSrc ? <img src={imageSrc} draggable={false} alt="원격 브라우저에 열린 사이트 화면" /> : (
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
