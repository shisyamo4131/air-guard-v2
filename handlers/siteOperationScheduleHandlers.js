/*****************************************************************************
 * @file ./handlers/siteOperationScheduleHandlers.js
 * @description SiteOperationSchedule を扱う AirArrayManager / AirItemManager
 *              の標準保存ハンドラ
 *****************************************************************************/
import { onBeforeCreate, onBeforeUpdate } from "@/services/operation.js";

export async function handleCreate(item) {
  await onBeforeCreate(item);
  await item.create();
}

export async function handleUpdate(item) {
  await onBeforeUpdate(item);
  await item.update();
}

export async function handleDelete(item) {
  await item.delete();
}
