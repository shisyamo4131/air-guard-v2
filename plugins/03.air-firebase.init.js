import FireModel from "air-firebase-v2";
// import ClientAdapter from "air-firebase-v2-client-adapter";
import ClientAdapter from "@shisyamo4131/air-firebase-v2-client-adapter";

export default defineNuxtPlugin((app) => {
  FireModel.setAdapter(new ClientAdapter());
});
