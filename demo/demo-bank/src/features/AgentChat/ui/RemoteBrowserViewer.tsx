import { useEffect, useRef, useState } from 'react';

import type { PublicOverlayTarget } from '../model/overlay-types';

const LIVE_PROTOCOL = 'ddd.browser-live.v2';
const MAX_FRAME_BYTES = 2 * 1024 * 1024;

interface FrameMetadata {
  sessionId: string;
  sequence: number;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
  byteLength: number;
}

interface RemoteBrowserViewerProps {
  sessionId: string;
  target: PublicOverlayTarget | null;
  backendBaseUrl: string;
}

interface PendingWheel {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
}

function liveUrl(baseUrl: string, sessionId: string): string {
  const url = new URL(`/ws/sessions/${encodeURIComponent(sessionId)}/live`, baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function parseRemoteFrameMetadata(value: unknown, sessionId: string): FrameMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (item.type !== 'LIVE_BROWSER_FRAME' || item.sessionId !== sessionId ||
      !Number.isSafeInteger(item.sequence) || Number(item.sequence) < 1 ||
      !Number.isFinite(item.width) || Number(item.width) <= 0 ||
      !Number.isFinite(item.height) || Number(item.height) <= 0 ||
      item.mimeType !== 'image/jpeg' || !Number.isSafeInteger(item.byteLength) ||
      Number(item.byteLength) < 1 || Number(item.byteLength) > MAX_FRAME_BYTES) return null;
  return {
    sessionId,
    sequence: Number(item.sequence),
    width: Number(item.width),
    height: Number(item.height),
    mimeType: 'image/jpeg',
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
  const [status, setStatus] = useState('실시간 브라우저 연결 중');
  const currentUrl = useRef<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const metadataRef = useRef<FrameMetadata | null>(null);
  const wheelRef = useRef<PendingWheel | null>(null);
  const wheelTimerRef = useRef<number | null>(null);
  const keyboardRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let pending: FrameMetadata | null = null;
    let latestSequence = 0;
    const socket = new WebSocket(liveUrl(backendBaseUrl, sessionId), LIVE_PROTOCOL);
    socketRef.current = socket;
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => setStatus('실시간 브라우저 연결됨');
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const value = JSON.parse(event.data) as Record<string, unknown>;
          if (value.type === 'INPUT_REJECTED') {
            setStatus(typeof value.detail === 'string' ? value.detail : '입력을 처리하지 못했습니다.');
            return;
          }
          if (value.type === 'INPUT_ACCEPTED') return;
          pending = parseRemoteFrameMetadata(value, sessionId);
        } catch { pending = null; }
        if (!pending) setStatus('실시간 화면 정보를 확인하지 못했습니다.');
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
      metadataRef.current = frame;
      setMetadata(frame);
      setImageSrc(nextUrl);
      setStatus('실시간 조작 가능 · 화면 클릭 후 키보드 입력');
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    };
    socket.onerror = () => setStatus('실시간 화면 연결을 확인해 주세요.');
    socket.onclose = () => setStatus('실시간 화면 연결이 종료되었습니다.');
    return () => {
      socketRef.current = null;
      socket.close(1000, 'viewer closed');
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = null;
      wheelRef.current = null;
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = null;
      metadataRef.current = null;
    };
  }, [backendBaseUrl, sessionId]);

  const sendInput = (input: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(input));
  };

  const pointFromEvent = (clientX: number, clientY: number, element: HTMLElement) => {
    const frame = metadataRef.current;
    return frame ? viewerCoordinates(
      clientX, clientY, element.getBoundingClientRect(), frame.width, frame.height) : null;
  };

  const queueWheel = (wheel: PendingWheel) => {
    const current = wheelRef.current;
    wheelRef.current = current ? {
      x: wheel.x,
      y: wheel.y,
      deltaX: Math.max(-3000, Math.min(3000, current.deltaX + wheel.deltaX)),
      deltaY: Math.max(-3000, Math.min(3000, current.deltaY + wheel.deltaY))
    } : wheel;
    if (wheelTimerRef.current !== null) return;
    wheelTimerRef.current = window.setTimeout(() => {
      wheelTimerRef.current = null;
      const pendingWheel = wheelRef.current;
      wheelRef.current = null;
      if (pendingWheel) sendInput({ type: 'WHEEL', ...pendingWheel });
    }, 40);
  };

  const visibleTarget = target && metadata &&
    target.viewport.width === metadata.width && target.viewport.height === metadata.height ? target : null;
  const highlightStyle = visibleTarget ? {
    left: `${visibleTarget.rectangle.x / visibleTarget.viewport.width * 100}%`,
    top: `${visibleTarget.rectangle.y / visibleTarget.viewport.height * 100}%`,
    width: `${visibleTarget.rectangle.width / visibleTarget.viewport.width * 100}%`,
    height: `${visibleTarget.rectangle.height / visibleTarget.viewport.height * 100}%`
  } : undefined;

  return (
    <section className="remote-browser-viewer" aria-label="실시간 원격 브라우저 화면">
      <div className="remote-browser-heading">
        <strong>실시간 브라우저</strong>
        <span role="status">{status}</span>
      </div>
      <div
        className="remote-browser-frame"
        role="application"
        tabIndex={0}
        aria-label="클릭, 스크롤 및 키보드로 조작하는 원격 브라우저"
        onClick={(event) => {
          keyboardRef.current?.focus({ preventScroll: true });
          const point = pointFromEvent(event.clientX, event.clientY, event.currentTarget);
          if (point) sendInput({ type: 'CLICK', ...point });
        }}
        onWheel={(event) => {
          const point = pointFromEvent(event.clientX, event.clientY, event.currentTarget);
          if (!point) return;
          event.preventDefault();
          queueWheel({
            ...point,
            deltaX: Math.max(-3000, Math.min(3000, Math.round(event.deltaX))),
            deltaY: Math.max(-3000, Math.min(3000, Math.round(event.deltaY)))
          });
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          if (event.key.length === 1) {
            event.preventDefault();
            sendInput({ type: 'TEXT', text: event.key });
            return;
          }
          if (['Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            sendInput({ type: 'KEY', key: event.key });
          }
        }}
        onCompositionEnd={(event) => {
          if (event.data) sendInput({ type: 'TEXT', text: event.data });
          if (keyboardRef.current) keyboardRef.current.value = '';
        }}
      >
        <textarea
          ref={keyboardRef}
          className="remote-browser-keyboard-capture"
          aria-label="원격 브라우저 키보드 입력"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {imageSrc ? <img src={imageSrc} draggable={false} alt="실시간 원격 브라우저 화면" /> : (
          <p>첫 실시간 화면을 기다리고 있습니다.</p>
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
