import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";
import ServerAdapter from "air-firebase-v2-server-adapter";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({ region: "asia-northeast1" });
FireModel.setAdapter(new ServerAdapter(getFirestore()));
