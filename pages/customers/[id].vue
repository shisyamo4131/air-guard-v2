<script setup>
import { useRoute } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useCustomerManager } from "@/composables/useCustomerManager.js";
import { CutoffDate } from "@/schemas";
import {
  CONTRACT_STATUS_VALUES,
  PAYMENT_MONTH_VALUES,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

/** SETUP */
const route = useRoute();
const docId = route.params.id;
const { doc } = useDocument("Customer", { docId });
const { attrs } = useCustomerManager({ doc });
</script>

<template>
  <TemplatesBase fixed>
    <v-row>
      <v-col cols="12">
        <v-card
          :title="doc.name"
          :subtitle="doc.nameKana"
          prepend-icon="mdi-domain"
        >
          <template #append>
            <air-item-manager
              v-bind="attrs"
              :included-keys="['contractStatus']"
              hide-delete-btn
            >
              <template #activator="{ toUpdate }">
                <v-chip
                  class="ml-2"
                  :text="CONTRACT_STATUS_VALUES[doc.contractStatus].title"
                  prepend-icon="mdi-pencil"
                  density="compact"
                  @click="() => toUpdate()"
                />
              </template>
            </air-item-manager>
          </template>
        </v-card>
      </v-col>
      <!-- LEFT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                'code',
                'name',
                'nameKana',
                'tel',
                'fax',
                'remarks',
              ]"
              hide-delete-btn
            >
              <template #activator="{ props: activatorProps }">
                <v-card title="基本情報">
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="doc.name"
                        subtitle="取引先名"
                        prepend-icon="mdi-tag"
                      />
                      <v-list-item
                        :title="doc.code"
                        subtitle="取引先コード"
                        prepend-icon="mdi-tag"
                      />
                      <v-list-item
                        :title="doc.tel"
                        subtitle="電話番号"
                        prepend-icon="mdi-phone"
                      />
                      <v-list-item
                        :title="doc.fax"
                        subtitle="FAX番号"
                        prepend-icon="mdi-fax"
                      />
                    </v-list>
                    <v-card v-if="doc.remarks" :text="doc.remarks" />
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
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

          <!-- 請求・回収条件 -->
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="['cutoffDate', 'paymentMonth', 'paymentDate']"
              hide-delete-btn
            >
              <template #activator="{ props: activatorProps }">
                <v-card title="請求・回収条件" prepend-icon="mdi-calendar">
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="`毎月 ${
                          CutoffDate.VALUES[doc.cutoffDate].title
                        } 締め`"
                        subtitle="締日"
                      />
                      <v-list-item
                        :title="`${
                          PAYMENT_MONTH_VALUES[doc.paymentMonth].title
                        } ${CutoffDate.VALUES[doc.paymentDate].title} 入金`"
                        subtitle="入金サイト"
                      />
                    </v-list>
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
        <v-card title="稼働中現場" prepend-icon="mdi-pickaxe">
          <v-skeleton-loader type="table" />
        </v-card>
      </v-col>

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <air-item-manager v-bind="attrs" hide-delete-btn>
          <template #activator="{ toDelete }">
            <v-btn
              block
              color="error"
              text="この取引先を削除する"
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
  </TemplatesBase>
</template>
