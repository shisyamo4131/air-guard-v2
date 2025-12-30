/**
 * @file functions/modules/migration.js
 * @description Geopoint マイグレーション用のテスト関数
 */
import { onCall } from "firebase-functions/v2/https";
import FireModel from "@shisyamo4131/air-firebase-v2";
import { Company, Customer, Site, Employee } from "../schemas/index.js";

/**
 * モデルクラスを取得
 * @param {string} collectionName - コレクション名
 * @returns {Class} モデルクラス
 */
function getModelClass(collectionName) {
  switch (collectionName) {
    case "Companies":
      return Company;
    case "Customers":
      return Customer;
    case "Sites":
      return Site;
    case "Employees":
      return Employee;
    default:
      throw new Error(`Unknown collection: ${collectionName}`);
  }
}

/**
 * Geopoint マイグレーションテスト
 * 指定されたコレクションの1件のドキュメントを空更新して geopoint を追加
 */
export const testGeopointMigration = onCall(async (request) => {
  const { collection, companyId } = request.data;

  if (!collection) {
    throw new Error("collection parameter is required");
  }

  if (!companyId) {
    throw new Error("companyId parameter is required");
  }

  try {
    // マルチテナント用のプレフィックスを設定
    const prefix = collection === "Companies" ? "" : `Companies/${companyId}/`;
    FireModel.setConfig({ prefix });

    const Model = getModelClass(collection);
    const instance = new Model();

    // ドキュメント1件を取得
    const docs = await instance.fetchDocs({
      constraints: [["limit", 1]],
    });

    if (docs.length === 0) {
      return {
        success: false,
        message: `No documents found in ${collection}`,
        prefix,
      };
    }

    // 取得したドキュメントを読み込んで空更新
    await instance.fetch({ docId: docs[0].docId });

    console.log(`[testGeopointMigration] Before update:`, {
      collection,
      companyId,
      docId: instance.docId,
      location: instance.location,
      customerId: instance.customerId || "N/A",
      customerExists: !!instance.customer,
      customerDocId: instance.customer?.docId || "N/A",
      beforeDataExists: !!instance._beforeData,
      beforeDataCustomerExists: !!instance._beforeData?.customer,
      prefix,
    });

    // skipGeocoding: true で住所のジオコーディングをスキップし、geopoint のみ追加
    await instance.update({ skipGeocoding: true });

    console.log(`[testGeopointMigration] After update: ${instance.docId}`);

    return {
      success: true,
      docId: instance.docId,
      collection,
      companyId,
      prefix,
      location: instance.location,
      customerId: instance.customerId || "N/A",
      message: `Document updated. Check Firestore for geopoint field.`,
    };
  } catch (error) {
    console.error(`[testGeopointMigration] Error:`, {
      message: error.message,
      stack: error.stack,
      collection,
      companyId,
    });
    throw new Error(`Migration failed for ${collection}: ${error.message}`);
  }
});
