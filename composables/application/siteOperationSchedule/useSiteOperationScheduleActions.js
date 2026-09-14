import dayjs from "dayjs";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

export function useSiteOperationScheduleActions() {
  const auth = useAuthStore();
  const loadings = useLoadingsStore();
  const logger = useLogger("useSiteOperationScheduleActions", useErrorsStore());

  const notify = async (schedule) => {
    const key = loadings.add("Creating notifications");
    try {
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadings.remove(key);
    }
  };

  const updateSchedule = async (schedule) => {
    if (auth.isDeveloper) {
      const before = schedule._beforeData.workers.map((worker) => worker.workerId);
      const after = schedule.workers.map((worker) => worker.workerId);
      console.table({ before, after });
    }
    try {
      await schedule.update();
    } catch (error) {
      logger.error({ message: "Failed to update schedule", error });
    }
  };

  function normalizeSchedules(schedules, { date, siteId, shiftType } = {}) {
    if (!date || !siteId || !shiftType) {
      throw new Error("Missing required options: date, siteId, shiftType");
    }
    const dateAt = dayjs.tz(date).startOf("day").toDate();
    return schedules.map((schedule, index) => {
      schedule.siteId = siteId;
      schedule.shiftType = shiftType;
      schedule.dateAt = dateAt;
      schedule.displayOrder = index;
      return schedule;
    });
  }

  const updateSchedules = async (schedules, options = {}) => {
    try {
      const normalizedSchedules = normalizeSchedules(schedules, options);
      await SiteOperationSchedule.runTransaction(async (transaction) => {
        await Promise.all(
          normalizedSchedules.map((schedule) =>
            schedule.update({ transaction }),
          ),
        );
      });
    } catch (error) {
      logger.error({ message: "Failed to update schedules", error });
    }
  };

  return { notify, updateSchedule, updateSchedules };
}
