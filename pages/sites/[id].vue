<script setup>
import dayjs from "dayjs";
import { useRoute } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useDateRange } from "@/composables/useDateRange";
import { useSiteManager } from "@/composables/useSiteManager";
import { useSiteOperationSchedulesManager } from "@/composables/useSiteOperationSchedulesManager";
import { useAgreementsManager } from "@/composables/useAgreementsManager";

/*****************************************************************************
 * ROUTER
 *****************************************************************************/
const route = useRoute();
const docId = route.params.id;

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { doc } = useDocument("Site", { docId });
const { attrs } = useSiteManager({ doc });

/** Date Range */
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange, debouncedDateRange } = dateRangeComposable;

/** Site Operation Schedules */
const options = computed(() => {
  return [
    ["where", "siteId", "==", docId],
    ["where", "dateAt", ">=", debouncedDateRange.value.from],
    ["where", "dateAt", "<=", debouncedDateRange.value.to],
  ];
});
const { docs: schedules } = useDocuments("SiteOperationSchedule", {
  options,
  fetchAllOnEmpty: true,
});

/** Site Operation Schedules Manager */
const schedulesManager = useSiteOperationSchedulesManager({
  docs: schedules,
  docId,
});

/** Agreements Manager */
const agreementsManager = useAgreementsManager(doc, { useDefault: true });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-row>
      <!-- LEFT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              hide-delete-btn
              :included-keys="['code', 'name', 'nameKana', 'remarks', 'status']"
            >
              <template #activator="{ props: activatorProps, displayItems }">
                <v-card
                  :title="doc.name"
                  :subtitle="doc.nameKana"
                  prepend-icon="mdi-pickaxe"
                >
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="doc.code"
                        subtitle="現場コード"
                        prepend-icon="mdi-tag"
                      />
                      <v-list-item
                        :title="doc.name"
                        subtitle="現場名"
                        prepend-icon="mdi-tag"
                      />
                    </v-list>
                    <v-card v-if="doc.remarks" :text="doc.remarks" />
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
              <template #input.customerId="inputProps">
                <MoleculesAutocompleteCustomer v-bind="inputProps.attrs" />
              </template>
            </air-item-manager>
          </v-col>

          <!-- 所在地 -->
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                'zipcode',
                'prefCode',
                'city',
                'address',
                'building',
              ]"
              hide-delete-btn
            >
              <template #activator="{ props: activatorProps }">
                <v-card
                  :title="`${doc.city}${doc.address}`"
                  :subtitle="`${doc.zipcode} ${doc.fullAddress} ${
                    doc.building || ''
                  }`"
                >
                  <template #prepend>
                    <v-icon color="red" icon="mdi-map-marker" />
                  </template>
                  <template #text>
                    <v-skeleton-loader type="image" />
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
            </air-item-manager>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" md="8">
        <v-row>
          <!-- 稼働予定 -->
          <v-col cols="12">
            <air-array-manager v-bind="schedulesManager.attrs.value">
              <template #table="{ toCreate, toUpdate }">
                <v-card>
                  <template #prepend>
                    <v-icon icon="mdi-calendar" />
                  </template>
                  <template #title>稼働予定</template>
                  <template #append>
                    <v-btn icon="mdi-plus" @click="toCreate()" />
                  </template>
                  <template #text>
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
                  </template>
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
        </v-row>
      </v-col>

      <!-- 取極め情報 -->
      <v-col cols="12">
        <OrganismsAgreementsManager v-bind="agreementsManager.attrs.value">
          <template #table="tableProps">
            <v-card prepend-icon="mdi-file-document-multiple-outline">
              <template #append>
                <v-icon icon="mdi-plus" @click="() => tableProps.toCreate()" />
              </template>
              <template #title>取極め</template>
              <air-data-table v-bind="tableProps" />
            </v-card>
          </template>
        </OrganismsAgreementsManager>
      </v-col>

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <air-item-manager v-bind="attrs" hide-delete-btn>
          <template #activator="{ toDelete }">
            <v-btn
              block
              color="error"
              text="この現場を削除する"
              @click="() => toDelete()"
            />
          </template>
          <template #editor="{ actions: editorActions }">
            <v-card>
              <template #prepend>
                <v-icon icon="mdi-alert" color="error" />
              </template>
              <template #title> 削除処理 </template>
              <template #text>
                削除すると復元することはできません。本当に削除しますか？
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  v-bind="editorActions"
                  submitText="実行"
                  color="error"
                />
              </template>
            </v-card>
          </template>
        </air-item-manager>
      </v-col>
    </v-row>
  </TemplatesFixedHeightContainer>
</template>
