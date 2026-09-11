import { computed, ref, shallowRef, watch, onScopeDispose } from "vue";
import { Employee, Insurance } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  rawForClass,
  encodeExpected,
  dateInput,
} from "@/composables/domain/shared/valueContract.js";
import {
  insuranceVersions,
  insuranceForOperation,
  INSURANCE_ACTION_FIELDS,
  parseEmployeeInsuranceInput,
  prepareEmployeeInsurance,
} from "@/composables/domain/employee/employeeInsuranceContract.js";
import { isEmployeeNormalUxActorAllowed } from "@/utils/auth/policies/employeeActorPolicy.js";

export function useEmployeeInsurance({ employee, kind }) {
  const auth = useAuthStore();
  const opened = ref(false);
  const busy = ref(false);
  const loading = ref(false);
  const message = ref("");
  const baseline = shallowRef(null);
  const draft = ref(null);
  const action = ref(null);
  let owner = null;

  const currentEmployee = () =>
    typeof employee === "function" ? employee() : employee;
  const identity = () => ({
    uid: auth.uid,
    companyId: auth.companyId,
    actorUser: auth.user,
  });
  const ownerKey = () => `${auth.companyId}/${auth.uid}`;
  const canWrite = computed(
    () =>
      auth.isEmailVerified === true &&
      auth.isSuperUserClaimValid === true &&
      isEmployeeNormalUxActorAllowed(identity()),
  );

  function verify() {
    if (!canWrite.value || owner !== ownerKey()) {
      throw new Error("permission-denied");
    }
  }

  function clear() {
    baseline.value = null;
    draft.value = null;
    opened.value = false;
    loading.value = false;
  }

  function receive(model) {
    if (!(model instanceof Employee) || model.employmentStatus !== "ACTIVE") {
      throw new Error("invalid-state");
    }
    const raw = rawForClass(model.toObject());
    const current = insuranceForOperation(raw, kind);
    insuranceVersions(raw);
    baseline.value = raw;
    draft.value = new Insurance(rawForClass(current)).toObject();
  }

  async function open(nextAction) {
    if (
      !canWrite.value ||
      busy.value ||
      !Object.hasOwn(INSURANCE_ACTION_FIELDS, nextAction)
    ) {
      return;
    }
    clear();
    owner = ownerKey();
    action.value = nextAction;
    opened.value = true;
    message.value = "";
    try {
      verify();
      receive(currentEmployee());
    } catch {
      message.value = "保険情報を開けません。現在の従業員情報を確認してください。";
    }
  }

  async function reload() {
    if (busy.value) return;
    loading.value = true;
    try {
      verify();
      receive(currentEmployee());
      message.value = "最新の保険情報を読み直しました。";
    } catch {
      message.value = "最新の保険情報を確認できません。入力を保持しています。";
    } finally {
      loading.value = false;
    }
  }

  function update(changes) {
    if (draft.value && !busy.value && !loading.value) {
      Object.assign(draft.value, changes);
    }
  }

  async function save() {
    if (busy.value || loading.value || !draft.value) return;
    verify();
    busy.value = true;
    message.value = "";
    try {
      const changes = Object.fromEntries(
        INSURANCE_ACTION_FIELDS[action.value].map((field) => [
          field,
          ["enrollmentDateAt", "lossDateAt"].includes(field)
            ? dateInput(draft.value[field])
            : draft.value[field],
        ]),
      );
      const input = parseEmployeeInsuranceInput({
        employeeId: baseline.value.docId,
        kind,
        action: action.value,
        changes,
        expected: {
          map: encodeExpected(baseline.value[kind]),
          version: insuranceVersions(baseline.value)[kind],
        },
      });
      const prepared = prepareEmployeeInsurance(baseline.value, input);
      const candidate = new Employee(
        rawForClass({
          ...baseline.value,
          [kind]: prepared.nextMap,
          insuranceOperationVersions: prepared.versions,
        }),
      );
      verify();
      await candidate.update();
      message.value = "保険情報を保存しました。";
      clear();
    } catch {
      message.value = "保存できませんでした。現在の状態と入力内容を確認してください。";
    } finally {
      busy.value = false;
    }
  }

  watch(
    () => [canWrite.value, auth.companyId, auth.uid],
    () => {
      if (opened.value && (!canWrite.value || owner !== ownerKey())) clear();
    },
  );
  onScopeDispose(clear);

  return {
    opened,
    busy,
    loading,
    message,
    draft,
    action,
    canWrite,
    open,
    reload,
    update,
    save,
    close: () => {
      if (!busy.value) clear();
    },
  };
}
