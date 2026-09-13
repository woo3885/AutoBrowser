(() => {
  if (globalThis.__AUTOBROWSER_CONTENT_SCRIPT__) return;
  globalThis.__AUTOBROWSER_CONTENT_SCRIPT__ = true;

  const MAX_ELEMENTS = 300;
  const candidates = [
    "a[href]", "button", "input:not([type='hidden'])", "select", "textarea",
    "[contenteditable='true']", "[role='button']", "[role='link']", "[role='checkbox']",
    "[role='radio']", "[role='option']", "[role='textbox']", "[tabindex]:not([tabindex='-1'])"
  ].join(",");
  let registry = new Map();
  let currentSnapshotId = null;
  let overlayRoot = null;

  const normalize = (value, max = 200) => {
    const text = String(value || "").replace(/\s+/gu, " ").trim();
    return text ? Array.from(text).slice(0, max).join("") : null;
  };

  function roleOf(element) {
    const explicit = normalize(element.getAttribute("role"), 32);
    if (explicit) return explicit.toLowerCase();
    const tag = element.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea" || element.isContentEditable) return "textbox";
    if (tag === "input") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox" || type === "radio") return type;
      return "textbox";
    }
    return null;
  }

  function labelOf(element) {
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelled = labelledBy && document.getElementById(labelledBy)?.textContent;
    const htmlLabel = element.id
      ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent
      : element.closest("label")?.textContent;
    return normalize(element.getAttribute("aria-label") || labelled || htmlLabel ||
      element.innerText || element.getAttribute("title") || element.getAttribute("alt"), 120);
  }

  function visible(element, rect) {
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" &&
      style.visibility !== "hidden" && style.opacity !== "0";
  }

  function securityPolicy(element, label, inputType) {
    const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase();
    if (inputType === "password" || /(?:one-time-code|cc-number|cc-csc|current-password|new-password)/u.test(autocomplete)) {
      return "SECURE_INPUT";
    }
    if (inputType === "checkbox" || inputType === "radio" || element.tagName === "SELECT") {
      return "USER_DECISION";
    }
    if (/(?:최종\s*확인|송금\s*(?:실행|완료)|결제\s*(?:하기|완료)|주문\s*(?:하기|완료)|계정\s*삭제|pay\s+now|place\s+order|delete\s+account)/iu.test(label || "")) {
      return "FINAL_CONFIRMATION";
    }
    return "NORMAL";
  }

  function collectSnapshot() {
    clearOverlay();
    const token = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const snapshotId = `snap-${token}`;
    const nextRegistry = new Map();
    const elements = [];
    for (const element of document.querySelectorAll(candidates)) {
      if (elements.length >= MAX_ELEMENTS || element.closest("[data-autobrowser-ui='true']")) continue;
      const rect = element.getBoundingClientRect();
      if (!visible(element, rect)) continue;
      const elementId = `el-${token}-${String(elements.length + 1).padStart(3, "0")}`;
      const tag = element.tagName.toLowerCase();
      const inputType = tag === "input" ? (element.getAttribute("type") || "text").toLowerCase() : null;
      const ariaLabel = labelOf(element);
      const disabled = element.disabled === true || element.getAttribute("aria-disabled") === "true";
      const checked = typeof element.checked === "boolean" ? element.checked :
        element.getAttribute("aria-checked") === null ? null : element.getAttribute("aria-checked") === "true";
      const policy = securityPolicy(element, ariaLabel, inputType);
      nextRegistry.set(elementId, { element, policy, snapshotId });
      elements.push({
        elementId,
        tag,
        role: roleOf(element),
        text: tag === "input" || tag === "textarea" ? null : normalize(element.innerText, 200),
        ariaLabel,
        placeholder: normalize(element.getAttribute("placeholder"), 120),
        inputType,
        visible: true,
        enabled: !disabled,
        checked,
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        securityPolicy: policy
      });
    }
    registry = nextRegistry;
    currentSnapshotId = snapshotId;
    return {
      schemaVersion: "1.0",
      snapshotId,
      page: {
        url: location.href,
        title: normalize(document.title, 200) || "제목 없는 페이지",
        productId: null,
        productName: null,
        productPeriod: null,
        depositAmount: null
      },
      elements
    };
  }

  function resolveTarget(snapshotId, elementId) {
    const entry = registry.get(elementId);
    if (!entry || currentSnapshotId !== snapshotId || entry.snapshotId !== snapshotId ||
        !entry.element.isConnected) throw new Error("페이지가 변경되어 대상을 다시 확인해야 합니다.");
    const rect = entry.element.getBoundingClientRect();
    if (!visible(entry.element, rect) || entry.element.disabled === true) {
      throw new Error("대상이 현재 조작 가능한 상태가 아닙니다.");
    }
    return entry;
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) throw new Error("이 입력 요소는 자동 입력을 지원하지 않습니다.");
    setter.call(element, value);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function execute(action, snapshotId) {
    if (!action || !["CLICK", "TYPE"].includes(action.actionType)) {
      throw new Error("허용되지 않은 AI 동작입니다.");
    }
    const entry = resolveTarget(snapshotId, action.targetElementId);
    if (entry.policy !== "NORMAL") throw new Error("이 동작은 사용자가 직접 수행해야 합니다.");
    entry.element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    if (action.actionType === "CLICK") {
      entry.element.click();
    } else {
      if (!(entry.element instanceof HTMLInputElement || entry.element instanceof HTMLTextAreaElement) ||
          entry.element.type === "password" || !action.inputValue) {
        throw new Error("안전한 일반 텍스트 입력만 자동 실행할 수 있습니다.");
      }
      entry.element.focus();
      setNativeValue(entry.element, action.inputValue);
    }
    return { executed: true };
  }

  function clearOverlay() {
    overlayRoot?.remove();
    overlayRoot = null;
  }

  function showOverlay(action, snapshotId) {
    clearOverlay();
    const entry = resolveTarget(snapshotId, action.targetElementId);
    const root = document.createElement("div");
    root.dataset.autobrowserUi = "true";
    root.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:system-ui,sans-serif";
    const highlight = document.createElement("div");
    const guide = document.createElement("div");
    const position = () => {
      const rect = entry.element.getBoundingClientRect();
      highlight.style.cssText = `position:fixed;left:${rect.x - 4}px;top:${rect.y - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px;border:3px solid #2563eb;border-radius:8px;background:rgba(37,99,235,.08);box-shadow:0 0 0 9999px rgba(15,23,42,.12)`;
      const top = Math.min(innerHeight - 90, Math.max(12, rect.bottom + 12));
      guide.style.cssText = `position:fixed;left:${Math.min(innerWidth - 332, Math.max(12, rect.left))}px;top:${top}px;max-width:300px;padding:12px 14px;border-radius:10px;background:#0f172a;color:white;box-shadow:0 8px 30px rgba(0,0,0,.3);font-size:14px;line-height:1.45`;
    };
    guide.textContent = action.guide || `${action.accessibleLabel || "표시된 요소"}를 선택하세요.`;
    root.append(highlight, guide);
    document.documentElement.append(root);
    overlayRoot = root;
    position();
    const cleanup = () => {
      removeEventListener("scroll", position, true);
      removeEventListener("resize", position);
      clearOverlay();
    };
    addEventListener("scroll", position, true);
    addEventListener("resize", position);
    entry.element.addEventListener("click", () => {
      cleanup();
      // Notify before a navigation can destroy this content-script context.
      chrome.runtime.sendMessage({ type: "AUTOBROWSER_GUIDED_ACTION", snapshotId }).catch(() => {});
    }, { once: true, capture: true });
    setTimeout(cleanup, 30_000);
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "AUTOBROWSER_PING") {
      sendResponse({ ok: true, panelReady: Boolean(globalThis.__AUTOBROWSER_FLOATING_PANEL__) });
      return false;
    }
    const supported = new Set([
      "AUTOBROWSER_SNAPSHOT", "AUTOBROWSER_EXECUTE", "AUTOBROWSER_OVERLAY", "AUTOBROWSER_CLEAR_OVERLAY"
    ]);
    if (!supported.has(message?.type)) return false;
    Promise.resolve().then(() => {
      if (message?.type === "AUTOBROWSER_SNAPSHOT") return collectSnapshot();
      if (message?.type === "AUTOBROWSER_EXECUTE") return execute(message.action, message.snapshotId);
      if (message?.type === "AUTOBROWSER_OVERLAY") return showOverlay(message.action, message.snapshotId);
      if (message?.type === "AUTOBROWSER_CLEAR_OVERLAY") return clearOverlay() || { ok: true };
      throw new Error("알 수 없는 AutoBrowser 명령입니다.");
    }).then((result) => sendResponse({ data: result }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  });
})();
