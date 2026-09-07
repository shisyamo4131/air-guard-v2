/** dayjs の初期化 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Tokyo");

/** Firebase, FireModel の初期化 */
import "./modules/firebase.init.js";

/** モジュールからのインポートとエクスポート */
export * from "./modules/maintenance.js";
export * from "./modules/dependentSync.js";
export * from "./modules/geocoding.js";
export * from "./modules/Employees.js";

export * from "./triggers/arrangementNotification.js";
export * from "./triggers/auth.js";
export * from "./triggers/lifecycleReconciler.js";
export * from "./triggers/operationResult.js";
export * from "./triggers/user.js";

export * from "./triggers/securityReport.js";
export * from "./modules/operationCleanup.js";
export * from "./modules/utils/notifications.js";

/** API の公開 */
export * from "./apis/index.js";
