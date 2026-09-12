import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from '../../src/App';

describe('AutoBrowser demo entry', () => {
  it('renders the URL launcher without the legacy demo bank shell', () => {
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: '어떤 사이트를 열까요?' })).toBeTruthy();
    expect(container.querySelector('.auto-browser-workspace')).toBeTruthy();
    expect(container.querySelector('.site-shell')).toBeNull();
    expect(container.querySelector('.developer-nav')).toBeNull();
  });
});
