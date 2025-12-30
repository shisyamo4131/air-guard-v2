import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";
import * as functions from "firebase-functions";
import FireModel from "@shisyamo4131/air-firebase-v2";
import ServerAdapter from "@shisyamo4131/air-firebase-v2-server-adapter";
import { getFirestore } from "firebase-admin/firestore";
import { GeocodableMixin } from "@shisyamo4131/air-guard-v2-schemas";
import { fetchCoordinates } from "./utils/geocoding.js";

initializeApp();
setGlobalOptions({ region: "asia-northeast1" });
FireModel.setAdapter(new ServerAdapter(getFirestore(), functions));

// GeocodableMixin に Server側の geocoding 関数を注入
GeocodableMixin.setGeocodingFunction(fetchCoordinates);
