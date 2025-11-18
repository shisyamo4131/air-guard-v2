import FireModel from "@shisyamo4131/air-firebase-v2";
import ClientAdapter from "@shisyamo4131/air-firebase-v2-client-adapter";

export default defineNuxtPlugin((app) => {
  const adapter = new ClientAdapter();
  FireModel.setAdapter(adapter);
});
