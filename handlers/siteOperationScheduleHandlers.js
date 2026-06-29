/*****************************************************************************
 * @file ./handlers/siteOperationScheduleHandlers.js
 * @description SiteOperationSchedule クラスを取り扱う AirArrayManager、AirItemManager の
 *              handleXxxx プロパティに引き渡す関数を返す
 *****************************************************************************/
import { onBeforeCreate, onBeforeUpdate } from "@/services/operation.js";

/*****************************************************************************
 * HANDLE CREATE
 *****************************************************************************/
export async function handleCreate(item) {
  await onBeforeCreate(item);
  await item.create();
}

/*****************************************************************************
 * HANDLE UPDATE
 *****************************************************************************/
export async function handleUpdate(item) {
  await onBeforeUpdate(item);
  await item.update();
}

/*****************************************************************************
 * HANDLE DELETE
 *****************************************************************************/
export async function handleDelete(item) {
  await item.delete();
}
