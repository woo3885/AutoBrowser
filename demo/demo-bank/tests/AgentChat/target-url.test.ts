import { describe, expect, it } from 'vitest';

import { normalizePublicHttpsUrl } from '../../src/features/AgentChat/model/target-url';
import { viewerCoordinates } from '../../src/features/AgentChat/ui/RemoteBrowserViewer';

describe('public browser target', () => {
  it('normalizes an HTTPS domain and removes fragments', () => {
    expect(normalizePublicHttpsUrl('example.com/path#section')).toBe('https://example.com/path');
  });

  it('blocks local, private and non-HTTPS destinations', () => {
    expect(normalizePublicHttpsUrl('http://example.com')).toBeNull();
    expect(normalizePublicHttpsUrl('https://localhost:8080')).toBeNull();
    expect(normalizePublicHttpsUrl('https://192.168.0.2')).toBeNull();
  });
});

describe('remote viewer coordinates', () => {
  it('maps a fitted frame back to the 1280x720 browser viewport', () => {
    expect(viewerCoordinates(330, 200, { left: 10, top: 20, width: 640, height: 360 }, 1280, 720))
      .toEqual({ x: 640, y: 360 });
  });

  it('ignores clicks in object-fit letterboxing', () => {
    expect(viewerCoordinates(10, 50, { left: 0, top: 0, width: 800, height: 800 }, 1280, 720))
      .toBeNull();
  });
});
