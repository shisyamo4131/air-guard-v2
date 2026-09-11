import { computed, ref, shallowRef, watch, onScopeDispose } from "vue";
import { Employee, Certification } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  rawForClass,
  equal,
  CERTIFICATION_FIELDS,
  DATE_FIELDS,
  dateInput,
  parseEmployeeInput,
  buildCertificationPatch,
} from "@/composables/domain/employee/employeeEditContract.js";
import { isEmployeeNormalUxActorAllowed } from "@/utils/auth/policies/employeeActorPolicy.js";

export function useEmployeeCertifications({ employee }) {
  const auth = useAuthStore();
  const opened = ref(false);
  const busy = ref(false);
  const loading = ref(false);
  const message = ref("");
  const baseline = shallowRef(null);
  const draft = ref(null);
  const action = ref("add");
  const position = ref(null);
  let owner = null;
  let draftAtOpen = null;

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
  const rows = computed(() =>
    (baseline.value?.securityCertifications || [])
      .map((row, originalPosition) => ({
        ...rawForClass(row),
        originalPosition,
      }))
      .sort(
        (a, b) =>
          String(a.name || "").localeCompare(String(b.name || "")) ||
          a.originalPosition - b.originalPosition,
      ),
  );

  function verify() {
    if (!canWrite.value || owner !== ownerKey()) {
      throw new Error("permission-denied");
    }
  }

  function clear() {
    baseline.value = null;
    draft.value = null;
    draftAtOpen = null;
    opened.value = false;
    loading.value = false;
  }

  function select(nextAction, originalPosition = null) {
    if (busy.value || !baseline.value) return;
    action.value = nextAction;
    position.value = originalPosition;
    const raw =
      nextAction === "add"
        ? {}
        : baseline.value.securityCertifications[originalPosition];
    draft.value = new Certification(rawForClass(raw)).toObject();
    draftAtOpen = rawForClass(draft.value);
    message.value = "";
  }

  function receive(model) {
    if (!(model instanceof Employee) || model.employmentStatus !== "ACTIVE") {
      throw new Error("invalid-state");
    }
    const raw = rawForClass(model.toObject());
    if (
      raw.securityCertifications !== undefined &&
      !Array.isArray(raw.securityCertifications)
    ) {
      throw new Error("invalid-state");
    }
    baseline.value = raw;
    select("add");
  }

  async function open() {
    if (!canWrite.value || busy.value) return;
    clear();
    owner = ownerKey();
    opened.value = true;
    message.value = "";
    try {
      verify();
      receive(currentEmployee());
    } catch {
      message.value = "資格情報を開けません。現在の従業員情報を確認してください。";
    }
  }

  async function reload() {
    if (busy.value) return;
    loading.value = true;
    try {
      verify();
      receive(currentEmployee());
      message.value = "最新の資格情報を読み直しました。";
    } catch {
      message.value = "最新の資格情報を確認できません。入力を保持しています。";
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
      const changes = {};
      if (action.value !== "remove") {
        for (const field of CERTIFICATION_FIELDS) {
          if (
            action.value === "add" ||
            !equal(draftAtOpen[field], draft.value[field])
          ) {
            changes[field] = DATE_FIELDS.includes(field)
              ? dateInput(draft.value[field])
              : draft.value[field];
          }
        }
      }
      const parsed = parseEmployeeInput("certifications", {
        employeeId: baseline.value.docId,
        action: action.value,
        position: position.value,
        changes,
        expected: {},
      });
      const prepared = buildCertificationPatch(
        baseline.value,
        parsed.changes,
        parsed,
      );
      const candidate = new Employee(
        rawForClass({
          ...baseline.value,
          securityCertifications: prepared.patch.securityCertifications,
        }),
      );
      verify();
      await candidate.update();
      message.value = "資格情報を保存しました。";
      clear();
    } catch {
      message.value = "保存できませんでした。入力内容と現在の従業員情報を確認してください。";
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
    rows,
    canWrite,
    open,
    select,
    reload,
    update,
    save,
    close: () => {
      if (!busy.value) clear();
    },
  };
}
