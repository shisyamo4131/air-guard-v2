import { operationDateTime } from "@/composables/domain/operation/operationDateTime";
import { parseDate } from "@/composables/domain/shared/valueContract";
import { watch, onScopeDispose } from "vue";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useOperationSubmission } from "@/composables/application/operation/useOperationSubmission";
import { scheduleCommands } from "@/composables/domain/operation/scheduleCommands";
import { operationRawFor } from "@/composables/domain/operation/operationRawContext";
import { expectedForOperation } from "@/composables/domain/operation/operationCommandContract";

export function useSiteOperationScheduleActions({
  publishSchedule = () => false,
  publishNotificationState = () => false,
  resetNotifications = () => {},
  refreshSchedule = () => false,
} = {}) {
  const submission = useOperationSubmission({ concurrent: true }), messages = useMessagesStore();
  let generation = 0, disposed = false;
  watch([submission.scope, submission.allowed], () => { generation++; }, { flush: "sync" });
  onScopeDispose(() => { generation++; disposed = true; });
  async function perform(schedules, build, { continuous = false } = {}, ticket = generation, owner = submission.scope()) {
    const current = () => !disposed && submission.allowed.value && ticket === generation && owner === submission.scope();
    let commands = [];
    try {
      if (!current()) return false;
      if (submission.uncertain.value) throw new Error();
      commands = build();
      if (continuous && schedules.some((model) =>
        publishSchedule(model, operationRawFor(model, submission.scope())) !== true)) {
        throw new Error();
      }
      if (!continuous && commands.some(({ action }) => action === "notify") &&
        schedules.some((model) => publishNotificationState(model, true) !== true)) {
        throw new Error();
      }
      const result = await submission.submit(commands);
      if (!current()) return false;
      if (!result) throw new Error();
      return true;
    } catch {
      if (!current()) return false;
      if (!continuous) {
        resetNotifications(commands.map(({ documentId }) => documentId));
      }
      if (commands.length) {
        for (const id of new Set(commands.map(({ documentId }) => documentId))) {
          try {
            await refreshSchedule(id);
          } catch {
            // The listener remains the canonical fallback for this document.
          }
        }
      }
      messages.add({ text: submission.message.value || "保存できませんでした。表示を元に戻しました。最新情報を読み直してください。", color: "warning" });
      return false;
    }
  }
  const updateSchedule = (model) => perform([model], () => scheduleCommands(model, submission.scope()), { continuous: true });
  const notify = (model) => {
    if (!model.workers?.some((worker) => !worker.hasNotification)) return false;
    return perform([model], () => {
      const raw = operationRawFor(model, submission.scope());
      const command = { kind: "schedule", action: "notify", documentId: raw.docId, changes: { shouldNotify: true } };
      command.expected = expectedForOperation(raw, command); return [command];
    });
  };
  function updateSchedules(schedules, { date, siteId, shiftType } = {}) {
    if (!date || !siteId || !shiftType) return perform(schedules, () => { throw new Error(); });
    schedules.forEach((model, index) => {
      operationDateTime(model);
      model.siteId = siteId; model.shiftType = shiftType; model.dateAt = parseDate(date); model.displayOrder = index;
    });
    return perform(schedules, () => schedules.flatMap((model) => scheduleCommands(model, submission.scope())), { continuous: true });
  }
  return { notify, updateSchedule, updateSchedules };
}
