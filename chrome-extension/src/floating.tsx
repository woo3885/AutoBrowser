/// <reference types="vite/client" />

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SparkIcon } from './icons';
import panelStyles from './styles.css?inline';

declare global {
  // Prevent duplicate mounts when the service worker checks/injects the panel repeatedly.
  var __AUTOBROWSER_FLOATING_PANEL__: boolean | undefined;
}

if (!globalThis.__AUTOBROWSER_FLOATING_PANEL__) {
  globalThis.__AUTOBROWSER_FLOATING_PANEL__ = true;

  const host = document.createElement('div');
  host.id = 'autobrowser-floating-host';
  host.dataset.autobrowserUi = 'true';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';

  const shadow = host.attachShadow({ mode: 'closed' });
  const styleSheet = new CSSStyleSheet();
  styleSheet.replaceSync(`${panelStyles}
    :host { all: initial; }
    #autobrowser-floating-root { position: fixed; inset: 0; pointer-events: none; }
    #autobrowser-floating-root > .app-shell {
      position: fixed; top: 12px; right: 12px; bottom: 12px;
      width: min(380px, calc(100vw - 24px)); height: auto;
      overflow: hidden; pointer-events: auto;
      border: 1px solid var(--line); border-radius: 18px;
      box-shadow: 0 20px 60px rgb(8 15 35 / 30%);
    }
    .floating-launcher {
      position: fixed; right: 18px; bottom: 18px;
      width: 52px; height: 52px; display: grid; place-items: center;
      padding: 0; border: 0; border-radius: 16px; pointer-events: auto;
      color: #fff; background: linear-gradient(145deg, #6875ff, #3948e7);
      box-shadow: 0 12px 30px rgb(57 72 231 / 35%); cursor: pointer;
    }
    .floating-launcher svg { width: 25px; height: 25px; }
    @media (max-width: 520px) {
      #autobrowser-floating-root > .app-shell { top: 8px; right: 8px; bottom: 8px; width: calc(100vw - 16px); }
    }
  `);
  shadow.adoptedStyleSheets = [styleSheet];
  const container = document.createElement('div');
  container.id = 'autobrowser-floating-root';
  shadow.append(container);
  document.documentElement.append(host);

  function FloatingPanel() {
    const [minimized, setMinimized] = useState(false);
    if (minimized) {
      return <button className="floating-launcher" onClick={() => setMinimized(false)}
        title="AutoBrowser 열기" aria-label="AutoBrowser 열기">
        <SparkIcon />
      </button>;
    }
    return <App onMinimize={() => setMinimized(true)} onClose={() => {
      host.style.display = 'none';
    }} />;
  }

  const root = ReactDOM.createRoot(container);
  root.render(<React.StrictMode><FloatingPanel /></React.StrictMode>);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'AUTOBROWSER_TOGGLE_PANEL') return false;
    host.style.display = host.style.display === 'none' ? 'block' : 'none';
    sendResponse({ ok: true, visible: host.style.display !== 'none' });
    return false;
  });
}
