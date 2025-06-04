/** Firebase, FireModel の初期化 */
import "./modules/firebase.init.js";
import { geocoding } from "./modules/geocoding.js";
import {
  createUserWithCompany,
  createUserInCompany,
  disableUser,
  enableUser,
} from "./modules/auth.js";

/** Cloud Functions のテスト用モジュール */
import { testFunction } from "./modules/testFunction.js";
export { testFunction };

export {
  geocoding,
  createUserWithCompany,
  createUserInCompany,
  disableUser,
  enableUser,
};
