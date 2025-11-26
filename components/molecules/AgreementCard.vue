<script setup>
/**
 * AgreementCard.vue
 * @description AgreementCard component to display agreement details.
 * @version 1.0.0
 * @author shisyamo4131
 */
import dayjs from "dayjs";
import { formatCurrency } from "@/utils/formats/util";

/** SETUP PROPS */
const props = defineProps({
  agreement: { type: Object, required: true },
});

/** COMPUTED PROPERTIES */
const dateLabel = computed(() => {
  return dayjs(props.agreement.dateAt).format("YYYY年MM月DD日(ddd)");
});
</script>

<template>
  <v-card>
    <v-card-title class="text-subtitle-1">{{ dateLabel }}</v-card-title>
    <v-card-text>
      <div class="d-flex flex-wrap" style="gap: 4px">
        <AtomsDayTypeChip :day-type="props.agreement.dayType" />
        <AtomsShiftTypeChip :shift-type="props.agreement.shiftType" />
        <AtomsBillingUnitTypeChip
          :billing-unit-type="props.agreement.billingUnitType"
        />
      </div>
      <div class="mt-2 d-flex flex-wrap">
        <AtomsQualifiedTypeChip class="mr-2" type="BASE" />
        <div>
          {{ formatCurrency(props.agreement.unitPriceBase) }} /
          {{ formatCurrency(props.agreement.overtimeUnitPriceBase) }}
        </div>
      </div>
      <div class="mt-2 d-flex flex-wrap">
        <AtomsQualifiedTypeChip class="mr-2" type="QUALIFIED" />
        <div>
          {{ formatCurrency(props.agreement.unitPriceQualified) }} /
          {{ formatCurrency(props.agreement.overtimeUnitPriceQualified) }}
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>
