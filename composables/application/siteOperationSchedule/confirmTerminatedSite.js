export function confirmTerminatedScheduleSite({ siteId, site } = {}) {
  if (typeof window === "undefined") return false;
  const label = site?.displayName || site?.name || siteId;
  return window.confirm(
    `「${label}」は終了済みの現場です。終了済みのまま単発予定に使用しますか？`,
  );
}
