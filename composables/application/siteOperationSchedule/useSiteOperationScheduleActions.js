import dayjs from "dayjs";
import { watch, onScopeDispose } from "vue";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useOperationSubmission } from "@/composables/application/operation/useOperationSubmission";
import { scheduleCommands } from "@/composables/domain/operation/scheduleCommands";
import { operationRawFor } from "@/composables/domain/operation/operationRawContext";
import { operationPresentation } from "@/composables/domain/operation/operationPresentation";
import { expectedForOperation } from "@/functions/shared/operationWriteContract.js";

export function useSiteOperationScheduleActions() {
  const submission = useOperationSubmission(), messages = useMessagesStore();
  let queued = null, generation = 0, disposed = false;
  watch([submission.scope, submission.allowed], () => { generation++; }, { flush: "sync" });
  onScopeDispose(() => { generation++; disposed = true; });
  async function perform(schedules, build, ticket = generation, owner = submission.scope()) {
    const current = () => !disposed && submission.allowed.value && ticket === generation && owner === submission.scope();
    let states = [];
    try {
      if (!current()) return false;
      states = schedules.map((model) => operationPresentation(model, submission.scope()));
      if (states.some((state) => state.busy || state.blocked) || submission.uncertain.value) throw new Error();
      states.forEach((state) => { state.busy = true; });
      const result = await submission.submit(build());
      if (!current()) return false;
      if (!result) throw new Error();
      // Old displayed raw remains unusable until the period listener delivers a
      // fresh model. This prevents a second gesture from reusing old expectations.
      states.forEach((state) => { state.blocked = result.updated !== false; });
      return true;
    } catch {
      if (!current()) return false;
      states.forEach((state) => { state.blocked = true; state.revision++; });
      messages.add({ text: submission.message.value || "保存できませんでした。表示を元に戻しました。最新情報を読み直してください。", color: "warning" });
      return false;
    } finally { states.forEach((state) => { state.busy = false; }); }
  }
  function enqueue(models) {
    if (!queued) {
      queued = { models: new Map(), waiters: [], ticket: generation, owner: submission.scope() };
      Promise.resolve().then(async () => {
        const batch = queued; queued = null;
        const items = [...batch.models.values()];
        const result = await perform(items, () => items.flatMap((model) => scheduleCommands(model, submission.scope())), batch.ticket, batch.owner);
        batch.waiters.forEach((resolve) => resolve(result));
      });
    }
    for (const model of models) queued.models.set(model.docId, model);
    return new Promise((resolve) => queued.waiters.push(resolve));
  }
  const updateSchedule = (model) => enqueue([model]);
  const notify = (model) => perform([model], () => {
    const raw = operationRawFor(model, submission.scope());
    const command = { kind: "schedule", action: "notify", documentId: raw.docId, changes: { shouldNotify: true } };
    command.expected = expectedForOperation(raw, command); return [command];
  });
  function updateSchedules(schedules, { date, siteId, shiftType } = {}) {
    if (!date || !siteId || !shiftType) return perform(schedules, () => { throw new Error(); });
    schedules.forEach((model, index) => {
      model.siteId = siteId; model.shiftType = shiftType; model.dateAt = dayjs.tz(date).startOf("day").toDate(); model.displayOrder = index;
    });
    return enqueue(schedules);
  }
  return { notify, updateSchedule, updateSchedules };
}
