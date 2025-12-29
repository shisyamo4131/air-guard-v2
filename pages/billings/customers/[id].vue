<script setup>
import dayjs from "dayjs";
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useCustomerBilling } from "@/composables/dataLayers/useCustomerBilling";
import { useCustomerBillingManager } from "@/composables/useCustomerBillingManager";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// Router for getting route params
const route = useRoute();
const docId = route.params.id;

// Fetch composables
const fetchCustomerComposable = useFetchCustomer();
const fetchSiteComposable = useFetchSite();

const { doc } = useCustomerBilling({ docId });
const { attrs, cachedCustomers, cachedSites } = useCustomerBillingManager({
  doc,
  fetchCustomerComposable,
  fetchSiteComposable,
});
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-table>
      <tbody>
        <tr>
          <td>取引先</td>
          <td>{{ cachedCustomers[doc.customerId]?.name || "loading..." }}</td>
        </tr>
        <tr>
          <td>現場</td>
          <td>{{ cachedSites[doc.siteId]?.name || "loading..." }}</td>
        </tr>
        <tr>
          <td>請求日</td>
          <td>{{ dayjs(doc.billingDateAt).format("YYYY年MM月DD日(ddd)") }}</td>
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
            <air-item-manager
              v-bind="attrs"
              :included-keys="['paymentDueDateAt']"
              label="入金予定日編集"
            >
              <template #activator="activatorProps">
                {{ dayjs(doc.paymentDueDateAt).format("YYYY年MM月DD日(ddd)") }}
                <v-btn
                  v-bind="activatorProps.attrs"
                  class="ml-2"
                  color="secondary"
                  prepend-icon="mdi-pencil"
                  size="small"
                  text="変更"
                />
              </template>
              <template #input.paymentDueDateAt="inputProps">
                <air-date-input
                  v-bind="inputProps.attrs"
                  :allowed-dates="
                    (date) => {
                      return date.getTime() >= doc.billingDateAt.getTime();
                    }
                  "
                />
              </template>
            </air-item-manager>
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
                    {{ dayjs(operation.dateAt).format("YYYY年MM月DD日(ddd)") }}
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
  </TemplatesFixedHeightContainer>
</template>
