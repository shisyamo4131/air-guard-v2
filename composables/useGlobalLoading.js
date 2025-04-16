// composables/useGlobalLoading.js
import { reactive, readonly, computed } from "vue";

/**
 * グローバルローディング状態を管理するコンポーザブル。
 * 各処理を識別するキーごとにカウントとメッセージを保持し、
 * アプリ全体での「処理中」状態を制御可能とする。
 */
const state = reactive({
  // 各処理の状態（カウント、メッセージ、開始時刻）
  processes: {}, // key: { count, message, startedAt }
  // 今後の拡張用（明示的な主キーを設定する場合など）
  primaryKey: null,
});

export function useGlobalLoading() {
  /**
   * 少なくとも1つ以上の処理が実行中であるかどうか。
   * Whether any loading process is active.
   */
  const isLoading = computed(() => {
    return Object.values(state.processes).some((p) => p.count > 0);
  });

  /**
   * 現在実行中の各処理のメッセージをマップ形式で取得。
   * Messages of active processes keyed by identifier.
   */
  const messages = computed(() => {
    const result = {};
    for (const [key, p] of Object.entries(state.processes)) {
      if (p.count > 0 && p.message) {
        result[key] = p.message;
      }
    }
    return result;
  });

  /**
   * 指定したキーに対応する処理のメッセージを取得する。
   * Get the message of a specific loading process.
   * @param {string} key - 処理識別子
   * @returns {string|null} - メッセージまたは null
   */
  const getMessage = (key) => {
    const p = state.processes[key];
    return p?.count > 0 ? p.message : null;
  };

  /**
   * 現在進行中の処理キー一覧を取得。
   * Get an array of keys of currently active processes.
   * @returns {string[]}
   */
  const getLoadingKeys = () => {
    return Object.entries(state.processes)
      .filter(([_, p]) => p.count > 0)
      .map(([key]) => key);
  };

  /**
   * 最も早く開始された処理のメッセージを取得。
   * Used to determine which message should be shown in global UI.
   */
  const primaryMessage = computed(() => {
    const active = Object.entries(state.processes)
      .filter(([_, p]) => p.count > 0 && p.message)
      .sort((a, b) => a[1].startedAt - b[1].startedAt);

    return active[0]?.[1].message ?? "";
  });

  /**
   * 指定されたキーの処理を開始し、必要に応じてメッセージを設定。
   * Start a loading process.
   * @param {string} key - 処理識別子
   * @param {string} [message] - 任意の表示メッセージ
   */
  const startLoading = (key, message = "") => {
    if (!state.processes[key]) {
      state.processes[key] = {
        count: 0,
        message: "",
        startedAt: Date.now(),
      };
    }
    state.processes[key].count++;
    if (message) state.processes[key].message = message;
    if (!state.processes[key].startedAt) {
      state.processes[key].startedAt = Date.now();
    }
  };

  /**
   * 指定されたキーの処理を終了。
   * 完了時にはメッセージと開始時刻もクリア。
   * Stop a loading process.
   * @param {string} key - 処理識別子
   */
  const stopLoading = (key) => {
    const process = state.processes[key];
    if (process && process.count > 0) {
      process.count--;
      if (process.count === 0) {
        process.message = "";
        process.startedAt = undefined;
      }
    }
  };

  /**
   * 指定キーのメッセージを更新する。
   * Update the message of a specific process.
   * @param {string} key - 処理識別子
   * @param {string} message - 表示メッセージ
   */
  const setLoadingMessage = (key, message) => {
    if (!state.processes[key]) {
      state.processes[key] = { count: 0, message: "", startedAt: Date.now() };
    }
    state.processes[key].message = message;
  };

  return {
    isLoading: readonly(isLoading),
    messages: readonly(messages),
    primaryMessage,
    getMessage,
    getLoadingKeys,
    startLoading,
    stopLoading,
    setLoadingMessage,
  };
}
