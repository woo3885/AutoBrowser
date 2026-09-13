export function normalizeBackendUrl(value) {
  let candidate = String(value || "").trim();
  const markdownLink = candidate.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/iu);
  if (markdownLink) candidate = markdownLink[1];
  candidate = candidate.replace(/^[`'"<\s]+|[`'">\s]+$/gu, "");
  if (!candidate) {
    throw new Error("Backend 주소를 입력해 주세요.");
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//iu.test(candidate)) {
    const local = /^(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/iu.test(candidate);
    candidate = `${local ? "http" : "https"}://${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("올바른 Backend 도메인을 입력해 주세요. 예: backend-production.up.railway.app");
  }
  const localHttp = url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("Railway 주소는 HTTPS여야 합니다.");
  }
  if (url.username || url.password) {
    throw new Error("사용자 정보가 포함된 Backend 주소는 사용할 수 없습니다.");
  }
  return url.origin;
}
