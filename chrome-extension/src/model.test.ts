import { describe, expect, it } from 'vitest';
import { activeProgressStep, nextTheme, normalizeBackendUrl } from './model';

describe('extension UI model', () => {
  it('normalizes a Railway domain without a scheme', () => {
    expect(normalizeBackendUrl('backend-production.up.railway.app/path'))
      .toBe('https://backend-production.up.railway.app');
  });

  it('maps progress phases and rotates theme preference', () => {
    expect(activeProgressStep('THINKING')).toBe(1);
    expect(activeProgressStep('COMPLETE')).toBe(4);
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});
