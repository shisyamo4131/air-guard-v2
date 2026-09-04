<script setup>
/*****************************************************************************
 * @file ./components/Outsourcers/Manager/index.vue
 * @description 外注先情報管理コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import {
  OUTSOURCER_MUTATIONS,
  evaluateOutsourcerMutation,
} from "@/utils/auth/policies/outsourcerMutationPolicy";

defineOptions({ inheritAttrs: false });

const _props = defineProps({
  docs: { type: Array, default: () => [] },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  search: { type: String, default: null },
  showCreate: { type: Boolean, default: false },
});
const props = useDefaults(_props, "OutsourcersManager");
const emit = defineEmits(["create", "update", "update:search"]);
const auth = useAuthStore();
const createDialog = ref(null);
const editorDialog = ref(null);
const selectedOutsourcer = ref(null);

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

function toCreateIfAllowed() {
  if (!mutationDecision(OUTSOURCER_MUTATIONS.CREATE).allowed) return;
  createDialog.value?.open();
}

async function toUpdateIfAllowed(item) {
  if (!mutationDecision(OUTSOURCER_MUTATIONS.UPDATE).allowed) return;
  selectedOutsourcer.value = item;
  await nextTick();
  editorDialog.value?.open();
}
</script>

<template>
  <div v-bind="$attrs" class="d-flex flex-column flex-grow-1 overflow-hidden">
    <slot
      name="table"
      v-bind="{
        items: props.docs,
        canCreate,
        canUpdate,
        toCreate: toCreateIfAllowed,
        toUpdate: toUpdateIfAllowed,
      }"
    >
      <slot name="toolbar" v-bind="{ canCreate, toCreate: toCreateIfAllowed }">
        <v-toolbar class="ps-3 mb-4">
          <AtomsSearchTextField
            :model-value="props.search"
            :delay="300"
            @update:model-value="emit('update:search', $event)"
          />
          <v-btn
            v-if="canCreate"
            icon="mdi-plus"
            @click="toCreateIfAllowed"
          />
        </v-toolbar>
      </slot>
      <OutsourcersIterator
        class="flex-grow-1"
        grid
        :outsourcers="props.docs"
        :hide-default-footer="props.hideDefaultFooter"
        :items-per-page="props.itemsPerPage"
        :show-create="props.showCreate && canCreate"
        :show-edit="canUpdate"
        @click:create="toCreateIfAllowed"
        @click:edit="toUpdateIfAllowed"
      />
    </slot>

    <OutsourcerCreateDialog ref="createDialog" @created="emit('create', $event)" />
    <OutsourcerEditor
      v-if="selectedOutsourcer"
      ref="editorDialog"
      :outsourcer="selectedOutsourcer"
      @updated="emit('update', $event)"
    />
  </div>
</template>
