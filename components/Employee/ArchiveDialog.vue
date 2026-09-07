<script setup>
import { computed } from "vue";
import { useEmployeeArchive } from "@/composables/application/employee/useEmployeeArchive";
const props = defineProps({ employeeId: { type: String, required: true }, employee: { type: Object, default: null } });
const emit = defineEmits(["archived"]);
const archive = useEmployeeArchive(computed(() => props.employeeId), computed(() => props.employee), (id) => emit("archived", id));
</script>
<template>
  <v-btn v-if="archive.canStart.value || archive.canConfirm.value" class="mb-3" color="error" variant="outlined" :disabled="archive.busy.value" :text="archive.canConfirm.value ? '結果を確認' : '従業員をアーカイブ'" @click="archive.open" />
  <v-alert v-if="archive.message.value && !archive.visible.value" type="warning" class="mb-3">{{ archive.message.value }}</v-alert>
  <v-dialog :model-value="archive.visible.value" :persistent="archive.busy.value" scrollable max-width="520" @update:model-value="(value) => { if (!value) archive.close(); }">
    <v-card title="従業員のアーカイブ">
      <v-card-text>
        <p class="mb-3">誤登録・重複登録した従業員を通常業務から除外します。参照がある場合は実行できません。</p>
        <v-textarea label="アーカイブ理由" :model-value="archive.reason.value" :readonly="archive.uncertain.value" :disabled="archive.busy.value" maxlength="200" counter="200" @update:model-value="archive.setReason" />
        <v-alert v-if="archive.message.value" type="warning">{{ archive.message.value }}</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn text="閉じる" :disabled="archive.busy.value" @click="archive.close" />
        <v-spacer />
        <v-btn color="error" :text="archive.uncertain.value ? '同じ操作を確認' : 'アーカイブする'" :loading="archive.busy.value" :disabled="archive.busy.value" @click="archive.submit" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
