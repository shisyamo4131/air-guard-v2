import FireModel from "@shisyamo4131/air-firebase-v2";
import ClientAdapter from "@shisyamo4131/air-firebase-v2-client-adapter";

export default defineNuxtPlugin((app) => {
  console.log("[Plugin] 03.air-firebase.init.js is running");
  console.log("[Plugin] FireModel:", FireModel);
  console.log("[Plugin] ClientAdapter:", ClientAdapter);

  const adapter = new ClientAdapter();
  console.log("[Plugin] Adapter instance:", adapter);

  FireModel.setAdapter(adapter);
  console.log("[Plugin] Adapter set successfully");

  // 正しい確認方法
  try {
    const retrievedAdapter = FireModel.getAdapter();
    console.log("[Plugin] FireModel.getAdapter():", retrievedAdapter);
    console.log("[Plugin] Adapter type:", FireModel.type);
  } catch (error) {
    console.error("[Plugin] Failed to get adapter:", error);
  }
});
