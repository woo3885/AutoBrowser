export type ThemePreference = 'system' | 'light' | 'dark';

export type ProgressPhase =
  | 'IDLE'
  | 'READING'
  | 'THINKING'
  | 'EXECUTING'
  | 'WAITING_USER'
  | 'COMPLETE'
  | 'ERROR';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

export interface PageSnapshot {
  snapshotId: string;
  page: { url: string; title: string };
  elements: unknown[];
  [key: string]: unknown;
}

export interface AgentAction {
  actionType: 'CLICK' | 'TYPE' | 'WAIT_FOR_USER';
  targetElementId: string;
  accessibleLabel?: string | null;
  guide?: string | null;
  inputValue?: string | null;
}

export interface AgentDecision {
  sessionId: string;
  mode: string;
  message?: string | null;
  sourceSnapshotId?: string | null;
  action?: AgentAction | null;
}

export const PROGRESS_STEPS = [
  { label: '페이지', caption: '화면 읽기' },
  { label: '판단', caption: 'AI 분석' },
  { label: '실행', caption: '안전한 동작' },
  { label: '확인', caption: '사용자 확인' }
] as const;

export function activeProgressStep(phase: ProgressPhase): number {
  if (phase === 'READING') return 0;
  if (phase === 'THINKING') return 1;
  if (phase === 'EXECUTING') return 2;
  if (phase === 'WAITING_USER') return 3;
  if (phase === 'COMPLETE') return PROGRESS_STEPS.length;
  return -1;
}

export function normalizeBackendUrl(value: string): string {
  let candidate = String(value || '').trim();
  const markdownLink = candidate.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/iu);
  if (markdownLink) candidate = markdownLink[1];
  candidate = candidate.replace(/^[`'"<\s]+|[`'">\s]+$/gu, '');
  if (!candidate) throw new Error('Backend 주소를 입력해 주세요.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//iu.test(candidate)) {
    const local = /^(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/iu.test(candidate);
    candidate = `${local ? 'http' : 'https'}://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('올바른 Backend 도메인을 입력해 주세요.');
  }
  const localHttp = url.protocol === 'http:' &&
    (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url.protocol !== 'https:' && !localHttp) throw new Error('Railway 주소는 HTTPS여야 합니다.');
  if (url.username || url.password) throw new Error('사용자 정보가 포함된 주소는 사용할 수 없습니다.');
  return url.origin;
}

export function nextTheme(theme: ThemePreference): ThemePreference {
  if (theme === 'system') return 'light';
  if (theme === 'light') return 'dark';
  return 'system';
}
