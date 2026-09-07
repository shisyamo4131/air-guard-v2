import { ref, watch, onScopeDispose } from "vue";
import { useFetch } from "@/composables/fetch/useFetch";

export function useOperationArticleInput(props, emit) {
  const { fetchArticleComposable } = useFetch("OperationRowInput");
  const error = ref(""), pending = ref(false);
  let generation = 0, priceRevision = 0;
  function cancel() { generation++; pending.value = false; emit("pending", false); }
  function changePrice(value) { if (!props.disabled) { priceRevision++; props.updateProperties({ price: value }); } }
  async function chooseArticle(id) {
    if (props.disabled) return;
    const ticket = ++generation, draft = props.item, priceAtStart = priceRevision;
    error.value = ""; pending.value = true; emit("pending", true);
    try {
      const article = id ? await fetchArticleComposable.getArticle(id) : null;
      if (ticket !== generation || props.item !== draft || props.disabled) return;
      if (id && !article) throw new Error();
      // ID and its initial price become visible together. Explicit price input
      // during the lookup wins, including re-entering the original price.
      props.updateProperties({ articleId: id, price: priceRevision === priceAtStart ? article?.price ?? 0 : draft.price });
    } catch { if (ticket === generation) error.value = "商品を取得できません。選択前の内容を保持しています。"; }
    finally { if (ticket === generation) { pending.value = false; emit("pending", false); } }
  }
  watch(() => [props.item, props.disabled], cancel);
  onScopeDispose(cancel);
  return { chooseArticle, changePrice, error, pending };
}
