import { httpsCallable } from "firebase/functions";

export function useSiteFunctions() {
  const { $functions } = useNuxtApp();
  const call = async (name, input) => (await httpsCallable($functions, name)(input)).data;
  return {
    terminateSite: (input) => call("terminateSite", input),
    reactivateSite: (input) => call("reactivateSite", input),
  };
}
