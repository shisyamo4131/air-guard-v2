/*****************************************************************************
 * @file ./composables/application/company/useCompanyOperationsUpdate.js
 * @description Company通常設定editorのapplication処理です。
 *****************************************************************************/
import { Company } from "@/schemas";
import { useCompanyFunctions } from "@/composables/company/useCompanyFunctions";

function changedOperationsFields(baseline, draft) {
  return Company.operationsFields.filter(
    (field) => !Object.is(baseline[field] ?? null, draft[field] ?? null),
  );
}

export function useCompanyOperationsUpdate() {
  const { updateCompanyOperations: callUpdateCompanyOperations } =
    useCompanyFunctions();

  async function updateCompanyOperations({ latest, baseline, draft }) {
    const baselineValue = Company.getOperationsValue(baseline);
    const draftValue = Company.getOperationsValue(draft);
    const fields = changedOperationsFields(baselineValue, draftValue);
    if (fields.length === 0) {
      return { success: true, updated: false, updatedFields: [] };
    }

    const candidate = Company.normalizeOperations({
      ...Company.getOperationsValue(latest),
      ...Object.fromEntries(fields.map((field) => [field, draftValue[field]])),
    });
    const changes = Object.fromEntries(
      fields.map((field) => [field, candidate[field]]),
    );

    return callUpdateCompanyOperations(changes);
  }

  return { updateCompanyOperations };
}
