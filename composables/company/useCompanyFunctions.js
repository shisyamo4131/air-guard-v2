import { httpsCallable } from "firebase/functions";

export function useCompanyFunctions() {
  const { $functions } = useNuxtApp();

  async function updateCompanyProfile(changes) {
    const callable = httpsCallable($functions, "updateCompanyProfile");
    const result = await callable({ changes });
    return result.data;
  }

  async function updateCompanyBilling(changes) {
    const callable = httpsCallable($functions, "updateCompanyBilling");
    const result = await callable({ changes });
    return result.data;
  }

  return { updateCompanyBilling, updateCompanyProfile };
}
