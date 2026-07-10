/**
 * フローティングウィンドウの状態管理を行うComposable
 */
export function useFloatingWindow() {
  const isVisible = ref(false);
  const position = ref({ x: 200, y: 100 });

  /**
   * ウィンドウを表示/非表示切り替え
   * @param {Event} event - クリックイベント
   * @param {Object} options - ウィンドウオプション
   */
  function toggle(event, options = {}) {
    if (!isVisible.value) {
      // ウィンドウを開く時は、クリック位置を初期位置として設定
      const rect = event.target.getBoundingClientRect();
      const windowWidth = options.width || 280;
      const windowHeight = options.height || 400;

      let x = event.clientX || rect.left;
      let y = (event.clientY || rect.bottom) + 10;

      // 画面の境界チェック
      if (x + windowWidth > window.innerWidth) {
        x = window.innerWidth - windowWidth - 20;
      }
      if (y + windowHeight > window.innerHeight) {
        y = window.innerHeight - windowHeight - 20;
      }
      if (x < 0) x = 20;
      if (y < 0) y = 20;

      position.value = { x, y };
    }
    isVisible.value = !isVisible.value;
  }

  /**
   * ウィンドウを閉じる
   */
  function close() {
    isVisible.value = false;
  }

  /**
   * ウィンドウ位置を更新
   * @param {Object} newPosition - 新しい位置
   */
  function updatePosition(newPosition) {
    position.value = newPosition;
  }

  const attrs = computed(() => {
    return {
      isVisible: isVisible.value,
      initialX: position.value.x,
      initialY: position.value.y,
      onClose: close,
      onMove: updatePosition,
    };
  });
  return {
    isVisible: readonly(isVisible),
    position: readonly(position),
    toggle,
    close,
    updatePosition,

    attrs,
  };
}
