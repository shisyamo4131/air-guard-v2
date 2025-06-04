import { ref } from "vue";

export function useTestDataRegistrar() {
  const registrationLog = ref([]);
  const isLoading = ref(false);

  async function registerItems({
    items,
    itemConstructor, // 例: Employee クラス
    itemName, // ログ表示用 例: "従業員"
  }) {
    if (isLoading.value) return;
    isLoading.value = true;
    registrationLog.value = [`${itemName}の登録処理を開始します...`];

    for (const itemData of items) {
      // 登録/更新対象のデータでインスタンスを作成
      try {
        // 既存ドキュメントの存在確認 (code フィールドで検索)
        // fetchDocs は該当するドキュメントデータの配列を返します
        // converter が適用されているため、配列の要素は itemConstructor のインスタンスです。
        const existingDocs = await new itemConstructor().fetchDocs({
          constraints: [["where", "code", "==", itemData.code]],
        });

        const instance = new itemConstructor(itemData);

        if (existingDocs && existingDocs.length > 0) {
          // 既存ドキュメントが存在する場合、更新処理
          const existingInstance = existingDocs[0]; // code はユニークと仮定し、最初の要素を取得

          // console.log(existingInstance);
          // 取得したインスタンスに新しい itemData をマージする
          existingInstance.initialize({
            ...existingInstance.toObject(),
            ...itemData,
          });

          // 反映させたインスタンスを更新
          await existingInstance.update();
          const message = `成功: ${
            existingInstance.displayName ||
            `${existingInstance.lastName} ${existingInstance.firstName}`
          } (Code: ${existingInstance.code}) を更新しました。Doc ID: ${
            existingInstance.docId
          }`;
          registrationLog.value.push(message);
          console.log(message);
        } else {
          // 既存ドキュメントが存在しない場合、新規作成処理
          // 新しく作成したインスタンス (itemData で初期化済み) を登録
          const documentRef = await instance.create();
          const message = `成功: ${
            instance.displayName || `${instance.lastName} ${instance.firstName}`
          } (Code: ${instance.code}) を登録しました。Doc ID: ${documentRef.id}`;
          registrationLog.value.push(message);
          console.log(message, documentRef);
        }
      } catch (error) {
        // エラー発生時のログ出力は、ループのtry-catchの外に移動しました
        // エラーが発生した itemData を特定するために、ここでエラー処理を行います
        const displayName =
          itemData.displayName ||
          (itemData.lastName
            ? `${itemData.lastName} ${itemData.firstName}`
            : "不明なアイテム");
        const code = itemData.code || "コード不明";
        const errorMessage = `失敗: ${displayName} (Code: ${code}) の登録中にエラーが発生しました: ${error.message}`;
        registrationLog.value.push(errorMessage);
        console.error(errorMessage, error);
      }
    }
    registrationLog.value.push(`全ての${itemName}の登録処理が完了しました。`);
    isLoading.value = false;
  }

  return {
    registrationLog,
    isLoading,
    registerItems,
  };
}
