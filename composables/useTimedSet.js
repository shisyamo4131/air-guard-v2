/**
 * @file useTimedSet.js
 * @description A Vue composable for managing a time-limited Set.
 * Added keys are automatically removed after a specified timeout duration.
 * Leverages Vue's reactivity system, so changes to the Set are automatically
 * reflected in templates and computed properties.
 *
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.timeout=1000] - Time in milliseconds before keys are automatically removed
 *
 * Primary use cases:
 * - Temporary highlight effects
 * - Caching and debounce functionality
 * - Time-based state management
 *
 * @example
 * // Default timeout (1000ms)
 * const { add, has, remove } = useTimedSet();
 *
 * // Custom timeout (2000ms)
 * const { add, has, remove } = useTimedSet({ timeout: 2000 });
 *
 * // Add a key (automatically removed after timeout)
 * add('highlight-user-123');
 *
 * // Use reactively in template
 * // :class="{ highlight: has('highlight-user-123') }"
 *
 * // Manual removal is also possible
 * remove('highlight-user-123');
 */
import { ref } from "vue";

export function useTimedSet({ timeout = 1000 } = {}) {
  const set = ref(new Set());

  /**
   * Adds a key to the set.
   * @param {*} key
   * @returns {boolean} - Returns `true` if the key was added, `false` if it was already present.
   */
  const add = (key) => {
    // Return `false` if the key already exists.
    if (set.value.has(key)) return false;

    // Add the key to the set and set a timeout to remove it after the specified duration.
    set.value.add(key);
    setTimeout(() => set.value.delete(key), timeout);

    // Return `true` to indicate the key was added successfully.
    return true;
  };

  /**
   * Removes a key from the set.
   * @param {*} key
   * @returns {boolean} - Returns `true` if the key was removed, `false` if it was not present.
   */
  const remove = (key) => set.value.delete(key);

  /**
   * Checks if a key is present in the set.
   * @param {*} key
   * @returns {boolean} - Returns `true` if the key is present, `false` otherwise.
   */
  const has = (key) => set.value.has(key);

  return { add, remove, has };
}
