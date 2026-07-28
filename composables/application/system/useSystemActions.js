import { useSystemStore } from "@/stores/useSystemStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSystemActions() {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useSystemActions", useErrorsStore());
  const systemStore = useSystemStore();

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  async function initializeSystem() {
    try {
      await systemStore.system.fetch({ docId: "system" });
      systemStore.system.subscribe({ docId: "system" });
    } catch (error) {
      logger.error({ message: "Failed to fetch System document:", error });
      // On fetch failure, force maintenance mode to be true
      systemStore.system.isMaintenance = true;
    }
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    initializeSystem,
  };
}
