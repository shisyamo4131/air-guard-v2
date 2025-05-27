/**
 * @file ./schemas/User.js
 * @description ユーザー情報クラス
 */
import { User as BaseClass } from "air-guard-v2-schemas";

export class User extends BaseClass {
  // User ドキュメントはクラスから作成してはいけない
  create() {
    console.error("[User.js] Could not use create().");
    return Promise.reject(new Error("Could not use create()."));
  }

  // User ドキュメントはクラスから変更してはいけない
  update() {
    console.error("[User.js] Could not use update().");
    return Promise.reject(new Error("Could not use update()."));
  }

  // User ドキュメントはクラスから削除してはいけない
  delete() {
    console.error("[User.js] Could not use delete().");
    return Promise.reject(new Error("Could not use delete()."));
  }
}
