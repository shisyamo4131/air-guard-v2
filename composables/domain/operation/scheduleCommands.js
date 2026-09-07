import { rawForClass, equal, dateInput } from "@/functions/shared/employeeContract.js";
import { OVERVIEW_FIELDS, WORKER_FIELDS, expectedForOperation } from "@/functions/shared/operationWriteContract.js";
import { operationEmployeeReferences } from "@/functions/shared/operationReferences.js";
import { operationRawFor, operationRowPosition } from "./operationRawContext";

export function scheduleCommands(model, scope) {
  const raw = operationRawFor(model, scope);
  operationEmployeeReferences(raw, { scheduleId: model.docId });
  const commands = [];
  function add(action, changes, options = {}) {
    const command = { kind: "schedule", documentId: raw.docId, action, changes, ...options };
    command.expected = expectedForOperation(raw, command); commands.push(command);
  }
  const overview = Object.fromEntries(OVERVIEW_FIELDS.filter((field) => !equal(rawForClass(raw[field]), model[field])).map((field) => [field, field === "dateAt" ? dateInput(model[field]) : model[field]]));
  if (Object.keys(overview).length) add("overview", overview);
  if (!equal(raw.displayOrder, model.displayOrder)) add("order", { displayOrder: model.displayOrder });
  for (const array of ["employees", "outsourcers"]) {
    const desired = model[array].map((worker) => {
      const location = operationRowPosition(model, worker, scope);
      if (location && location.array !== array) throw new Error("作業員の原本位置を確認できません。");
      if (!location && raw[array].some((row) => row.workerId === worker.workerId)) throw new Error("作業員の原本位置を確認できません。最新情報を読み直してください。");
      return { worker, position: location?.position ?? null };
    });
    const retained = desired.filter((row) => row.position !== null).map((row) => row.position);
    if (new Set(retained).size !== retained.length) throw new Error("作業員の原本位置が重複しています。");
    const current = [];
    for (let position = 0; position < raw[array].length; position++) {
      if (!retained.includes(position)) add("workers", {}, { array, rowAction: "remove", position });
      else current.push(position);
    }
    for (const { worker, position } of desired) if (position !== null) {
      const changes = Object.fromEntries(WORKER_FIELDS.filter((field) => !equal(rawForClass(raw[array][position][field]), worker[field])).map((field) => [field, worker[field]]));
      if (Object.keys(changes).length) add("workers", changes, { array, rowAction: "update", position });
    }
    for (let index = 0; index < retained.length; index++) if (current[index] !== retained[index]) {
      const position = retained[index], from = current.indexOf(position);
      add("workers", {}, { array, rowAction: "move", position, destination: current[index] });
      current.splice(index, 0, current.splice(from, 1)[0]);
    }
    for (const [index, { worker, position }] of desired.entries()) if (position === null) {
      const anchor = desired.slice(index + 1).find((row) => row.position !== null)?.position ?? raw[array].length;
      add("workers", Object.fromEntries(WORKER_FIELDS.map((field) => [field, worker[field]])), { array, rowAction: "add", position: anchor });
    }
  }
  return commands;
}
