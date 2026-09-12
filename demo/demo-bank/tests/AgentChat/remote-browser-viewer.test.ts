import { describe, expect, it } from 'vitest';

import { parseRemoteFrameMetadata } from '../../src/features/AgentChat/ui/RemoteBrowserViewer';

describe('remote browser viewer frame contract', () => {
  it('현재 conversation session의 PNG frame metadata만 허용한다', () => {
    const metadata = {
      type: 'BROWSER_FRAME', sessionId: 'session-1', frameId: 'frame-1',
      sequence: 1, timestamp: Date.now(), width: 1280, height: 720,
      mimeType: 'image/png', byteLength: 1024
    };
    expect(parseRemoteFrameMetadata(metadata, 'session-1')).toMatchObject({
      sessionId: 'session-1', sequence: 1, width: 1280, height: 720
    });
    expect(parseRemoteFrameMetadata(metadata, 'session-2')).toBeNull();
    expect(parseRemoteFrameMetadata({ ...metadata, byteLength: 0 }, 'session-1')).toBeNull();
  });
});
