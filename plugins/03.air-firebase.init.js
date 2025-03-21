import FireModel from "../air-firebase-v2/fire-model/src/FireModel";
import ClientAdapter from "../air-firebase-v2/client-adapter/src/ClientAdapter";

export default defineNuxtPlugin((app) => {
  console.log("adapter set on:", FireModel);
  FireModel.setAdapter(new ClientAdapter());
});
