import { useState } from 'react';

import { useAgentConversation, type AgentChatSubmitRequest, type AgentConversationDependencies } from '../hooks/use-agent-conversation';
import { useAgentPageProtection } from '../hooks/use-agent-page-protection';
import { useAgentSpeechRecognition, useAgentSpeechSynthesis } from '../hooks/use-agent-speech';
import { useDomTargetOverlay } from '../hooks/use-dom-target-overlay';
import { CHAT_SENSITIVE_ERROR } from '../model/chat-message-policy';
import { normalizePublicHttpsUrl } from '../model/target-url';
import AgentChatPanel from './AgentChatPanel';
import DomTargetOverlay from './DomTargetOverlay';
import RemoteBrowserViewer from './RemoteBrowserViewer';
import '../styles/agent-chat.css';

interface AgentChatShellProps extends Omit<AgentConversationDependencies, 'onSubmitRequest'> {
  onSubmitRequest?: (request: AgentChatSubmitRequest) => void | Promise<void>;
}

export type { AgentChatSubmitRequest };

export default function AgentChatShell(props: AgentChatShellProps) {
  const pageProtection = useAgentPageProtection();
  const { state, protection, dispatch, submit, reconnect, clearOverlay, observeTarget } = useAgentConversation({
    ...props,
    pageProtection
  });
  const [isOpen, setIsOpen] = useState(true);
  const [siteUrl, setSiteUrl] = useState('');
  const [siteUrlError, setSiteUrlError] = useState<string | null>(null);
  const isOpening = state.submitPhase === 'SUBMITTING' || state.submitPhase === 'WAITING_FOR_ACK';
  const speechRecognition = useAgentSpeechRecognition({
    blocked: !protection.canStartStt,
    onDraft: (draft) => dispatch({ type: 'DRAFT_CHANGED', draft }),
    onSensitive: () => dispatch({ type: 'SAFE_ERROR_SET', error: CHAT_SENSITIVE_ERROR })
  });
  const speechSynthesis = useAgentSpeechSynthesis(!protection.canPlayTts, state.sessionId);
  useDomTargetOverlay({
    target: protection.canShowOverlay ? state.activeTarget : null,
    observationPhase: state.observationPhase,
    onClear: clearOverlay,
    onTargetClick: observeTarget
  });

  const startPublicBrowser = () => {
    const normalized = normalizePublicHttpsUrl(siteUrl);
    if (!normalized) {
      setSiteUrlError('외부에서 접속 가능한 HTTPS 주소를 입력해 주세요. localhost와 사설망 주소는 사용할 수 없습니다.');
      return;
    }
    setSiteUrlError(null);
    void submit('현재 페이지를 분석하고 이용할 수 있는 주요 기능을 설명해 주세요.', normalized);
  };

  return (
    <>
      {!state.sessionId ? (
        <div className="browser-launch-backdrop" data-ddd-agent-ui="true">
          <form
            className="browser-launch-dialog"
            onSubmit={(event) => { event.preventDefault(); startPublicBrowser(); }}
          >
            <p className="browser-launch-kicker">AutoBrowser</p>
            <h1>어떤 사이트를 열까요?</h1>
            <p>공개 HTTPS 사이트를 원격 브라우저로 열면 AI 채팅과 직접 클릭·스크롤을 사용할 수 있습니다.</p>
            <label htmlFor="browser-site-url">사이트 주소</label>
            <input
              id="browser-site-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com"
              value={siteUrl}
              disabled={isOpening}
              onChange={(event) => setSiteUrl(event.target.value)}
            />
            {siteUrlError ? <p className="browser-launch-error" role="alert">{siteUrlError}</p> : null}
            {state.submitPhase === 'ERROR' ? (
              <p className="browser-launch-error" role="alert">사이트를 열지 못했습니다. 주소와 백엔드 로그를 확인해 주세요.</p>
            ) : null}
            <button type="submit" disabled={isOpening}>
              {isOpening ? '사이트 여는 중…' : '사이트 열기'}
            </button>
          </form>
        </div>
      ) : null}
      <aside
        className={`agent-chat-shell${isOpen ? '' : ' agent-chat-shell-closed'}${
          state.sessionId && state.pageIdentity === null ? ' agent-chat-shell-remote' : ''
        }`}
        data-ddd-agent-ui="true"
        aria-label="AI 금융 도우미"
      >
        <button
          type="button"
          className="agent-chat-toggle"
          aria-expanded={isOpen}
          aria-controls="agent-chat-panel-content"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? 'AI 채팅 접기' : 'AI 채팅 열기'}
        </button>
        {isOpen ? (
          <div id="agent-chat-panel-content">
            {state.sessionId && state.pageIdentity === null ? (
              <RemoteBrowserViewer
                sessionId={state.sessionId}
                target={state.activeTarget}
                backendBaseUrl={props.backendBaseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8080'}
              />
            ) : null}
            <AgentChatPanel
              value={state.draft}
              messages={state.messages}
              submitPhase={state.submitPhase}
              connectionPhase={state.connectionPhase}
              safeError={state.safeError}
              interactionBlocked={!protection.canSubmitMessage}
              interactionBlockedReason={protection.announcement}
              canReconnect={protection.canReconnect}
              speechRecognition={speechRecognition}
              speechSynthesis={speechSynthesis}
              onReconnect={reconnect}
              onDraftChange={(draft) => dispatch({ type: 'DRAFT_CHANGED', draft })}
              onSubmit={(message) => void submit(message)}
              onDismissError={() => dispatch({ type: 'DRAFT_CHANGED', draft: state.draft })}
            />
          </div>
        ) : null}
      </aside>
      {protection.canShowOverlay && state.pageIdentity !== null && state.activeTarget ? (
        <DomTargetOverlay target={state.activeTarget} observationPhase={state.observationPhase} />
      ) : null}
    </>
  );
}
