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

/** テスト用 */
import { testApi } from "./modules/testFunction.js";
export { testApi };

/** エクスポート */
export * from "./modules/dependentSync.js"; // dependentSync.js からすべてエクスポート
export {
  geocoding,
  createUserWithCompany,
  createUserInCompany,
  disableUser,
  enableUser,
};
