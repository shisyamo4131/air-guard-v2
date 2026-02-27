/*****************************************************************************
 * @file ./components/atoms/Btns/useBtns.js
 * @description ボタンコンポーネント共通コンポーザブル
 * @author shisyamo4131
 * `./components/atoms/Btns` 内のコンポーネントで使用する共通コンポーザブル
 * 非常にシンプルなコンポーザブルのため、必要性に疑問を感じるが、
 * 将来的に機能が増える可能性を考慮して作成。
 *****************************************************************************/
import * as Vue from "vue";

export function useBtns(props, emit) {
  const attrs = Vue.computed(() => {
    /**
     * props.icon が truthy な場合は props.prependIcon を icon に設定し、
     * falsy な場合は false を icon に設定する。
     */
    const icon = props.icon ? props.prependIcon : false;

    /**
     * props.icon が truthy な場合は props.prependIcon を undefined に設定し、
     * falsy な場合は props.prependIcon をそのまま使用する。
     */
    const prependIcon = props.icon ? undefined : props.prependIcon;

    /**
     * props.icon が truthy な場合は props.text を undefined に設定し、
     * falsy な場合は props.text をそのまま使用する。
     */
    const text = props.icon ? undefined : props.text;
    const onClick = (e) => emit("click", e);

    return { ...props, icon, prependIcon, text, onClick };
  });

  return { attrs };
}
