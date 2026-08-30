/*****************************************************************************
 * @file ./composables/application/company/useCompanyBillingUpdate.js
 * @description Company振込先editorのapplication処理です。
 *****************************************************************************/
import { Company } from "@/schemas";
import { useCompanyFunctions } from "@/composables/company/useCompanyFunctions";

function changedBillingFields(baseline, draft) {
  return Company.billingFields.filter(
    (field) => !Object.is(baseline[field] ?? null, draft[field] ?? null),
  );
}

export function useCompanyBillingUpdate() {
  const { updateCompanyBilling: callUpdateCompanyBilling } =
    useCompanyFunctions();

  async function updateCompanyBilling({
    latest,
    baseline,
    draft,
    clearIntent = false,
  }) {
    const baselineValue = Company.getBillingDraftValue(baseline);
    const draftValue = Company.getBillingValue(draft);
    const fields = clearIntent
      ? [...Company.billingFields]
      : changedBillingFields(baselineValue, draftValue);
    if (fields.length === 0) {
      return { success: true, updated: false, updatedFields: [] };
    }

    const candidate = Company.normalizeBilling({
      invoiceNumber: latest.invoiceNumber ?? null,
      ...Company.getBillingValue(latest),
      ...Object.fromEntries(fields.map((field) => [field, draftValue[field]])),
    });
    const changes = Object.fromEntries(
      fields.map((field) => [field, candidate[field]]),
    );

    return callUpdateCompanyBilling(changes);
  }

  return { updateCompanyBilling };
}
