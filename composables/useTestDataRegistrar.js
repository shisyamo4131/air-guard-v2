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
      try {
        const instance = new itemConstructor(itemData);
        // EmployeeクラスのdisplayName, code, create()メソッドを想定
        const documentRef = await instance.create();
        const message = `成功: ${
          instance.displayName || `${instance.lastName} ${instance.firstName}`
        } (Code: ${instance.code}) を登録しました。Doc ID: ${documentRef.id}`;
        registrationLog.value.push(message);
        console.log(message, documentRef);
      } catch (error) {
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
