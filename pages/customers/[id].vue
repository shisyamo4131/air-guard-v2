<script setup>
import { useRoute } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useCustomerManager } from "@/composables/useCustomerManager.js";
import { Customer, CutoffDate } from "@/schemas";
import { PAYMENT_MONTH_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

/** SETUP */
const route = useRoute();
const docId = route.params.id;
const { doc } = useDocument("Customer", { docId });
const { attrs } = useCustomerManager({ doc });

/** INCLUDED KEYS */
const includedKeys = [
  "code",
  "name",
  { key: "nameKana", display: false },
  { key: "zipcode", display: false },
  { key: "prefCode", display: false },
  { key: "city", display: false },
  { key: "address", display: false },
  { key: "building", display: false },
  { key: "fullAddress", title: "住所", editable: false },
  { key: "tel", title: "電話/FAX" },
  { key: "fax", display: false },
  {
    key: "contractStatus",
    title: "状態",
    editable: false,
    value: (item) => Customer.STATUS[item.contractStatus].title,
  },
];
const includedKeys2 = [
  "cutoffDate",
  { key: "paymentMonth", title: "支払い条件" },
  { key: "paymentDate", display: false },
];
</script>

<template>
  <TemplatesBase fixed label="取引先詳細">
    <v-container class="pa-0" fluid>
      <v-row>
        <v-col cols="12" md="4">
          <air-item-manager
            v-bind="attrs"
            :included-keys="includedKeys"
            hide-delete-btn
          >
            <template #activator="{ attrs: activatorProps, displayItems }">
              <air-card popup color="primary" prepend-icon="mdi-magnify">
                <template #title> 基本情報 </template>
                <template #text>
                  <v-list :items="displayItems">
                    <template #title="{ item }">
                      <span v-if="item.key === 'name'">
                        <div class="text-caption">{{ doc["nameKana"] }}</div>
                        <div>{{ item.title }}</div>
                      </span>
                      <span v-else-if="item.key === 'fullAddress'">
                        <div class="text-caption">
                          {{ `〒${doc["zipcode"]}` }}
                        </div>
                        <div>{{ item.title }}</div>
                        <div class="text-subtitle-2" v-if="doc['building']">
                          {{ doc["building"] }}
                        </div>
                      </span>
                      <span v-else-if="item.key === 'tel'">
                        <div class="d-flex flex-wrap">
                          <div>{{ item.title }}</div>
                          <span class="px-1">/</span>
                          <div>{{ doc["fax"] }}</div>
                        </div>
                      </span>
                      <span v-else>
                        {{ item.title }}
                      </span>
                    </template>
                  </v-list>
                </template>
                <MoleculesCardActionsEdit v-bind="activatorProps" />
              </air-card>
            </template>
          </air-item-manager>
        </v-col>
        <v-col cols="12" md="4">
          <air-item-manager
            v-bind="attrs"
            :included-keys="includedKeys2"
            hide-delete-btn
          >
            <template #activator="{ attrs: activatorProps, displayItems }">
              <air-card popup color="secondary" prepend-icon="mdi-magnify">
                <template #title> 請求・回収条件 </template>
                <template #text>
                  <v-list :items="displayItems">
                    <template #title="{ item }">
                      <span v-if="item.key === 'cutoffDate'">
                        <div>
                          {{
                            `毎月 ${CutoffDate.VALUES[item.title].title} 締め`
                          }}
                        </div>
                      </span>
                      <span v-else-if="item.key === 'paymentMonth'">
                        <div>
                          {{
                            `${PAYMENT_MONTH_VALUES[doc.paymentMonth].title} ${
                              CutoffDate.VALUES[doc.paymentDate].title
                            } 入金`
                          }}
                        </div>
                      </span>
                      <span v-else>
                        {{ item.title }}
                      </span>
                    </template>
                  </v-list>
                </template>
                <MoleculesCardActionsEdit v-bind="activatorProps" />
              </air-card>
            </template>
          </air-item-manager>
        </v-col>
      </v-row>
    </v-container>
  </TemplatesBase>
</template>
