import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

export function useSystemActions() {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useSystemActions", useErrorsStore());
  const auth = useAuthStore();

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  async function initializeSystem() {
    try {
      await auth.system.fetch({ docId: "system" });
      auth.system.subscribe({ docId: "system" });
    } catch (error) {
      logger.error({ message: "Failed to fetch System document:", error });
      // On fetch failure, force maintenance mode to be true
      auth.system.isMaintenance = true;
    }
  }

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    initializeSystem,
  };
}
