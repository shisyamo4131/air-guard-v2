import { ref, computed, watch, onScopeDispose } from "vue";
import { httpsCallable } from "firebase/functions";
import { useAuthStore } from "@/stores/useAuthStore";
import { isEmployeeArchiveUxActorAllowed, archiveIdentifier } from "@/composables/domain/employee/employeeArchiveContract.js";

// The Callable is a read-only preflight. The actual archive is performed by
// EmployeeManager -> Employee.delete() after this check succeeds.
export function useEmployeeArchive(employeeId, employee) {
  const auth = useAuthStore();
  const { $functions } = useNuxtApp();
  const busy = ref(false);
  const message = ref("");
  let generation = 0;

  const scope = computed(() => auth.isEmailVerified === true && auth.isSuperUserClaimValid === true
    && archiveIdentifier(employeeId.value)
    && isEmployeeArchiveUxActorAllowed({ uid: auth.uid, companyId: auth.companyId, isSuperUser: auth.isSuperUser }, auth.user)
    ? JSON.stringify([auth.companyId, auth.uid, employeeId.value, auth.isSuperUser, auth.user.isAdmin, auth.user.roles])
    : null);
  const canStart = computed(() => !!scope.value && employee.value?.docId === employeeId.value && employee.value?.employmentStatus === "ACTIVE" && !busy.value);
  watch(scope, () => { generation++; busy.value = false; message.value = ""; }, { flush: "sync" });
  onScopeDispose(() => { generation++; });

  async function preflight() {
    if (!canStart.value) return false;
    const owner = scope.value;
    const ticket = ++generation;
    busy.value = true;
    message.value = "";
    try {
      const response = await httpsCallable($functions, "archiveEmployee")({ employeeId: employeeId.value });
      if (owner !== scope.value || ticket !== generation) return false;
      if (response.data?.success !== true || response.data?.allowed !== true) throw new Error("unknown result");
      return true;
    } catch (error) {
      if (owner !== scope.value || ticket !== generation) return false;
      message.value = error.code === "functions/permission-denied"
        ? "アーカイブ権限または会社の利用条件を確認してください。"
        : error.code === "functions/not-found"
          ? "従業員情報が見つかりません。"
          : "従業員のUser連携・退職処理・参照情報を確認してください。";
      return false;
    } finally {
      if (owner === scope.value && ticket === generation) busy.value = false;
    }
  }

  return { busy, message, canStart, preflight };
}
