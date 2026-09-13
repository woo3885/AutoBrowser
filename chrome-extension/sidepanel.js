import { normalizeBackendUrl } from "./url-utils.js";

const ui = {
  title: document.querySelector("#page-title"),
  messages: document.querySelector("#messages"),
  status: document.querySelector("#status"),
  form: document.querySelector("#composer"),
  input: document.querySelector("#message"),
  send: document.querySelector("#send"),
  settings: document.querySelector("#settings"),
  settingsToggle: document.querySelector("#settings-toggle"),
  backendUrl: document.querySelector("#backend-url"),
  saveSettings: document.querySelector("#save-settings")
};

let busy = false;
let activeTabId = null;
let sessionId = null;
let lastSnapshot = null;
let automaticActions = 0;

function pageIdentity(snapshot) {
  return `${activeTabId}:${snapshot.page.url}`.slice(0, 512);
}

function setStatus(text, error = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle("error", error);
}

function appendMessage(role, text) {
  if (!text) return;
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.textContent = text;
  ui.messages.append(item);
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

function setBusy(value) {
  busy = value;
  ui.input.disabled = value;
  ui.send.disabled = value;
  if (!value) ui.input.focus();
}

async function runtime(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.error) throw new Error(response?.error || "확장 프로그램 연결에 실패했습니다.");
  return response;
}

async function currentSnapshot() {
  const response = await runtime({
    type: "AUTOBROWSER_TAB_COMMAND",
    command: { type: "AUTOBROWSER_SNAPSHOT" }
  });
  activeTabId = response.tabId;
  if (response.result?.error || !response.result?.data) {
    throw new Error(response.result?.error || "현재 페이지를 읽지 못했습니다.");
  }
  lastSnapshot = response.result.data;
  ui.title.textContent = lastSnapshot.page.title;
  return lastSnapshot;
}

async function backend(path, body) {
  const response = await runtime({ type: "AUTOBROWSER_BACKEND", path, body });
  return response.data;
}

async function sendTabCommand(command) {
  const response = await runtime({ type: "AUTOBROWSER_TAB_COMMAND", command });
  if (response.tabId !== activeTabId) throw new Error("활성 탭이 변경되었습니다. 다시 요청해 주세요.");
  if (response.result?.error) throw new Error(response.result.error);
  return response.result?.data;
}

async function handleDecision(decision) {
  appendMessage("ai", decision.message);
  sessionId = decision.sessionId;
  await chrome.storage.session.set({ [`session:${activeTabId}`]: sessionId });

  if (decision.mode === "AUTO_EXECUTE" && decision.action) {
    if (automaticActions >= 8) throw new Error("연속 자동 동작 한도에 도달했습니다.");
    automaticActions += 1;
    setStatus(`${decision.action.accessibleLabel || "페이지 요소"} 작업 실행 중…`);
    await sendTabCommand({
      type: "AUTOBROWSER_EXECUTE",
      snapshotId: decision.sourceSnapshotId,
      action: decision.action
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    const nextSnapshot = await currentSnapshot();
    lastSnapshot = nextSnapshot;
    const next = await backend(`/api/v1/extension/sessions/${encodeURIComponent(sessionId)}/continue`, {
      pageIdentity: pageIdentity(nextSnapshot),
      snapshot: nextSnapshot
    });
    return handleDecision(next);
  }

  if (decision.mode === "GUIDE_USER" && decision.action) {
    await sendTabCommand({
      type: "AUTOBROWSER_OVERLAY",
      snapshotId: decision.sourceSnapshotId,
      action: decision.action
    });
    setStatus("표시된 요소를 사용자가 직접 조작해 주세요.");
    return;
  }

  if (["SECURE_INPUT_REQUIRED", "RISK_WARNING", "FINAL_CONFIRMATION_REQUIRED"].includes(decision.mode)) {
    setStatus("보호된 단계입니다. 페이지에서 직접 확인하고 입력해 주세요.");
  } else if (decision.mode === "ASK_USER") {
    setStatus("AI의 질문에 답해 주세요.");
  } else if (["COMPLETE", "STOP"].includes(decision.mode)) {
    setStatus("업무가 종료되었습니다.");
  } else {
    setStatus("현재 탭과 연결됨");
  }
}

async function submit(content) {
  setBusy(true);
  automaticActions = 0;
  appendMessage("user", content);
  setStatus("현재 페이지 분석 중…");
  try {
    const snapshot = await currentSnapshot();
    const request = {
      requestId: `ext-request-${crypto.randomUUID()}`,
      messageId: `ext-message-${crypto.randomUUID()}`,
      content,
      pageIdentity: pageIdentity(snapshot),
      snapshot
    };
    const path = sessionId
      ? `/api/v1/extension/sessions/${encodeURIComponent(sessionId)}/messages`
      : "/api/v1/extension/sessions";
    await handleDecision(await backend(path, request));
  } catch (error) {
    if (sessionId) {
      await chrome.storage.session.remove(`session:${activeTabId}`);
      sessionId = null;
    }
    appendMessage("ai", "요청을 처리하지 못했습니다. 페이지와 Backend 연결을 확인해 주세요.");
    setStatus(error instanceof Error ? error.message : "알 수 없는 오류", true);
  } finally {
    setBusy(false);
  }
}

async function requestBackendPermission(rawUrl) {
  const backendUrl = normalizeBackendUrl(rawUrl);
  const originPattern = `${backendUrl}/*`;
  const granted = await chrome.permissions.request({ origins: [originPattern] });
  if (!granted) throw new Error("Backend 접속 권한이 필요합니다.");
  await chrome.storage.local.set({ backendUrl });
  ui.backendUrl.value = backendUrl;
}

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = ui.input.value.trim();
  if (!content || busy) return;
  ui.input.value = "";
  void submit(content);
});

ui.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    ui.form.requestSubmit();
  }
});

ui.settingsToggle.addEventListener("click", () => {
  ui.settings.hidden = !ui.settings.hidden;
});

ui.saveSettings.addEventListener("click", async () => {
  try {
    await requestBackendPermission(ui.backendUrl.value.trim());
    sessionId = null;
    ui.settings.hidden = true;
    setStatus("Backend 주소를 저장했습니다.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.", true);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "AUTOBROWSER_GUIDED_ACTION_RELAY" ||
      message.tabId !== activeTabId || !sessionId || busy) return;
  setBusy(true);
  setStatus("사용자 조작 후 페이지를 다시 분석 중…");
  setTimeout(async () => {
    try {
      const snapshot = await currentSnapshot();
      await handleDecision(await backend(
        `/api/v1/extension/sessions/${encodeURIComponent(sessionId)}/continue`,
        { pageIdentity: pageIdentity(snapshot), snapshot }
      ));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "페이지 재분석에 실패했습니다.", true);
    } finally {
      setBusy(false);
    }
  }, 500);
});

(async () => {
  const stored = await chrome.storage.local.get("backendUrl");
  ui.backendUrl.value = stored.backendUrl || "http://127.0.0.1:8080";
  try {
    const tab = await runtime({ type: "AUTOBROWSER_ACTIVE_TAB" });
    activeTabId = tab.tabId;
    ui.title.textContent = tab.title || tab.url;
    const saved = await chrome.storage.session.get(`session:${activeTabId}`);
    sessionId = saved[`session:${activeTabId}`] || null;
    setStatus(sessionId ? "기존 대화 세션과 연결됨" : "현재 탭과 연결됨");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "현재 탭에 연결하지 못했습니다.", true);
  }
})();
