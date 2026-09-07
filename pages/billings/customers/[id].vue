<script setup>
import dayjs from "dayjs";
import { computed, watch } from "vue";
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useCustomerBilling } from "@/composables/dataLayers/useCustomerBilling";
import PaymentDateEditor from "@/components/CustomerBilling/PaymentDateEditor.vue";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// Router for getting route params
const route = useRoute();
definePageMeta({ key: (route) => route.fullPath });
const docId = computed(() => typeof route.params.id === "string" ? route.params.id : "");

// Fetch composables
const fetchCustomerComposable = useFetchCustomer();
const fetchSiteComposable = useFetchSite();

const { doc } = useCustomerBilling({ docId: docId.value });
const { cachedCustomers, fetchCustomer } = fetchCustomerComposable;
const { cachedSites, fetchSite } = fetchSiteComposable;
watch(() => [doc.customerId, doc.siteId], ([customerId, siteId]) => { fetchCustomer(customerId); fetchSite(siteId); }, { immediate: true });
</script>

<template>
  <v-container>
    <v-table>
      <tbody>
        <tr>
          <td>取引先</td>
          <td>{{ cachedCustomers[doc.customerId]?.name || "loading..." }}</td>
        </tr>
        <tr>
          <td>現場</td>
          <td>{{ cachedSites[doc.siteId]?.displayName || "loading..." }}</td>
        </tr>
        <tr>
          <td>請求日</td>
          <td>{{ dayjs(doc.billingDateAt).tz().format("YYYY年MM月DD日(ddd)") }}</td>
        </tr>
        <tr>
          <td>売上金額</td>
          <td>{{ doc.subtotal.toLocaleString() }}</td>
        </tr>
        <tr>
          <td>消費税額</td>
          <td>{{ doc.taxAmount.toLocaleString() }}</td>
        </tr>
        <tr>
          <td>請求額</td>
          <td>{{ doc.totalAmount.toLocaleString() || "loading..." }}</td>
        </tr>
        <tr>
          <td>入金予定日</td>
          <td>
            {{ doc.paymentDueDateAt ? dayjs(doc.paymentDueDateAt).tz().format("YYYY年MM月DD日(ddd)") : '未設定' }}
            <PaymentDateEditor :document-id="docId" />
          </td>
        </tr>
        <tr>
          <td>稼働実績</td>
          <td>
            <v-table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>通常</th>
                  <th>資格者</th>
                  <th>売上</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(operation, index) of doc.operationResults"
                  :key="index"
                >
                  <td>
                    {{ dayjs(operation.dateAt).tz().format("YYYY年MM月DD日(ddd)") }}
                  </td>
                  <td>
                    {{ operation.statistics.base.quantity.toLocaleString() }}
                  </td>
                  <td>
                    {{
                      operation.statistics.qualified.quantity.toLocaleString()
                    }}
                  </td>
                  <td>{{ operation.salesAmount.toLocaleString() }}</td>
                </tr>
              </tbody>
            </v-table>
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
