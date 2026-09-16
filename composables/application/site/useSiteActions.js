import * as Vue from "vue";

const sharedSiteWriteState = Vue.reactive({ isSaving: false });

export async function runWithSiteWriteMutex(action) {
  if (typeof action !== "function") throw new Error("現場の保存処理を確認してください。");
  if (sharedSiteWriteState.isSaving) throw new Error("現場情報を保存中です。");

  sharedSiteWriteState.isSaving = true;
  try {
    return await action();
  } finally {
    sharedSiteWriteState.isSaving = false;
  }
}
