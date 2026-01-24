/*****************************************************************************
 * Tag コンポーネント用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";

export function useIndex(props, emit) {
  /*****************************************************************************
   * SIZE CONFIGURATIONS
   *****************************************************************************/
  const SIZE_CONFIG = {
    small: {
      height: "40px",
      titleClass: "text-caption",
      progressSize: "x-small",
      removeButtonSize: "x-small",
    },
    medium: {
      height: "48px",
      titleClass: "text-subtitle-2",
      progressSize: "x-small",
      removeButtonSize: "small",
    },
    large: {
      height: "56px",
      titleClass: "text-body-1",
      progressSize: "small",
      removeButtonSize: "small",
    },
  };
  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  /**
   * Normalized size value (lowercase)
   */
  const normalizedSize = Vue.computed(() => props.size.toLowerCase());

  /**
   * Size configuration based on normalized size
   */
  const sizeConfig = Vue.computed(() => SIZE_CONFIG[normalizedSize.value]);

  /**
   * Tag height based on size
   */
  const tagHeight = Vue.computed(() => sizeConfig.value.height);

  /**
   * Title classes based on size
   */
  const titleClasses = Vue.computed(() => [
    "tag-base__title",
    sizeConfig.value.titleClass,
  ]);

  /**
   * Progress size based on size
   */
  const progressSize = Vue.computed(() => sizeConfig.value.progressSize);

  /**
   * Tag classes based on props
   */
  const tagClasses = Vue.computed(() => ({
    "tag-base": true,
    "tag-base--highlighted": props.highlight,
    [`tag-base--${normalizedSize.value}`]: true,
    [`tag-base--${props.variant}`]: props.variant !== "default",
    "tag-base--loading": isLoading.value,
  }));

  /**
   * Whether the tag is in loading state
   */
  const isLoading = Vue.computed(() => props.loading || !props.label);

  /**
   * Whether to show loading text (hidden for small size)
   */
  const showLoadingText = Vue.computed(() => normalizedSize.value !== "small");

  /**
   * Attributes for the remove button
   */
  const removeButtonAttrs = Vue.computed(() => ({
    disabled: isLoading.value,
    icon: props.removeIcon,
    isLoading: isLoading.value,
    size: sizeConfig.value.removeButtonSize,
    onClick: handleClickRemove,
  }));

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * Handler for the remove button click event.
   * Prevents event propagation and emits the 'click:remove' event.
   */
  function handleClickRemove(event) {
    event.stopPropagation();
    emit("click:remove");
  }

  return {
    tagClasses,
    tagHeight,
    titleClasses,
    progressSize,
    isLoading,
    showLoadingText,
    removeButtonAttrs,
  };
}
