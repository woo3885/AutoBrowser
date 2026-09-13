import { normalizeBackendUrl } from "./url-utils.js";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8080";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const stored = await chrome.storage.local.get("backendUrl");
  if (!stored.backendUrl) await chrome.storage.local.set({ backendUrl: DEFAULT_BACKEND_URL });
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("현재 Chrome 탭을 찾을 수 없습니다.");
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "AUTOBROWSER_PING" });
    if (response?.ok) return;
  } catch {
    // The content script is injected below.
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] });
  } catch {
    throw new Error(
      "현재 탭에 접근할 수 없습니다. 일반 HTTP/HTTPS 웹사이트를 연 뒤 AutoBrowser 아이콘을 다시 눌러 주세요."
    );
  }
}

async function backendRequest(path, body) {
  const stored = await chrome.storage.local.get("backendUrl");
  const baseUrl = normalizeBackendUrl(stored.backendUrl || DEFAULT_BACKEND_URL);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true || !payload.data) {
    throw new Error(payload?.message || `Backend 요청 실패 (${response.status})`);
  }
  return payload.data;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "AUTOBROWSER_GUIDED_ACTION") {
    chrome.runtime.sendMessage({
      type: "AUTOBROWSER_GUIDED_ACTION_RELAY",
      tabId: sender.tab?.id,
      snapshotId: message.snapshotId
    }).catch(() => {});
    return false;
  }
  if (message?.type === "AUTOBROWSER_ACTIVE_TAB") {
    activeTab().then(async (tab) => {
      await ensureContentScript(tab.id);
      return { tabId: tab.id, url: tab.url || "", title: tab.title || "" };
    }).then(sendResponse).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === "AUTOBROWSER_TAB_COMMAND") {
    activeTab().then(async (tab) => {
      await ensureContentScript(tab.id);
      const result = await chrome.tabs.sendMessage(tab.id, message.command);
      return { tabId: tab.id, result };
    }).then(sendResponse).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type === "AUTOBROWSER_BACKEND") {
    backendRequest(message.path, message.body)
      .then((data) => sendResponse({ data }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  return false;
});
