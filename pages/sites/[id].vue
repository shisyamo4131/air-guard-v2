<script setup>
import dayjs from "dayjs";
import { useRoute } from "vue-router";
import { useDateRange } from "@/composables/useDateRange";
import { useSite } from "@/composables/dataLayers/useSite";
import { useSiteManager } from "@/composables/useSiteManager";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";
import { useAgreementsManager } from "@/composables/useAgreementsManager";
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";

/*****************************************************************************
 * ROUTER
 *****************************************************************************/
const route = useRoute();
const siteId = route.params.id;

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { searchCustomers, getCustomer } = useFetchCustomer();

/** Date Range */
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange } = dateRangeComposable;

/** data layer composable */
const { doc, schedules } = useSite({
  docId: siteId,
  dateRangeComposable,
  useDebounced: true,
});

/** Site Manager */
const { attrs, info } = useSiteManager({ doc });

/** Site Operation Schedules Manager */
const schedulesManager = useSiteOperationSchedulesManager({
  docs: schedules,
  siteId,
});

/** Agreements Manager */
const agreementsManager = useAgreementsManager(doc, { useDefault: true });
</script>

<template>
  <TemplatesDetail :label="doc.name" fixed>
    <v-row>
      <v-col cols="12" md="4">
        <air-item-manager
          v-bind="attrs"
          :input-props="{
            excludedKeys: ['agreements'],
          }"
        >
          <template #activator="{ attrs: activatorProps }">
            <air-information-card v-bind="activatorProps" :items="info.base" />
          </template>
          <template #input.customer="inputProps">
            <air-autocomplete-api
              v-bind="inputProps.attrs"
              :api="searchCustomers"
              clearable
              :disabled="inputProps.editMode !== 'CREATE'"
              :fetchItemByKeyApi="getCustomer"
              item-title="name"
              item-value="docId"
              required
            />
          </template>
        </air-item-manager>
      </v-col>
      <v-col cols="12" md="8">
        <air-array-manager v-bind="schedulesManager.attrs.value">
          <template #table="{ toCreate, toUpdate }">
            <v-card>
              <v-toolbar density="comfortable">
                <v-toolbar-title>稼働予定</v-toolbar-title>
                <v-spacer />
                <v-btn icon="mdi-plus" @click="toCreate()" />
              </v-toolbar>
              <v-card-text>
                <v-container class="pt-0">
                  <MoleculesMonthSelector
                    :model-value="dateRange.from"
                    @date-range="dateRange = $event"
                  />
                </v-container>
                <air-calendar
                  style="min-height: 520px"
                  :model-value="dateRange.from"
                  :events="schedulesManager.events.value"
                  @click:event="
                    (nativeEvent, { event }) => {
                      toUpdate(event.item);
                    }
                  "
                />
              </v-card-text>
            </v-card>
          </template>
          <template #input.shiftType="{ attrs }">
            <v-radio-group v-bind="attrs" inline>
              <v-radio label="日勤" value="DAY" />
              <v-radio label="夜勤" value="NIGHT" />
            </v-radio-group>
          </template>
          <template #input.isStartNextDay="{ attrs }">
            <MoleculesInputsIsStartNextDay v-bind="attrs" />
          </template>
        </air-array-manager>
      </v-col>
      <v-col>
        <v-card>
          <OrganismsAgreementsManager v-bind="agreementsManager.attrs.value" />
        </v-card>
      </v-col>
    </v-row>
  </TemplatesDetail>
</template>
