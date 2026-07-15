/*****************************************************************************
 * @file ./composables/application/draggable/createDraggableFallbackOptions.js
 * @description vue-draggable コンポーネントに対する共通設定を返します。
 * - 当該関数が生成するオプションを vue-draggable に適用することで、PC以外の
 *   端末でもドラッグ中の要素が正常に表示されるなど、機能が改善されます。
 *****************************************************************************/
export function createDraggableFallbackOptions() {
  return {
    // 以下、スマホやタブレット端末においてドラッグ中の要素をPCと同様に取り扱うための追加設定
    // この設定を行わないと、ドラッグ中の要素が親コンテナの描画範囲からはみ出ないなどの問題が発生する
    ghostClass: "sortable-ghost",
    forceFallback: true,
    fallbackOnBody: true,
    appendTo: "body",
  };
}
