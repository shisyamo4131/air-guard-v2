<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
const auth = useAuthStore();
const selectedItem = ref(null);
</script>

<template>
  <v-container>
    <!-- <air-select :items="auth.company.agreementsV2" item-value="key">
      <template #item="{ item }">
        <v-list-item>
          <v-list-item-title>
            {{ `適用開始日: ${item.raw.date}` }}
            <ShiftTypeChip
              :shift-type="item.raw.shiftType"
              label
              size="x-small"
            />
          </v-list-item-title>
        </v-list-item>
      </template>
    </air-select> -->
    <h4>SELECT</h4>
    <AgreementSelect
      :items="auth.company.agreementsV2"
      item-value="key"
      v-model="selectedItem"
      return-object
    />
    <div>
      {{ selectedItem }}
    </div>
    <h4>LIST ITEM</h4>
    <AgreementListItem
      v-for="agreement in auth.company.agreementsV2"
      :key="agreement.key"
      :agreement="agreement"
    />
  </v-container>
</template>
