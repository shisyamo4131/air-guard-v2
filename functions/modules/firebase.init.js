import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";
import * as functions from "firebase-functions"; // 2025-12-29 added

/**
 * 2025-09-27 FireModel の初期化をコメントアウト
 * air-firebase-v2, air-firebase-v2-server-adapter が package.json でファイル参照になっているため、
 * emulator では動作するものの、deploy 時にエラーになる。
 * 一旦、FireModel の使用を取りやめ、コメントアウトする。
 * 2025-11-17 各種パッケージを npm に公開し、インストールした。動作を確認する。
 */
import FireModel from "@shisyamo4131/air-firebase-v2";
import ServerAdapter from "@shisyamo4131/air-firebase-v2-server-adapter";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({ region: "asia-northeast1" });
FireModel.setAdapter(new ServerAdapter(getFirestore(), functions));
