<script setup>
/*****************************************************************************
 * @file ./components/Outsourcers/Manager/index.vue
 * @description 外注先情報管理コンポーネント
 * @author shisyamo4131
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Outsourcer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import {
  OUTSOURCER_MUTATIONS,
  evaluateOutsourcerMutation,
} from "@/utils/auth/policies/outsourcerMutationPolicy";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  handleCreate: { type: Function, default: (item) => item.create(item) },
  handleUpdate: { type: Function, default: (item) => item.update(item) },
  handleDelete: { type: Function, default: (item) => item.delete(item) },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  search: { type: String, default: null },
  showCreate: { type: Boolean, default: false },
});
const props = useDefaults(_props, "OutsourcersManager");
const emit = defineEmits(["update:search"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const { attrs } = useBaseManager("OutsourcersManager");

/*****************************************************************************
 * AUTHORIZATION
 *****************************************************************************/
function mutationDecision(operation) {
  return evaluateOutsourcerMutation({
    operation,
    uid: auth.uid,
    companyId: auth.companyId,
    isSuperUser: auth.isSuperUser,
    isSuperUserClaimValid: auth.isSuperUserClaimValid,
    actorUser: auth.user,
  });
}

const canCreate = computed(
  () => mutationDecision(OUTSOURCER_MUTATIONS.CREATE).allowed,
);
const canUpdate = computed(
  () => mutationDecision(OUTSOURCER_MUTATIONS.UPDATE).allowed,
);

function assertMutationAllowed(operation) {
  const decision = mutationDecision(operation);
  if (!decision.allowed) throw new Error(decision.message);
}

async function handleCreate(item) {
  assertMutationAllowed(OUTSOURCER_MUTATIONS.CREATE);
  return await props.handleCreate(item);
}

async function handleUpdate(item) {
  assertMutationAllowed(OUTSOURCER_MUTATIONS.UPDATE);
  return await props.handleUpdate(item);
}

async function handleDelete() {
  throw new Error("外注先の削除は現在利用できません。");
}

function toCreateIfAllowed(toCreate) {
  if (!mutationDecision(OUTSOURCER_MUTATIONS.CREATE).allowed) return;
  toCreate();
}

function toUpdateIfAllowed(toUpdate, item) {
  if (!mutationDecision(OUTSOURCER_MUTATIONS.UPDATE).allowed) return;
  toUpdate(item);
}
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="docs"
    :schema="Outsourcer"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    :disable-delete="true"
    :disable-update="!canUpdate"
    :hide-create-btn="!canCreate"
    hide-delete-btn
  >
    <template #table="slotProps">
      <slot
        name="table"
        v-bind="{
          ...slotProps,
          canCreate,
          canUpdate,
          toCreate: () => toCreateIfAllowed(slotProps.toCreate),
          toUpdate: (item) => toUpdateIfAllowed(slotProps.toUpdate, item),
        }"
      >
        <v-toolbar class="ps-3 mb-4">
          <AtomsSearchTextField
            :model-value="props.search"
            :delay="300"
            @update:model-value="emit('update:search', $event)"
          />
          <v-btn
            v-if="canCreate"
            icon="mdi-plus"
            @click="() => toCreateIfAllowed(slotProps.toCreate)"
          />
        </v-toolbar>
        <OutsourcersIterator
          class="flex-grow-1"
          grid
          :outsourcers="slotProps.items"
          :hide-default-footer="props.hideDefaultFooter"
          :items-per-page="props.itemsPerPage"
          :show-create="props.showCreate && canCreate"
          :show-edit="canUpdate"
          @click:create="() => toCreateIfAllowed(slotProps.toCreate)"
          @click:edit="(item) => toUpdateIfAllowed(slotProps.toUpdate, item)"
        />
      </slot>
    </template>
  </air-array-manager>
</template>
