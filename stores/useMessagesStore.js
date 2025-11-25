/**
 * useMessagesStore
 * @version 1.1.0
 * @author shisyamo4131
 * @description A Pinia store for managing global messages in a queue.
 */
export const useMessagesStore = defineStore("messages", () => {
  /**
   * The queue of messages to be displayed in the application.
   * Messages are shown in order from the beginning of the array.
   */
  const queue = ref([]);

  /**
   * Add a message to the queue.
   * @param {string|object} message - The message to add. If a string is provided, it will be wrapped in an object with a default color of "success".
   */
  function add(message) {
    if (typeof message === "string") {
      queue.value.push({ text: message, color: "success" });
    } else {
      queue.value.push(message);
    }
  }

  return { queue, add };
});
