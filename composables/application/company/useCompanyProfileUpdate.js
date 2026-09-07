/*****************************************************************************
 * @file ./composables/application/company/useCompanyProfileUpdate.js
 * @description Company基本情報editorのapplication処理です。
 *****************************************************************************/
import { Company } from "@/schemas";
import { useCompanyFunctions } from "@/composables/company/useCompanyFunctions";

function changedProfileFields(baseline, draft) {
  return Company.profileFields.filter(
    (field) => !Object.is(baseline[field] ?? null, draft[field] ?? null),
  );
}

export function useCompanyProfileUpdate() {
  const { updateCompanyProfile: callUpdateCompanyProfile } =
    useCompanyFunctions();

  async function updateCompanyProfile({ latest, baseline, draft }) {
    const baselineValue = Company.getProfileValue(baseline);
    const draftValue = Company.getProfileValue(draft);
    const fields = changedProfileFields(baselineValue, draftValue);
    if (fields.length === 0) {
      return { success: true, updated: false, updatedFields: [] };
    }

    const candidate = Company.normalizeProfile({
      ...Company.getProfileValue(latest),
      ...Object.fromEntries(fields.map((field) => [field, draftValue[field]])),
    });
    const changes = Object.fromEntries(
      fields.map((field) => [field, candidate[field]]),
    );

    return callUpdateCompanyProfile(changes);
  }

  return { updateCompanyProfile };
}
