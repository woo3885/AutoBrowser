import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LinkIcon, MicIcon, MonitorIcon, MoonIcon, SendIcon, SettingsIcon, SparkIcon, SunIcon
} from './icons';
import {
  PROGRESS_STEPS, activeProgressStep, nextTheme, normalizeBackendUrl,
  type AgentDecision, type ChatMessage, type PageSnapshot,
  type ProgressPhase, type ThemePreference
} from './model';

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8080';
const MAX_AUTOMATIC_ACTIONS = 8;

interface RuntimeResponse {
  error?: string;
  data?: unknown;
  tabId?: number;
  title?: string;
  url?: string;
  result?: { data?: unknown; error?: string };
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

async function runtime(message: unknown): Promise<RuntimeResponse> {
  const response = await chrome.runtime.sendMessage(message) as RuntimeResponse | undefined;
  if (!response || response.error) {
    throw new Error(response?.error || '확장 프로그램 연결에 실패했습니다.');
  }
  return response;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}

function ThemeGlyph({ theme }: { theme: ThemePreference }) {
  if (theme === 'light') return <SunIcon />;
  if (theme === 'dark') return <MoonIcon />;
  return <MonitorIcon />;
}

function ProgressRail({ phase }: { phase: ProgressPhase }) {
  const active = activeProgressStep(phase);
  return <section className="progress-card" aria-label="작업 진행 상태">
    <div className="progress-heading">
      <span>작업 진행</span>
      <span className={`phase-badge phase-${phase.toLowerCase()}`}>
        {phase === 'ERROR' ? '확인 필요' : phase === 'COMPLETE' ? '완료' : active < 0 ? '대기' : '진행 중'}
      </span>
    </div>
    <ol className="progress-rail">
      {PROGRESS_STEPS.map((step, index) => {
        const complete = active === PROGRESS_STEPS.length || (active >= 0 && index < active);
        const current = index === active;
        return <li key={step.label} className={complete ? 'complete' : current ? 'current' : ''}>
          <span className="step-dot">{complete ? '✓' : index + 1}</span>
          <span className="step-copy"><strong>{step.label}</strong><small>{step.caption}</small></span>
        </li>;
      })}
    </ol>
  </section>;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome', role: 'ai',
    text: '안녕하세요. 현재 페이지에서 원하는 작업을 말씀해 주세요.'
  }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [siteConnected, setSiteConnected] = useState(false);
  const [pageTitle, setPageTitle] = useState('현재 탭 연결 대기');
  const [status, setStatus] = useState('현재 Chrome 탭에 연결하고 있습니다.');
  const [isError, setIsError] = useState(false);
  const [phase, setPhase] = useState<ProgressPhase>('IDLE');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const tabIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const automaticActionsRef = useRef(0);

  const effectiveTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const themeLabel = theme === 'system' ? '시스템' : theme === 'dark' ? '다크' : '라이트';

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateBusy = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
    if (!value) setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const showStatus = useCallback((text: string, error = false) => {
    setStatus(text);
    setIsError(error);
  }, []);

  const appendMessage = useCallback((role: ChatMessage['role'], text?: string | null) => {
    if (!text) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }, []);

  const pageIdentity = useCallback((snapshot: PageSnapshot) =>
    `${tabIdRef.current}:${snapshot.page.url}`.slice(0, 512), []);

  const connectCurrentSite = useCallback(async () => {
    const granted = await chrome.permissions.request({
      origins: ['https://*/*', 'http://*/*']
    });
    if (!granted) throw new Error('현재 웹사이트를 분석하려면 사이트 접근 권한이 필요합니다.');
    const tab = await runtime({ type: 'AUTOBROWSER_ACTIVE_TAB' });
    if (typeof tab.tabId !== 'number') throw new Error('현재 탭을 찾지 못했습니다.');
    tabIdRef.current = tab.tabId;
    setPageTitle(tab.title || tab.url || '현재 Chrome 탭');
    setSiteConnected(true);
    showStatus('현재 탭과 연결되었습니다.');
  }, [showStatus]);

  const currentSnapshot = useCallback(async (): Promise<PageSnapshot> => {
    setPhase('READING');
    let response: RuntimeResponse;
    try {
      response = await runtime({
        type: 'AUTOBROWSER_TAB_COMMAND',
        command: { type: 'AUTOBROWSER_SNAPSHOT' }
      });
    } catch (error) {
      setSiteConnected(false);
      throw error;
    }
    if (typeof response.tabId !== 'number') throw new Error('현재 탭을 확인하지 못했습니다.');
    tabIdRef.current = response.tabId;
    if (response.result?.error || !response.result?.data) {
      throw new Error(response.result?.error || '현재 페이지를 읽지 못했습니다.');
    }
    const snapshot = response.result.data as PageSnapshot;
    setPageTitle(snapshot.page.title);
    setSiteConnected(true);
    return snapshot;
  }, []);

  const backend = useCallback(async (path: string, body: unknown): Promise<AgentDecision> => {
    setPhase('THINKING');
    const response = await runtime({ type: 'AUTOBROWSER_BACKEND', path, body });
    if (!response.data) throw new Error('Backend 응답 데이터가 없습니다.');
    return response.data as AgentDecision;
  }, []);

  const sendTabCommand = useCallback(async (command: unknown) => {
    const response = await runtime({ type: 'AUTOBROWSER_TAB_COMMAND', command });
    if (response.tabId !== tabIdRef.current) throw new Error('활성 탭이 변경되었습니다. 다시 요청해 주세요.');
    if (response.result?.error) throw new Error(response.result.error);
    return response.result?.data;
  }, []);

  const handleDecision = useCallback(async function processDecision(decision: AgentDecision): Promise<void> {
    appendMessage('ai', decision.message);
    sessionIdRef.current = decision.sessionId;
    const tabId = tabIdRef.current;
    if (tabId !== null) await chrome.storage.session.set({ [`session:${tabId}`]: decision.sessionId });

    if (decision.mode === 'AUTO_EXECUTE' && decision.action) {
      if (automaticActionsRef.current >= MAX_AUTOMATIC_ACTIONS) {
        throw new Error('연속 자동 동작 한도에 도달했습니다.');
      }
      automaticActionsRef.current += 1;
      setPhase('EXECUTING');
      showStatus(`${decision.action.accessibleLabel || '페이지 요소'} 작업을 실행하고 있습니다.`);
      await sendTabCommand({
        type: 'AUTOBROWSER_EXECUTE',
        snapshotId: decision.sourceSnapshotId,
        action: decision.action
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      const snapshot = await currentSnapshot();
      const next = await backend(
        `/api/v1/extension/sessions/${encodeURIComponent(decision.sessionId)}/continue`,
        { pageIdentity: pageIdentity(snapshot), snapshot }
      );
      return processDecision(next);
    }

    if (decision.mode === 'GUIDE_USER' && decision.action) {
      await sendTabCommand({
        type: 'AUTOBROWSER_OVERLAY',
        snapshotId: decision.sourceSnapshotId,
        action: decision.action
      });
      setPhase('WAITING_USER');
      showStatus('페이지에 표시된 요소를 직접 조작해 주세요.');
      return;
    }

    if (['SECURE_INPUT_REQUIRED', 'RISK_WARNING', 'FINAL_CONFIRMATION_REQUIRED'].includes(decision.mode)) {
      setPhase('WAITING_USER');
      showStatus('보호된 단계입니다. 페이지에서 직접 확인하고 입력해 주세요.');
    } else if (decision.mode === 'ASK_USER') {
      setPhase('WAITING_USER');
      showStatus('AI의 질문에 답해 주세요.');
    } else if (['COMPLETE', 'STOP'].includes(decision.mode)) {
      setPhase('COMPLETE');
      showStatus('요청 처리가 완료되었습니다.');
    } else {
      setPhase('IDLE');
      showStatus('현재 탭과 연결되었습니다.');
    }
  }, [appendMessage, backend, currentSnapshot, pageIdentity, sendTabCommand, showStatus]);

  const submit = useCallback(async (content: string) => {
    updateBusy(true);
    automaticActionsRef.current = 0;
    appendMessage('user', content);
    showStatus('현재 페이지 구조를 읽고 있습니다.');
    try {
      if (!siteConnected) await connectCurrentSite();
      const snapshot = await currentSnapshot();
      const request = {
        requestId: `ext-request-${crypto.randomUUID()}`,
        messageId: `ext-message-${crypto.randomUUID()}`,
        content,
        pageIdentity: pageIdentity(snapshot),
        snapshot
      };
      const sessionId = sessionIdRef.current;
      const path = sessionId
        ? `/api/v1/extension/sessions/${encodeURIComponent(sessionId)}/messages`
        : '/api/v1/extension/sessions';
      await handleDecision(await backend(path, request));
    } catch (error) {
      const tabId = tabIdRef.current;
      if (sessionIdRef.current && tabId !== null) {
        await chrome.storage.session.remove(`session:${tabId}`);
        sessionIdRef.current = null;
      }
      setPhase('ERROR');
      appendMessage('ai', '요청을 처리하지 못했습니다. 아래 연결 상태를 확인해 주세요.');
      showStatus(errorMessage(error), true);
    } finally {
      updateBusy(false);
    }
  }, [appendMessage, backend, connectCurrentSite, currentSnapshot, handleDecision,
    pageIdentity, showStatus, siteConnected, updateBusy]);

  const submitDraft = useCallback(() => {
    const content = draft.trim();
    if (!content || busyRef.current) return;
    setDraft('');
    void submit(content);
  }, [draft, submit]);

  const saveSettings = useCallback(async () => {
    try {
      const normalized = normalizeBackendUrl(backendUrl);
      const granted = await chrome.permissions.request({ origins: [`${normalized}/*`] });
      if (!granted) throw new Error('Backend 접속 권한이 필요합니다.');
      await chrome.storage.local.set({ backendUrl: normalized });
      setBackendUrl(normalized);
      sessionIdRef.current = null;
      setSettingsOpen(false);
      showStatus('Backend 주소를 저장했습니다.');
    } catch (error) {
      showStatus(errorMessage(error), true);
    }
  }, [backendUrl, showStatus]);

  const toggleVoice = useCallback(async () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = (window as typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
      SpeechRecognition?: SpeechRecognitionConstructor;
    }).SpeechRecognition || (window as typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showStatus('이 Chrome 환경에서는 음성 인식을 지원하지 않습니다.', true);
      return;
    }
    try {
      const granted = await chrome.permissions.request({ permissions: ['audioCapture'] });
      if (!granted) throw new Error('음성 입력을 사용하려면 마이크 권한이 필요합니다.');
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) setDraft((current) => current ? `${current} ${transcript}` : transcript);
      };
      recognition.onerror = () => showStatus('음성을 인식하지 못했습니다. 다시 시도해 주세요.', true);
      recognition.onend = () => {
        recognitionRef.current = null;
        setListening(false);
      };
      recognitionRef.current = recognition;
      setListening(true);
      showStatus('듣고 있습니다. 말씀을 마치면 입력창에 반영됩니다.');
      recognition.start();
    } catch (error) {
      setListening(false);
      showStatus(errorMessage(error), true);
    }
  }, [listening, showStatus]);

  useEffect(() => {
    let disposed = false;
    void chrome.storage.local.get(['backendUrl', 'theme']).then(async (stored) => {
      if (disposed) return;
      setBackendUrl(typeof stored.backendUrl === 'string' ? stored.backendUrl : DEFAULT_BACKEND_URL);
      if (stored.theme === 'light' || stored.theme === 'dark' || stored.theme === 'system') {
        setTheme(stored.theme);
      }
      try {
        const tab = await runtime({ type: 'AUTOBROWSER_ACTIVE_TAB' });
        if (disposed || typeof tab.tabId !== 'number') return;
        tabIdRef.current = tab.tabId;
        setSiteConnected(true);
        setPageTitle(tab.title || tab.url || '현재 Chrome 탭');
        const saved = await chrome.storage.session.get(`session:${tab.tabId}`);
        sessionIdRef.current = typeof saved[`session:${tab.tabId}`] === 'string'
          ? saved[`session:${tab.tabId}`] : null;
        showStatus(sessionIdRef.current ? '기존 대화 세션과 연결되었습니다.' : '현재 탭과 연결되었습니다.');
      } catch (error) {
        if (disposed) return;
        setSiteConnected(false);
        showStatus(errorMessage(error), true);
      }
    });
    return () => {
      disposed = true;
      recognitionRef.current?.stop();
    };
  }, [showStatus]);

  useEffect(() => {
    const listener = (message: unknown) => {
      const event = message as { type?: string; tabId?: number };
      if (event.type !== 'AUTOBROWSER_GUIDED_ACTION_RELAY' ||
          event.tabId !== tabIdRef.current || !sessionIdRef.current || busyRef.current) return;
      updateBusy(true);
      setPhase('READING');
      showStatus('사용자 조작 후 변경된 페이지를 다시 읽고 있습니다.');
      setTimeout(async () => {
        try {
          const snapshot = await currentSnapshot();
          const sessionId = sessionIdRef.current!;
          await handleDecision(await backend(
            `/api/v1/extension/sessions/${encodeURIComponent(sessionId)}/continue`,
            { pageIdentity: pageIdentity(snapshot), snapshot }
          ));
        } catch (error) {
          setPhase('ERROR');
          showStatus(errorMessage(error), true);
        } finally {
          updateBusy(false);
        }
      }, 500);
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [backend, currentSnapshot, handleDecision, pageIdentity, showStatus, updateBusy]);

  const rotateTheme = useCallback(() => {
    const value = nextTheme(theme);
    setTheme(value);
    void chrome.storage.local.set({ theme: value });
  }, [theme]);

  const connectionLabel = useMemo(() => siteConnected ? '페이지 연결됨' : '연결 필요', [siteConnected]);

  return <div className="app-shell">
    <header className="app-header">
      <div className="brand-mark"><SparkIcon /></div>
      <div className="brand-copy">
        <strong>AutoBrowser</strong>
        <span title={pageTitle}>{pageTitle}</span>
      </div>
      <div className="header-actions">
        <button className="icon-button" onClick={rotateTheme} title={`테마: ${themeLabel}`}>
          <ThemeGlyph theme={theme} />
        </button>
        <button className={`icon-button ${settingsOpen ? 'active' : ''}`}
          onClick={() => setSettingsOpen((open) => !open)} title="설정">
          <SettingsIcon />
        </button>
      </div>
    </header>

    {settingsOpen && <section className="settings-panel">
      <div className="section-label">연결 설정</div>
      <label htmlFor="backend-url">Railway Backend 주소</label>
      <div className="settings-input-row">
        <input id="backend-url" type="url" value={backendUrl}
          onChange={(event) => setBackendUrl(event.target.value)}
          placeholder="backend-production.up.railway.app" />
        <button onClick={() => void saveSettings()}>저장</button>
      </div>
      <p>API 키는 확장 프로그램에 저장하지 않습니다.</p>
    </section>}

    <ProgressRail phase={phase} />

    <main className="conversation" aria-live="polite">
      {messages.map((message) => <article key={message.id} className={`message ${message.role}`}>
        <div className="message-avatar">{message.role === 'ai' ? <SparkIcon /> : '나'}</div>
        <div className="message-body">
          <span className="message-author">{message.role === 'ai' ? 'AutoBrowser' : '사용자'}</span>
          <p>{message.text}</p>
        </div>
      </article>)}
      {busy && <div className="thinking" aria-label="처리 중"><i /><i /><i /></div>}
      <div ref={messageEndRef} />
    </main>

    <section className={`connection-bar ${isError ? 'error' : ''}`}>
      <span className={`connection-dot ${siteConnected ? 'online' : ''}`} />
      <div><strong>{connectionLabel}</strong><span>{status}</span></div>
      {!siteConnected && <button className="connect-button" onClick={() => void connectCurrentSite()}>
        <LinkIcon /> 연결
      </button>}
    </section>

    <footer className="composer-wrap">
      {listening && <div className="voice-indicator"><span />음성을 듣고 있습니다</div>}
      <div className="composer">
        <textarea ref={inputRef} value={draft} disabled={busy} maxLength={500} rows={2}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submitDraft();
            }
          }}
          placeholder="현재 페이지에서 원하는 작업을 입력하세요" />
        <button className={`voice-button ${listening ? 'listening' : ''}`} disabled={busy}
          onClick={() => void toggleVoice()} title="음성 입력">
          <MicIcon />
        </button>
        <button className="send-button" disabled={busy || !draft.trim()}
          onClick={submitDraft} title="메시지 전송">
          <SendIcon />
        </button>
      </div>
      <span className="composer-hint">Enter 전송 · Shift+Enter 줄바꿈</span>
    </footer>
  </div>;
}
