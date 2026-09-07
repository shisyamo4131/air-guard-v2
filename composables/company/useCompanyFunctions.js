import { httpsCallable } from "firebase/functions";

export function useCompanyFunctions() {
  const { $functions } = useNuxtApp();

  async function updateCompanyArrangement(field, order) {
    const callable = httpsCallable($functions, "updateCompanyArrangement");
    const result = await callable({ field, order });
    return result.data;
  }

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

  async function updateCompanyOperations(changes) {
    const callable = httpsCallable($functions, "updateCompanyOperations");
    const result = await callable({ changes });
    return result.data;
  }

  return {
    updateCompanyArrangement,
    updateCompanyBilling,
    updateCompanyOperations,
    updateCompanyProfile,
  };
}
