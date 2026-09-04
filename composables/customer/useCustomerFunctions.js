import { httpsCallable } from "firebase/functions";

export function useCustomerFunctions() {
  const { $functions } = useNuxtApp();

  async function archiveCustomer(data) {
    const callable = httpsCallable($functions, "archiveCustomer");
    const result = await callable(data);
    return result.data;
  }

  return { archiveCustomer };
}
