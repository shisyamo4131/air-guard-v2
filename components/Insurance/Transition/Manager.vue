<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Transition/Manager.vue
 * @description 保険状態遷移コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import dayjs from "dayjs";
import { useBaseManager } from "@/composables/useBaseManager";
import InsuranceMenu from "./Menu/index.vue";
import InputEnroll from "./Input/Enroll.vue";
import InputExempt from "./Input/Exempt.vue";
import InputLoss from "./Input/Loss.vue";
import InputCancel from "./Input/CancelEnrollment.vue";
import InputEnrolled from "./Input/Enrolled.vue";
import InputRollback from "./Input/Rollback.vue";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE MODEL
 *****************************************************************************/
const model = defineModel({ type: Object, required: true });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  title: { type: String, default: "保険情報" },
});
const props = useDefaults(_props, "EmployeeManager");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const selectedAction = ref(""); // 'enroll', 'exempt', 'loss', 'cancel'
const actionMap = computed(() => {
  return {
    enroll: { component: InputEnroll, action: "enroll" },
    enrolled: { component: InputEnrolled, action: "enrolled" },
    exempt: { component: InputExempt, action: "exempt" },
    loss: { component: InputLoss, action: "loss" },
    cancel: { component: InputCancel, action: "cancelEnroll" },
    rollback: { component: InputRollback, action: "rollback" },
  };
});

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const customInput = computed(() => {
  return actionMap.value[selectedAction.value]?.component || null;
});
const transitionAction = computed(() => {
  return actionMap.value[selectedAction.value]?.action || null;
});
const enrollmentDate = computed(() => {
  const formattedDate = model.value.enrollmentDate;
  return formattedDate ? dayjs(formattedDate).format("YYYY/MM/DD") : "-";
});
/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * メニューで選択されたアクションに応じて、selectedAction を更新し、AirItemManager のプロパティ更新関数を呼び出す
 * @param action
 * @param toUpdateFn
 * @returns {Promise<void>}
 */
async function handleMenuClick(action, toUpdateFn) {
  selectedAction.value = action;
  await nextTick();
  toUpdateFn();
}

function handleUpdate(item) {
  if (transitionAction.value && model.value[transitionAction.value]) {
    model.value[transitionAction.value](item);
  }
}
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    v-model="model"
    :dialog-props="{
      maxWidth: 720,
    }"
    hide-delete-btn
    :custom-input="customInput"
    :handle-update="handleUpdate"
    :label="props.title"
  >
    <template #activator="{ toUpdate }">
      <v-card>
        <v-toolbar color="secondary" density="compact" :title="props.title">
          <template #append>
            <InsuranceMenu
              :insurance="model"
              @click:exempt="() => handleMenuClick('exempt', toUpdate)"
              @click:enroll="() => handleMenuClick('enroll', toUpdate)"
              @click:loss="() => handleMenuClick('loss', toUpdate)"
              @click:enrolled="() => handleMenuClick('enrolled', toUpdate)"
              @click:cancel="() => handleMenuClick('cancel', toUpdate)"
              @click:rollback="() => handleMenuClick('rollback', toUpdate)"
            >
              <template #activator="{ props: menuActivator }">
                <slot name="activator" v-bind="{ props: menuActivator }">
                  <v-btn
                    v-bind="menuActivator"
                    icon="mdi-dots-vertical"
                    size="small"
                  />
                </slot>
              </template>
            </InsuranceMenu>
          </template>
        </v-toolbar>
        <v-card-text>
          <air-list class="py-0" fluid>
            <!-- 状態 -->
            <v-list-item>
              <v-list-item-title>状態</v-list-item-title>
              <v-list-item-subtitle>
                <InsuranceStatusChip v-bind="model" size="x-small" />
              </v-list-item-subtitle>
            </v-list-item>

            <!-- 資格取得日 -->
            <v-list-item>
              <v-list-item-title>資格取得日</v-list-item-title>
              <v-list-item-subtitle>
                {{ enrollmentDate }}
              </v-list-item-subtitle>
            </v-list-item>

            <!-- 被保険者番号（整理記号） -->
            <v-list-item>
              <v-list-item-title>被保険者番号（整理記号）</v-list-item-title>
              <v-list-item-subtitle>
                {{ model.number || "-" }}
              </v-list-item-subtitle>
            </v-list-item>
          </air-list>
        </v-card-text>
      </v-card>
    </template>
  </air-item-manager>
</template>
