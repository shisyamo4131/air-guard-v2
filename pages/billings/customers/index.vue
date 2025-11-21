<script setup>
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange.js";
import { useCustomerBillingsManager } from "@/composables/useCustomerBillingsManager.js";

defineOptions({ name: "billings-customers" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
// Date Range
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

// Manager
const { attrs, cachedCustomers } = useCustomerBillingsManager({
  dateRangeComposable,
  useDebounced: true,
  immediate: true,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-array-manager class="fill-height" v-bind="attrs">
      <template #search>
        <MoleculesMonthSelector
          :model-value="dateRange.from"
          @date-range="dateRange = $event"
        />
      </template>
      <template
        v-slot:group-header="{ item, columns, toggleGroup, isGroupOpen }"
      >
        <tr>
          <td
            :colspan="columns.length"
            class="cursor-pointer"
            v-ripple
            @click="toggleGroup(item)"
          >
            <div class="d-flex align-center">
              <v-btn
                :icon="isGroupOpen(item) ? '$expand' : '$next'"
                color="medium-emphasis"
                density="comfortable"
                size="small"
                variant="outlined"
              ></v-btn>

              <span class="ms-4">{{ item.value }}</span>
            </div>
          </td>
        </tr>
      </template>
      <template #item.customerId="{ item }">
        <div v-if="cachedCustomers[item.customerId]">
          <div>{{ cachedCustomers[item.customerId].name }}</div>
        </div>
        <v-progress-circular v-else indeterminate size="small" />
      </template>
    </air-array-manager>
  </TemplatesFixedHeightContainer>
</template>
