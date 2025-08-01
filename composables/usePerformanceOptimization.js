/**
 * パフォーマンス最適化機能を提供するコンポーザブル
 * - computed のメモ化機能の強化
 * - 重い計算処理のキャッシュ機能
 * - デバウンス機能やバッチ処理機能
 */
import { ref, computed, shallowRef, triggerRef, watch } from "vue";

/**
 * 重い計算処理をメモ化する
 * @param {Function} computeFn - 計算関数
 * @param {Array} dependencies - 依存関係の配列
 * @param {Object} options - オプション
 * @returns {ComputedRef} メモ化されたcomputed
 */
export function useMemoizedComputed(computeFn, dependencies, options = {}) {
  const {
    maxCacheSize = 100,
    ttl = 60000, // キャッシュの有効期限（ミリ秒）
    deep = false,
  } = options;

  const cache = new Map();
  const timestamps = new Map();

  return computed(() => {
    const depsValue = dependencies.map((dep) => {
      return typeof dep === "function" ? dep() : dep.value;
    });

    const key = deep ? JSON.stringify(depsValue) : depsValue.join("|");

    const now = Date.now();

    // 期限切れキャッシュの削除
    if (timestamps.has(key)) {
      const timestamp = timestamps.get(key);
      if (now - timestamp > ttl) {
        cache.delete(key);
        timestamps.delete(key);
      }
    }

    // キャッシュヒット
    if (cache.has(key)) {
      return cache.get(key);
    }

    // キャッシュサイズ制限
    if (cache.size >= maxCacheSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
      timestamps.delete(oldestKey);
    }

    // 新しい値を計算してキャッシュ
    const result = computeFn();
    cache.set(key, result);
    timestamps.set(key, now);

    return result;
  });
}

/**
 * デバウンス機能付きのref
 * @param {any} initialValue - 初期値
 * @param {number} delay - デバウンス遅延（ミリ秒）
 * @returns {Object} デバウンスされたref
 */
export function useDebouncedRef(initialValue, delay = 300) {
  const value = ref(initialValue);
  const debouncedValue = ref(initialValue);
  let timeoutId = null;

  watch(value, (newValue) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      debouncedValue.value = newValue;
    }, delay);
  });

  return {
    value,
    debouncedValue,
    immediate: (newValue) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      value.value = newValue;
      debouncedValue.value = newValue;
    },
  };
}

/**
 * 浅い比較を使用したshallowComputed
 * @param {Function} computeFn - 計算関数
 * @returns {ComputedRef} 浅い比較のcomputed
 */
export function useShallowComputed(computeFn) {
  const result = shallowRef();
  const deps = computed(computeFn);

  watch(
    deps,
    (newValue) => {
      // 浅い比較で変更を検出
      if (newValue !== result.value) {
        result.value = newValue;
        triggerRef(result);
      }
    },
    { immediate: true }
  );

  return result;
}

/**
 * バッチ処理機能
 * @param {Function} batchFn - バッチ処理関数
 * @param {Object} options - オプション
 * @returns {Function} バッチ実行関数
 */
export function useBatchProcessor(batchFn, options = {}) {
  const { maxBatchSize = 50, delay = 10, maxWaitTime = 1000 } = options;

  const queue = ref([]);
  let timeoutId = null;
  let startTime = null;

  const processBatch = async () => {
    if (queue.value.length === 0) return;

    const batch = queue.value.splice(0, maxBatchSize);

    try {
      await batchFn(batch);
    } catch (error) {
      console.error("Batch processing error:", error);
    }

    // 残りがあれば継続処理
    if (queue.value.length > 0) {
      timeoutId = setTimeout(processBatch, delay);
    } else {
      startTime = null;
    }
  };

  const add = (item) => {
    queue.value.push(item);

    if (!startTime) {
      startTime = Date.now();
    }

    const shouldProcessImmediately =
      queue.value.length >= maxBatchSize ||
      (startTime && Date.now() - startTime >= maxWaitTime);

    if (shouldProcessImmediately) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      processBatch();
    } else if (!timeoutId) {
      timeoutId = setTimeout(processBatch, delay);
    }
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    processBatch();
  };

  return {
    add,
    flush,
    queueSize: computed(() => queue.value.length),
  };
}

/**
 * レンダリング最適化のためのフレーム制御
 * @param {Function} callback - 実行するコールバック
 * @returns {Function} フレーム制御された関数
 */
export function useFrameThrottled(callback) {
  let frameId = null;
  let lastArgs = null;

  return (...args) => {
    lastArgs = args;

    if (frameId === null) {
      frameId = requestAnimationFrame(() => {
        callback.apply(null, lastArgs);
        frameId = null;
      });
    }
  };
}

/**
 * メモリ使用量の監視
 * @returns {Object} メモリ監視機能
 */
export function useMemoryMonitor() {
  const memoryInfo = ref({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
  });

  const updateMemoryInfo = () => {
    if (performance.memory) {
      memoryInfo.value = {
        usedJSHeapSize: Math.round(
          performance.memory.usedJSHeapSize / 1024 / 1024
        ),
        totalJSHeapSize: Math.round(
          performance.memory.totalJSHeapSize / 1024 / 1024
        ),
        jsHeapSizeLimit: Math.round(
          performance.memory.jsHeapSizeLimit / 1024 / 1024
        ),
      };
    }
  };

  const startMonitoring = (interval = 5000) => {
    updateMemoryInfo();
    return setInterval(updateMemoryInfo, interval);
  };

  const getMemoryUsagePercentage = computed(() => {
    const { usedJSHeapSize, jsHeapSizeLimit } = memoryInfo.value;
    return jsHeapSizeLimit > 0 ? (usedJSHeapSize / jsHeapSizeLimit) * 100 : 0;
  });

  return {
    memoryInfo,
    updateMemoryInfo,
    startMonitoring,
    getMemoryUsagePercentage,
  };
}

/**
 * 遅延ローディング機能
 * @param {Function} loadFn - ローディング関数
 * @param {Object} options - オプション
 * @returns {Object} 遅延ローディング機能
 */
export function useLazyLoader(loadFn, options = {}) {
  const { threshold = 0.1, rootMargin = "50px" } = options;

  const isVisible = ref(false);
  const isLoaded = ref(false);
  const isLoading = ref(false);
  const error = ref(null);
  const data = ref(null);

  const elementRef = ref(null);
  let observer = null;

  const load = async () => {
    if (isLoaded.value || isLoading.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      data.value = await loadFn();
      isLoaded.value = true;
    } catch (err) {
      error.value = err;
    } finally {
      isLoading.value = false;
    }
  };

  const setupObserver = () => {
    if (!elementRef.value || observer) return;

    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          isVisible.value = true;
          load();
          observer.disconnect();
          observer = null;
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(elementRef.value);
  };

  watch(elementRef, () => {
    setupObserver();
  });

  return {
    elementRef,
    isVisible,
    isLoaded,
    isLoading,
    error,
    data,
    load: () => load(),
  };
}
