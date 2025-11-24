/**
 * @file ./schemas/User.js
 * @description ユーザー情報クラス
 */
import { User as BaseClass } from "@shisyamo4131/air-guard-v2-schemas";

export default class User extends BaseClass {
  /**
   * Override delete method to prevent deleting user documents from the class.
   * - User document could not be deleted.
   * @returns {Promise<never>}
   */
  delete() {
    return Promise.reject(new Error("ユーザーを削除することはできません。"));
  }
}
