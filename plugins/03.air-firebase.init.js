import FireModel from "@shisyamo4131/air-firebase-v2";
import ClientAdapter from "@shisyamo4131/air-firebase-v2-client-adapter";
import { httpsCallable } from "firebase/functions";
import { GeocodableMixin } from "@/schemas";

export default defineNuxtPlugin((app) => {
  // const adapter = new ClientAdapter();
  // FireModel.setAdapter(adapter);

  const { $functions } = useNuxtApp();
  const adapter = new ClientAdapter($functions);
  FireModel.setAdapter(adapter);

  // Geocoding 関数を作成（Cloud Functions 経由）
  const clientGeocodingFn = async (address) => {
    try {
      const callable = httpsCallable($functions, "geocoding");
      const result = await callable({ address });
      return result.data; // { lat, lng, formattedAddress }
    } catch (error) {
      console.error("[ClientGeocoding] Error:", error);
      return null;
    }
  };

  // GeocodableMixin に Geocoding 関数を注入（すべてのクラスで共有）
  GeocodableMixin.setGeocodingFunction(clientGeocodingFn);

  // デバッグログ
  if (process.env.NODE_ENV === "development") {
    console.log("[ClientAdapter] functions:", $functions);
    console.log("[ClientAdapter] adapter.functions:", adapter.functions);
  }
});
