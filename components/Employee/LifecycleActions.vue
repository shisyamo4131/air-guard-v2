<script setup>
/*****************************************************************************
 * @file ./components/Employee/LifecycleActions.vue
 * @description UWB-07の退職・誤退職訂正UIです。
 *****************************************************************************/
import { useAuthStore } from "@/stores/useAuthStore";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useLogger } from "@/composables/useLogger";
import { useUserLifecycleOperations } from "@/composables/application/user/useUserLifecycleOperations";
import {
  canReinstateEmployee,
  canTerminateEmployee,
} from "@/utils/auth/policies/userLifecycleUiPolicy";

const props = defineProps({
  employee: { type: Object, required: true },
  linkedUser: { type: Object, default: null },
});

const auth = useAuthStore();
const errors = useErrorsStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const logger = useLogger("EmployeeLifecycleActions", errors);
const { isPending, loadReinstatementContext, reinstate, retire } =
  useUserLifecycleOperations();

const retirementDialog = ref(false);
const reinstatementDialog = ref(false);
const retirementForm = ref(null);
const retirement = reactive({ terminationDate: "", reasonOfTermination: "" });
const reinstatementContext = ref(null);

function currentJstDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const todayJst = currentJstDate();
const mayRetire = computed(() =>
  canTerminateEmployee({
    companyId: auth.companyId,
    actorUid: auth.uid,
    actorUser: auth.user,
    employee: props.employee,
    linkedUser: props.linkedUser,
  }),
);
const mayReinstate = computed(() =>
  canReinstateEmployee({
    companyId: auth.companyId,
    actorUid: auth.uid,
    actorUser: auth.user,
    employee: props.employee,
  }),
);
const retirementPending = computed(() =>
  isPending("retire-employee", props.employee.docId),
);
const contextPending = computed(() =>
  isPending("load-reinstatement-context", props.employee.docId),
);
const reinstatementPending = computed(() =>
  isPending("reinstate-employee", props.employee.docId),
);
const reasonRules = [
  (value) =>
    (typeof value === "string" && value.length > 0) || "理由は必須です。",
  (value) => value?.trim() === value || "理由の前後に空白は使用できません。",
  (value) => value?.length <= 20 || "理由は20文字以内で入力してください。",
];

function openRetirementDialog() {
  if (!mayRetire.value) return;
  retirement.terminationDate = todayJst;
  retirement.reasonOfTermination = "";
  retirementDialog.value = true;
}

async function handleRetirement() {
  if (!mayRetire.value || retirementPending.value) return;
  const validation = await retirementForm.value?.validate();
  if (!validation?.valid) return;
  const loadingKey = loadings.add("退職処理を実行しています...");
  try {
    await retire({
      employeeId: props.employee.docId,
      terminationDate: retirement.terminationDate,
      reasonOfTermination: retirement.reasonOfTermination,
    });
    retirementDialog.value = false;
    messages.add("退職処理が完了しました。");
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(loadingKey);
  }
}

async function openReinstatementDialog() {
  if (!mayReinstate.value || contextPending.value) return;
  const loadingKey = loadings.add("退職履歴を確認しています...");
  try {
    reinstatementContext.value = await loadReinstatementContext(
      props.employee.docId,
    );
    reinstatementDialog.value = true;
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(loadingKey);
  }
}

async function handleReinstatement() {
  if (
    !mayReinstate.value ||
    reinstatementPending.value ||
    !reinstatementContext.value?.reversesOperationId
  ) {
    return;
  }
  const loadingKey = loadings.add("誤退職を訂正しています...");
  try {
    const result = await reinstate({
      employeeId: props.employee.docId,
      reversesOperationId: reinstatementContext.value.reversesOperationId,
    });
    reinstatementDialog.value = false;
    reinstatementContext.value = null;
    messages.add(
      result.requiresUserReprovisioning
        ? "在職状態へ戻しました。Userは必要に応じて再登録してください。"
        : "在職状態へ戻しました。",
    );
  } catch (error) {
    logger.error({ error });
  } finally {
    loadings.remove(loadingKey);
  }
}
</script>

<template>
  <v-btn
    v-if="mayRetire"
    block
    color="warning"
    text="退職処理"
    variant="flat"
    @click="openRetirementDialog"
  />
  <v-btn
    v-if="mayReinstate"
    block
    color="warning"
    :loading="contextPending"
    text="誤退職を訂正する"
    variant="outlined"
    @click="openReinstatementDialog"
  />

  <v-dialog v-model="retirementDialog" max-width="520" persistent>
    <v-card>
      <v-toolbar color="warning" density="compact" title="退職処理" />
      <v-card-text>
        <v-form ref="retirementForm" @submit.prevent="handleRetirement">
          <v-text-field
            v-model="retirement.terminationDate"
            label="退職日"
            type="date"
            :max="todayJst"
            :rules="[
              (value) => !!value || '退職日は必須です。',
              (value) => value <= todayJst || '未来日は指定できません。',
            ]"
          />
          <v-text-field
            v-model="retirement.reasonOfTermination"
            label="退職理由"
            maxlength="20"
            :rules="reasonRules"
          />
        </v-form>
        <v-alert type="warning" density="compact">
          Employeeは退職状態で保持されます。紐づく本登録Userがある場合、UserとAuthは物理削除されます。
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="retirementPending"
          text="キャンセル"
          @click="retirementDialog = false"
        />
        <v-btn
          color="warning"
          :disabled="retirementPending"
          :loading="retirementPending"
          text="退職処理を実行"
          @click="handleRetirement"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="reinstatementDialog" max-width="520" persistent>
    <v-card>
      <v-toolbar color="warning" density="compact" title="誤退職の訂正" />
      <v-card-text>
        <p>このEmployeeを在職状態へ戻します。</p>
        <v-alert type="warning" density="compact" class="mt-4">
          退職時に削除されたUserとAuthは復元されません。必要な場合は訂正後にUserを再登録してください。
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="reinstatementPending"
          text="キャンセル"
          @click="reinstatementDialog = false"
        />
        <v-btn
          color="warning"
          :disabled="reinstatementPending"
          :loading="reinstatementPending"
          text="在職状態へ戻す"
          @click="handleReinstatement"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
