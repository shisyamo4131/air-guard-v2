import { computed } from "vue";
import { useLogger } from "@/composables/useLogger";

const DEFINITION = {
  small: { title: "小", value: "small" },
  medium: { title: "中", value: "medium" },
  large: { title: "大", value: "large" },
};

export const SMALL = DEFINITION.small.value;
export const MEDIUM = DEFINITION.medium.value;
export const LARGE = DEFINITION.large.value;

export function useTagSize({ initialSize = MEDIUM } = {}) {
  /***************************************************************************
   * DEFINE COMPOSABLES / STORES
   ***************************************************************************/
  const logger = useLogger("useTagSize");

  /***************************************************************************
   * DEFINE REFS
   ***************************************************************************/
  // Current size of the tag. Output warning if invalid initialSize is provided.
  const current = ref(MEDIUM);
  if (!Object.keys(DEFINITION).includes(initialSize)) {
    logger.warn({ message: "Invalid initialSize", data: { initialSize } });
  } else {
    current.value = initialSize;
  }

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  const update = (newSize) => {
    try {
      current.value = newSize;
    } catch (error) {
      logger.error({ error, data: { newSize } });
    }
  };

  return {
    /** state */
    isSmall: computed(() => current.value === SMALL),
    isMedium: computed(() => current.value === MEDIUM),
    isLarge: computed(() => current.value === LARGE),

    /** values */
    current,
    items: computed(() => Object.values(DEFINITION)),
    values: computed(() => Object.keys(DEFINITION)),

    /** methods */
    update,
  };
}
