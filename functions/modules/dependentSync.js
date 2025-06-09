import { Site } from "air-guard-v2-schemas";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

// 1. 依存関係設定の定義
const dependencyConfigs = [
  {
    sourceCollection: "Customers", // 更新元コレクション名 (FirestoreのコレクションID)
    targetCollection: "Sites", // 更新先コレクション名
    targetModelClass: Site, // ★ ターゲットモデルのクラスを指定
    // 更新先コレクションのパスを生成する関数
    targetPath: (companyId) => `Companies/${companyId}/Sites`,
    // 更新先ドキュメント内で、更新元ドキュメントIDを保持するフィールド名
    foreignKeyFieldInTarget: "customerId",
    // 更新先ドキュメント内で、更新元データを格納するフィールド名
    updateFieldInTarget: "customer",
  },
  // 他の依存関係ルールをここに追加できます
  // 例:
  // {
  //   sourceCollection: "OtherSourceCollection",
  //   targetCollection: "OtherTargetCollection",
  //   targetModelClass: OtherTargetModel, // 対応するモデルクラス
  //   targetPath: (companyId) => `Companies/${companyId}/OtherTargetCollection`,
  //   foreignKeyFieldInTarget: "sourceDocId",
  //   updateFieldInTarget: "sourceDataMinimal",
  // },
];

// 2. 実際の同期処理を行う関数
async function syncDependentDocuments({
  companyId,
  sourceDocId, // 更新されたソースドキュメントのID
  sourceDocData, // 更新されたソースドキュメントのデータ (変換前)
  config, // dependencyConfigs の単一要素
}) {
  const db = getFirestore();
  const colRef = db.collection(config.targetPath(companyId));
  const queryRef = colRef.where(
    config.foreignKeyFieldInTarget,
    "==",
    sourceDocId
  );
  const snapshot = await queryRef.get();

  const targetModelStaticProps = config.targetModelClass.classProps;
  if (!targetModelStaticProps) {
    logger.error(
      `[syncDependentDocuments] classProps not found on targetModelClass '${config.targetModelClass.name}'. Cannot determine field schema for ${config.targetCollection} from ${config.sourceCollection} (${sourceDocId}).`
    );
    return;
  }

  const targetFieldSchema = targetModelStaticProps[config.updateFieldInTarget];
  if (!targetFieldSchema) {
    logger.error(
      `[syncDependentDocuments] Field schema for '${config.updateFieldInTarget}' not found in targetModelClass '${config.targetModelClass.name}'. Cannot sync for ${config.targetCollection} from ${config.sourceCollection} (${sourceDocId}).`
    );
    return;
  }

  if (!targetFieldSchema.customClass) {
    logger.error(
      `[syncDependentDocuments] No customClass defined for target field '${config.updateFieldInTarget}' in '${config.targetModelClass.name}'. Current configuration cannot automatically transform data for ${config.targetCollection} from ${config.sourceCollection} (${sourceDocId}).`
    );
    return;
  }

  let dataToUpdateInTarget;
  const TargetCustomClass = targetFieldSchema.customClass;
  try {
    const instance = new TargetCustomClass(sourceDocData);
    if (typeof instance.toObject !== "function") {
      logger.error(
        `[syncDependentDocuments] customClass '${TargetCustomClass.name}' for field '${config.updateFieldInTarget}' in ${config.targetCollection} does not have a toObject() method. Cannot prepare data from ${config.sourceCollection} (${sourceDocId}).`
      );
      return;
    }
    dataToUpdateInTarget = instance.toObject();
  } catch (e) {
    logger.error(
      `[syncDependentDocuments] Error instantiating or processing customClass '${TargetCustomClass.name}' for field '${config.updateFieldInTarget}' in ${config.targetCollection}. Source: ${config.sourceCollection} (${sourceDocId}). Error: ${e.message}`,
      e
    );
    return;
  }

  if (snapshot.empty) {
    logger.info(
      `[syncDependentDocuments] Update for ${config.sourceCollection} (${sourceDocId}): No dependent documents found in ${config.targetCollection}.`
    );
    return;
  }

  const docsToUpdate = snapshot.docs;
  const batchSize = 300; // 1回のバッチで処理する最大ドキュメント数
  let totalUpdatedCount = 0;

  for (let i = 0; i < docsToUpdate.length; i += batchSize) {
    const batch = db.batch();
    const chunk = docsToUpdate.slice(i, i + batchSize);

    chunk.forEach((doc) => {
      batch.update(doc.ref, {
        [config.updateFieldInTarget]: dataToUpdateInTarget,
      });
    });

    try {
      await batch.commit();
      totalUpdatedCount += chunk.length;
      logger.info(
        `[syncDependentDocuments] ${config.sourceCollection} (${sourceDocId}) -> ${config.targetCollection}: Batch updated ${chunk.length} documents (Total updated: ${totalUpdatedCount}/${docsToUpdate.length}).`
      );
    } catch (error) {
      logger.error(
        `[syncDependentDocuments] Error during batch commit for ${
          config.sourceCollection
        } (${sourceDocId}) -> ${config.targetCollection} (Range: ${i} - ${
          i + chunk.length - 1
        }).`,
        error
      );
      // Depending on requirements, you might want to stop or continue.
      // This example logs the error and returns, effectively stopping further batches for this sync.
      return;
    }
  }

  logger.info(
    `[syncDependentDocuments] Successfully synced ${totalUpdatedCount} documents in ${config.targetCollection} due to update in ${config.sourceCollection} (${sourceDocId}).`
  );
}

/**
 * 依存ドキュメント同期のための汎用トリガーハンドラーを作成するファクトリ関数。
 * @param {string} sourceCollectionName - 更新を監視するソースコレクションの名前。
 * @param {string} triggerFunctionName - ログ出力に使用するトリガー関数の名前。
 * @returns {Function} Firestoreドキュメント更新イベントを処理する非同期関数。
 */
function createDependentSyncTriggerHandler(
  sourceCollectionName,
  triggerFunctionName
) {
  return async (event) => {
    const companyId = event.params.companyId;
    const updatedDocId = event.params.docId;
    const docAfterData = event.data.after.data();

    if (!docAfterData) {
      logger.info(
        `[${triggerFunctionName}] Document data for ${sourceCollectionName}/${updatedDocId} does not exist (deleted or invalid event). Skipping processing.`
      );
      return null;
    }

    const relevantConfigs = dependencyConfigs.filter(
      (config) => config.sourceCollection === sourceCollectionName
    );

    if (relevantConfigs.length === 0) {
      logger.info(
        `[${triggerFunctionName}] No relevant dependency configs found for update in ${sourceCollectionName} (${updatedDocId}). This might indicate a configuration issue.`
      );
      return null;
    }

    logger.info(
      `[${triggerFunctionName}] Detected update in ${sourceCollectionName} (${updatedDocId}). Starting ${relevantConfigs.length} dependent sync processes.`
    );

    const syncPromises = relevantConfigs.map((config) => {
      return syncDependentDocuments({
        companyId,
        sourceDocId: updatedDocId,
        sourceDocData: docAfterData,
        config,
      }).catch((error) => {
        logger.error(
          `[${triggerFunctionName}] Error syncing ${config.targetCollection} for ${config.sourceCollection} (${updatedDocId}). Error: ${error.message}`,
          error
        );
      });
    });
    try {
      await Promise.all(syncPromises);
      logger.info(
        `[${triggerFunctionName}] All dependent document sync processes attempted for ${sourceCollectionName} (${updatedDocId}).`
      );
    } catch (error) {
      logger.error(
        `[${triggerFunctionName}] Unexpected overall error during dependent sync processing for document: ${sourceCollectionName}/${updatedDocId}. Error: ${error.message}`,
        error
      );
      throw error;
    }

    return null;
  };
}

export const handleCustomerUpdateForDependentSync = onDocumentUpdated(
  "Companies/{companyId}/Customers/{docId}",
  createDependentSyncTriggerHandler(
    "Customers",
    "handleCustomerUpdateForDependentSync"
  )
);

// 例: もしProductsコレクションの更新トリガーが必要になった場合
// export const handleProductUpdateForDependentSync = onDocumentUpdated(
//   "Companies/{companyId}/Products/{docId}",
//   createDependentSyncTriggerHandler("Products", "handleProductUpdateForDependentSync")
// );
