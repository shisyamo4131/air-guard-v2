/**
 * target を指定して開くメニューの状態を管理します。
 *
 * Vuetify の `VMenu` は、`target` に HTMLElement を渡すことで任意の要素を起点に
 * メニューを表示できます。この composable は、そのために必要な「開閉状態」、
 * 「表示起点となる target 要素」、「メニューの対象データ」をまとめて扱います。
 *
 * `attrs` は `VMenu` に渡すための属性オブジェクトです。
 *
 * 同じメニューを別の target で開き直す場合、開いたまま target だけを差し替えると
 * 位置が更新されないことがあります。そのため `open()` は、すでに開いている場合に
 * 一度閉じ、短い待機時間を挟んでから新しい target で開き直します。
 *
 * @param {Object} options
 * @param {string|Function} [options.target]
 * Event から `VMenu` の target 要素を解決するための selector または関数。
 * string を指定した場合は `event.target.closest(options.target)` を使用します。
 * 未指定の場合は `event.target` をそのまま target として使用します。
 *
 * @param {number} [options.reopenDelay=100]
 * すでに開いているメニューを別 target で開き直すまでの待機時間。
 * `VMenu` が close を反映してから再 open できるようにするための値です。
 *
 * @returns {Object}
 * @returns {Ref<boolean>} returns.isOpen - `VMenu` の `v-model` に渡す開閉状態。
 * @returns {Ref<HTMLElement|null>} returns.target - `VMenu` の `target` に渡す表示起点。
 * @returns {Ref<*>} returns.context - メニューに紐づけたい任意の対象データ。
 * @returns {Function} returns.open - event と任意の context を受け取り、メニューを開きます。
 * @returns {Function} returns.close - メニューを閉じます。
 */
export function useTargetedMenu(options = {}) {
  const { target: targetResolver, reopenDelay = 100 } = options;

  const isOpen = ref(false);
  const target = ref(null);
  const context = ref(null);

  function resolveTarget(event) {
    if (!event) return null;
    if (typeof targetResolver === "function") return targetResolver(event);
    if (typeof targetResolver === "string") {
      return event.target?.closest(targetResolver) ?? null;
    }
    return event.target ?? null;
  }

  function close() {
    isOpen.value = false;
  }

  async function open(event, newContext = null) {
    if (isOpen.value) {
      close();
      await new Promise((resolve) => setTimeout(resolve, reopenDelay));
    }
    target.value = resolveTarget(event);
    context.value = newContext;
    isOpen.value = true;
  }

  const attrs = computed(() => {
    return {
      modelValue: isOpen.value,
      target: target.value,
      "onUpdate:modelValue": (value) => {
        isOpen.value = value;
      },
    };
  });

  return {
    attrs,
    isOpen,
    target,
    context,
    open,
    close,
  };
}
