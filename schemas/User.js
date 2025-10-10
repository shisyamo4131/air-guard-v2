/**
 * @file ./schemas/User.js
 * @description ユーザー情報クラス
 */
import { User as BaseClass } from "air-guard-v2-schemas";

export default class User extends BaseClass {
  /**
   * Override create method to prevent creating user documents from the class.
   * - User document should be created via Cloud Function.
   * @returns {Promise<never>}
   */
  create() {
    return Promise.reject(new Error("ユーザーの作成方法が不正です。"));
  }

  /**
   * Override delete method to prevent deleting user documents from the class.
   * - User document could not be deleted.
   * @returns {Promise<never>}
   */
  delete() {
    return Promise.reject(new Error("ユーザーを削除することはできません。"));
  }
}
