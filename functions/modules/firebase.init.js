import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions";

/**
 * 2025-09-27 FireModel の初期化をコメントアウト
 * air-firebase-v2, air-firebase-v2-server-adapter が package.json でファイル参照になっているため、
 * emulator では動作するものの、deploy 時にエラーになる。
 * 一旦、FireModel の使用を取りやめ、コメントアウトする。
 */
// import FireModel from "air-firebase-v2";
// import ServerAdapter from "air-firebase-v2-server-adapter";
// import { getFirestore } from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({ region: "asia-northeast1" });
// FireModel.setAdapter(new ServerAdapter(getFirestore()));
