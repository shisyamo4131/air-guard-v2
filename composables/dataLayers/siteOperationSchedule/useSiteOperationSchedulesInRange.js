import { computed, shallowRef, watch, onScopeDispose, reactive } from "vue";
import {
  collection,
  doc,
  getDocFromServer,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetch } from "@/composables/fetch/useFetch";
import { rangeIsRef, rangeIsValid } from "@/composables/validators/rangeValidator";
import { createOperationRawContext } from "@/composables/domain/operation/operationRawContext";
import { rawForClass } from "@/composables/domain/shared/valueContract";

export function useSiteOperationSchedulesInRange({ from, to } = {}) {
  rangeIsRef({ from, to });
  const auth = useAuthStore(), { $firestore } = useNuxtApp();
  const { fetchSiteComposable, fetchEmployeeComposable, fetchOutsourcerComposable } = useFetch("useSiteOperationSchedulesInRange");
  const items = shallowRef([]), context = createOperationRawContext();
  let unsubscribe = null, activeTicket = null, activeOwner = null;
  const scope = computed(() => auth.uid && auth.companyId && auth.isSuperUserClaimValid === true && auth.user?.docId === auth.uid
    && auth.user?.companyId === auth.companyId && auth.user?.disabled === false && auth.user?.isTemporary === false ? `${auth.companyId}/${auth.uid}` : null);
  function stop() { unsubscribe?.(); unsubscribe = null; activeTicket = null; activeOwner = null; context.clear(); items.value = []; }
  function createModel(raw, ticket) {
    const model = reactive(new SiteOperationSchedule(rawForClass(raw)));
    context.remember(model, raw, ticket);
    fetchSiteComposable.fetchSite(model.siteId);
    fetchEmployeeComposable.fetchEmployee(model.employeeIds);
    fetchOutsourcerComposable.fetchOutsourcer(model.outsourcerIds);
    return model;
  }
  async function refresh(documentId) {
    const ticket = activeTicket, owner = activeOwner;
    if (!documentId || ticket === null || !owner || scope.value !== owner) return false;
    const snapshot = await getDocFromServer(doc($firestore, `Companies/${auth.companyId}/SiteOperationSchedules/${documentId}`));
    if (ticket !== context.generation || ticket !== activeTicket || scope.value !== owner) return false;
    return {
      exists: snapshot.exists(),
      value: snapshot.exists() ? createModel(snapshot.data(), ticket) : null,
    };
  }
  watch([from, to, scope], ([start, end, owner]) => {
    stop();
    if (!owner) return;
    rangeIsValid({ from: start, to: end });
    const ticket = context.reset(owner);
    activeTicket = ticket; activeOwner = owner;
    const request = query(collection($firestore, `Companies/${auth.companyId}/SiteOperationSchedules`), where("dateAt", ">=", start), where("dateAt", "<=", end));
    unsubscribe = onSnapshot(request, { includeMetadataChanges: true }, (snapshot) => {
      if (ticket !== context.generation || scope.value !== owner || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      items.value = snapshot.docs.map((document) => createModel(document.data(), ticket));
    }, () => { if (ticket === context.generation) stop(); });
  }, { immediate: true });
  onScopeDispose(stop);
  return { docs: computed(() => items.value), refresh };
}
