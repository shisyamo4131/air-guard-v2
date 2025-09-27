/** Firebase, FireModel の初期化 */
import "./modules/firebase.init.js";

/** モジュールからのインポート */
import { geocoding } from "./modules/geocoding.js";
import {
  createUserWithCompany,
  createUserInCompany,
  disableUser,
  enableUser,
} from "./modules/auth.js";

/** エクスポート */
export * from "./modules/dependentSync.js"; // dependentSync.js からすべてエクスポート
export {
  geocoding,
  createUserWithCompany,
  createUserInCompany,
  disableUser,
  enableUser,
};
