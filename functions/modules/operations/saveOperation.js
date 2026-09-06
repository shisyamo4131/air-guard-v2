import { operationDateTime } from "../../shared/operationDateTime.js";
import { FieldValue } from "firebase-admin/firestore";
import { Site, SiteOperationSchedule, OperationResult, OperationResultDetail, ArrangementNotification } from "@shisyamo4131/air-guard-v2-schemas";
import { plain, identifier, equal, rawForClass } from "../../shared/employeeContract.js";
import { OperationWriteError, operationEmployeeReferences, notificationEmployeeReferences, readAddedEmployees } from "../../shared/operationReferences.js";
import { parseOperationCommand, operationAllowed, assertOperationExpected, applyOperationCommand, calculateOperation, mergeCalculated, notificationExpectation, WORKER_PARENT_FIELDS } from "../../shared/operationWriteContract.js";

const fail = (code = "failed-precondition", message) => { throw new OperationWriteError(code, message); };
const collectionFor = (kind) => kind === "schedule" ? "SiteOperationSchedules" : "OperationResults";

export async function saveOperation({ firestore, resolveIdentity, input, timestamp = () => FieldValue.serverTimestamp() }) {
  if (!plain(input) || Object.keys(input).length !== 1 || !Array.isArray(input.operations) || input.operations.length === 0) fail("invalid-argument");
  const commands = input.operations.map(parseOperationCommand);
  for (const command of commands) if (command.action === "duplicate" && commands.some((other) => other !== command && collectionFor(other.kind) === collectionFor(command.kind) && (other.documentId === command.sourceId || other.documentId === command.documentId))) fail("invalid-argument");
  // Notification preparation and conversion each require their own completed
  // confirmation read. A batch cannot substitute for that user-visible boundary.
  for (const command of commands) if (["notify", "convert"].includes(command.action)
    && commands.some((other) => other !== command && other.documentId === command.documentId
      && (other.kind === "schedule" || command.action === "convert"))) fail("invalid-argument");
  const identity = await resolveIdentity();
  const root = `Companies/${identity.companyId}`;
  return firestore.runTransaction(async (transaction) => {
    const current = await resolveIdentity();
    if (current.uid !== identity.uid || current.companyId !== identity.companyId) fail("permission-denied");
    const readCache = new Map();
    async function read(path) {
      if (!readCache.has(path)) {
        const snapshot = await transaction.get(firestore.doc(path));
        readCache.set(path, snapshot.exists ? snapshot.data() : null);
      }
      return readCache.get(path);
    }
    const user = await read(`${root}/Users/${identity.uid}`);
    for (const command of commands) if (!operationAllowed(current, user, command.kind === "billing")) fail("permission-denied");
    if (commands.some((command) => command.kind === "schedule")) {
      const system = await read("System/system");
      if (system?.isMaintenance !== false) fail("failed-precondition", "メンテナンス中は予定を変更できません。");
    }
    // All read plans, including query results and every Employee existence read,
    // complete before the final write loop. No schema persistence hooks run here.
    const plans = new Map();
    const siteRevisions = new Map();
    const rowPositions = new Map();
    async function plan(path, referenceKind) {
      if (!plans.has(path)) {
        const before = await read(path);
        plans.set(path, { path, before, after: before, referenceKind });
      }
      return plans.get(path);
    }
    async function requireSite(id) {
      if (!identifier(id)) fail();
      const raw = await read(`${root}/Sites/${id}`);
      if (raw === null) fail("failed-precondition", "参照先の現場が存在しません。");
      return raw;
    }
    async function guardScheduleSite(id, expectedStatus) {
      const raw = await requireSite(id);
      if (raw.isTemporary !== false || !["ACTIVE", "TERMINATED"].includes(raw.status) || raw.status !== expectedStatus) fail("aborted", "現場の状態が変わりました。最新情報を確認してください。");
      const revision = Object.hasOwn(raw, "scheduleRevision") ? raw.scheduleRevision : 0;
      if (!Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER) fail();
      siteRevisions.set(id, revision + 1);
      if (siteRevisions.size > 8) fail("invalid-argument");
    }
    async function applySiteAgreement(raw, kind) {
      const siteRaw = await requireSite(raw.siteId);
      if (!identifier(siteRaw.customerId) || await read(`${root}/Customers/${siteRaw.customerId}`) === null) fail("failed-precondition", "参照先の取引先が存在しません。");
      if (!Array.isArray(siteRaw.agreementsV2)) fail();
      const site = new Site(rawForClass(siteRaw));
      return calculateOperation(raw, kind, (model) => { model.customerId = siteRaw.customerId; model.agreement = site.getValidAgreement(model); }).value;
    }
    async function cancelNotifications(id, before, after) {
      const changedAll = after === null || WORKER_PARENT_FIELDS.some((field) => !equal(before[field], after[field]));
      const previous = [...before.employees, ...before.outsourcers];
      const next = after === null ? [] : [...after.employees, ...after.outsourcers];
      const affected = new Set(previous.filter((worker) => changedAll || !next.some((row) => row.workerId === worker.workerId && equal(row, worker))).map((worker) => worker.workerId));
      for (const worker of next) if (changedAll || !previous.some((row) => row.workerId === worker.workerId && equal(row, worker))) affected.add(worker.workerId);
      if (!changedAll && affected.size === 0) return after;
      const snapshot = await transaction.get(firestore.collection(`${root}/ArrangementNotifications`).where("siteOperationScheduleId", "==", id));
      for (const doc of snapshot.docs) {
        const raw = doc.data();
        notificationEmployeeReferences(raw);
        if (raw.docId !== doc.id || raw.siteOperationScheduleId !== id) fail();
        if (changedAll || affected.has(raw.workerId)) {
          const path = `${root}/ArrangementNotifications/${doc.id}`;
          readCache.set(path, raw);
          (await plan(path, "notification")).after = null;
        }
      }
      if (after === null) return null;
      const value = { ...after };
      for (const array of ["employees", "outsourcers"]) value[array] = after[array].map((worker) => (changedAll || affected.has(worker.workerId)) ? { ...worker, hasNotification: false } : worker);
      value.workers = [...value.employees, ...value.outsourcers];
      return value;
    }
    const results = [];
    for (const command of commands) {
      const { kind, action, documentId, changes } = command;
      const path = `${root}/${collectionFor(kind)}/${documentId}`;
      const target = await plan(path, kind === "schedule" ? "schedule" : "result");
      let raw = target.after;
      if (action === "duplicate") {
        if (raw !== null) fail("already-exists");
        const source = await read(`${root}/${collectionFor(kind)}/${command.sourceId}`);
        if (source === null || source.docId !== command.sourceId) fail("not-found");
        operationEmployeeReferences(source, kind === "schedule" ? { scheduleId: command.sourceId } : {});
        assertOperationExpected(source, command);
        if (kind !== "schedule" && source.isLocked !== false) fail("failed-precondition");
        const Schema = kind === "schedule" ? SiteOperationSchedule : OperationResult;
        const model = operationDateTime(new Schema(rawForClass(source))), before = model.toObject();
        model.docId = documentId; model.dateAt = changes.dateAt;
        if (kind === "schedule") {
          model.operationResultId = null;
          for (const worker of model.workers) { worker.siteOperationScheduleId = documentId; worker.hasNotification = false; }
        } else model.siteOperationScheduleId = null;
        let created = mergeCalculated(source, before, model.toObject());
        const site = await requireSite(created.siteId);
        if (created.securityType === "UNSET") created = { ...created, securityType: site.securityType };
        if (kind === "schedule") {
          await guardScheduleSite(created.siteId, command.siteStatuses?.[created.siteId]);
          const existing = await transaction.get(firestore.collection(`${root}/SiteOperationSchedules`).where("siteId", "==", created.siteId).where("shiftType", "==", created.shiftType).where("date", "==", created.date).orderBy("displayOrder", "desc").limit(1));
          const order = existing.docs.length ? existing.docs[0].data().displayOrder : -1;
          if (typeof order !== "number" || !Number.isFinite(order)) fail();
          created = { ...created, displayOrder: order + 1 };
          try { operationDateTime(new SiteOperationSchedule(rawForClass(created))).validate(); } catch { fail("invalid-argument"); }
        } else created = await applySiteAgreement(created, kind);
        target.after = created;
      } else if (action === "create") {
        if (raw !== null) fail("already-exists");
        assertOperationExpected(null, command);
        const Schema = kind === "schedule" ? SiteOperationSchedule : OperationResult;
        const model = operationDateTime(new Schema({ ...changes, docId: documentId }));
        if (kind === "schedule") { try { model.validate(); } catch { fail("invalid-argument"); } }
        raw = model.toObject();
        const site = await requireSite(raw.siteId);
        if (raw.securityType === "UNSET") raw.securityType = site.securityType;
        if (kind === "schedule") {
          raw.operationResultId = null;
          await guardScheduleSite(raw.siteId, command.siteStatuses?.[raw.siteId]);
          const existing = await transaction.get(firestore.collection(`${root}/SiteOperationSchedules`).where("siteId", "==", raw.siteId).where("shiftType", "==", raw.shiftType).where("date", "==", raw.date).orderBy("displayOrder", "desc").limit(1));
          if (existing.docs.length) {
            const order = existing.docs[0].data().displayOrder;
            if (typeof order !== "number" || !Number.isFinite(order)) fail();
            raw.displayOrder = order + 1;
          }
        } else raw = await applySiteAgreement(raw, kind);
        target.after = raw;
      } else {
        if (raw === null) fail("not-found");
        if (raw.docId !== documentId) fail();
        // For several disjoint operations on one existing target, all expectations
        // refer to the same original snapshot, while patches accumulate on latest.
        assertOperationExpected(target.before ?? raw, command);
        let rowCommand = command, positions = null;
        if (["workers", "articles"].includes(action)) {
          if (target.before === null) {
            // A newly created target has no original rows. Only explicit adds
            // against the immediately preceding create/add candidate are valid.
            if (command.rowAction !== "add") fail("invalid-argument");
          } else {
            const key = `${path}/${command.array}`;
            const originalRows = target.before[command.array];
            if (!Array.isArray(originalRows)) fail();
            if (!rowPositions.has(key)) rowPositions.set(key, originalRows.map((_, index) => index));
            positions = rowPositions.get(key);
            let position;
            if (command.rowAction === "add") {
              if (command.position > originalRows.length) fail("invalid-argument");
              position = positions.indexOf(command.position);
              if (position < 0) {
                const next = positions.filter((index) => index !== null && index > command.position).sort((a, b) => a - b)[0];
                position = next === undefined ? -1 : positions.indexOf(next);
              }
              if (position < 0) position = positions.length;
            } else {
              position = positions.indexOf(command.position);
              if (position < 0) fail("invalid-argument");
            }
            rowCommand = { ...command, position };
            if (command.rowAction === "move") {
              const destination = positions.indexOf(command.destination);
              if (destination < 0) fail("invalid-argument");
              rowCommand.destination = destination;
            }
          }
        }
        let after = applyOperationCommand(raw, rowCommand);
        if (positions) {
          if (command.rowAction === "remove") positions.splice(rowCommand.position, 1);
          if (command.rowAction === "add") positions.splice(rowCommand.position, 0, null);
          if (command.rowAction === "move") positions.splice(rowCommand.destination, 0, positions.splice(rowCommand.position, 1)[0]);
        }
        if (kind === "schedule" && action === "overview" && ["siteId", "dateAt"].some((field) => !equal(raw[field], after[field]))) {
          for (const id of new Set([raw.siteId, after.siteId])) await guardScheduleSite(id, command.siteStatuses?.[id]);
        }
        if (kind !== "schedule" && after !== null && ["siteId", "dateAt", "shiftType"].some((field) => !equal(raw[field], after[field]))) after = await applySiteAgreement(after, kind);
        if (kind === "billing" && action === "agreement") {
          const siteRaw = await requireSite(raw.siteId);
          if (!Array.isArray(siteRaw.agreementsV2)) fail();
          const site = new Site(rawForClass(siteRaw));
          const selected = changes.agreementKey === null ? [] : site.agreementsV2.filter((item) => item.key === changes.agreementKey);
          if (Object.hasOwn(changes, "agreementKey") && changes.agreementKey !== null && selected.length !== 1) fail("failed-precondition", "取極めを選び直してください。");
          after = calculateOperation(raw, kind, (model) => {
            if (Object.hasOwn(changes, "agreementKey")) model.agreement = changes.agreementKey === null ? null : selected[0];
            if (Object.hasOwn(changes, "billingDateAt")) model.billingDateAt = changes.billingDateAt;
          }).value;
        }
        if (kind === "schedule" && !["notify", "convert"].includes(action)) after = await cancelNotifications(documentId, raw, after);
        if (kind === "schedule" && ["notify", "convert"].includes(action)) {
          const workers = [...raw.employees, ...raw.outsourcers];
          const notifications = new Map();
          for (const worker of workers) {
            const id = `${documentId}_${worker.workerId}`;
            const notification = await read(`${root}/ArrangementNotifications/${id}`);
            if (notification !== null) {
              notificationEmployeeReferences(notification);
              if (notification.docId !== id || notification.siteId !== raw.siteId || notification.id !== worker.id || notification.isEmployee !== worker.isEmployee || notification.siteOperationScheduleId !== documentId) fail();
            }
            notifications.set(id, notification);
          }
          if (action === "notify") {
            const employees = [], outsourcers = [];
            for (const array of ["employees", "outsourcers"]) for (const worker of raw[array]) {
              if (typeof worker.hasNotification !== "boolean") fail();
              if (!worker.hasNotification) {
                await requireSite(worker.siteId);
                const id = `${documentId}_${worker.workerId}`;
                if (notifications.get(id) !== null) fail("failed-precondition", "予定と通知の状態が一致しません。最新情報を確認してください。");
                const notification = operationDateTime(new ArrangementNotification({ ...rawForClass(worker), actualStartTime: worker.startTime, actualEndTime: worker.endTime, actualBreakMinutes: worker.breakMinutes, shouldNotify: changes.shouldNotify })).toObject();
                try { operationDateTime(new ArrangementNotification(notification)).validate(); } catch { fail("invalid-argument"); }
                notification.docId = id;
                (await plan(`${root}/ArrangementNotifications/${id}`, "notification")).after = { ...(notifications.get(id) || {}), ...notification };
              }
              (array === "employees" ? employees : outsourcers).push(worker.hasNotification ? worker : { ...worker, hasNotification: true });
            }
            after = { ...raw, employees, outsourcers, workers: [...employees, ...outsourcers] };
          } else {
            const expectations = Object.fromEntries([...notifications].map(([id, notification]) => [id, notificationExpectation(notification)]));
            if (!equal(expectations, command.notifications)) fail("aborted", "通知が更新されました。実績化の内容を読み直してください。");
            const site = await requireSite(raw.siteId);
            if (site.isTemporary !== false) fail();
            const result = await plan(`${root}/OperationResults/${documentId}`, "result");
            if (result.before !== null || result.after !== null) fail("already-exists");
            const convert = (worker) => {
              const notification = notifications.get(`${documentId}_${worker.workerId}`);
              if (notification === null) return worker;
              for (const key of ["isQualified", "isOjt"]) if (typeof notification[key] !== "boolean") fail();
              for (const key of ["actualStartTime", "actualEndTime"]) if (notification[key] != null && typeof notification[key] !== "string") fail();
              if (notification.actualBreakMinutes != null && (typeof notification.actualBreakMinutes !== "number" || !Number.isFinite(notification.actualBreakMinutes))) fail();
              if (notification.actualIsStartNextDay != null && typeof notification.actualIsStartNextDay !== "boolean") fail();
              const calculated = operationDateTime(new OperationResultDetail(rawForClass(worker)));
              const before = calculated.toObject();
              Object.assign(calculated, { startTime: notification.actualStartTime ?? worker.startTime, endTime: notification.actualEndTime ?? worker.endTime, breakMinutes: notification.actualBreakMinutes ?? worker.breakMinutes, isStartNextDay: notification.actualIsStartNextDay ?? worker.isStartNextDay, isQualified: notification.isQualified, isOjt: notification.isOjt });
              try { calculated.validate(); } catch { fail("invalid-argument"); }
              return mergeCalculated(worker, before, calculated.toObject());
            };
            const employees = raw.employees.map(convert), outsourcers = raw.outsourcers.map(convert);
            const model = operationDateTime(new OperationResult({ ...rawForClass(raw), employees: rawForClass(employees), outsourcers: rawForClass(outsourcers), siteOperationScheduleId: documentId }));
            try { for (const worker of model.workers) worker.validate(); } catch { fail("invalid-argument"); }
            const created = model.toObject();
            for (const key of Object.keys(created)) if (equal(rawForClass(raw[key]), created[key])) created[key] = raw[key];
            Object.assign(created, { employees, outsourcers, workers: [...employees, ...outsourcers] });
            result.after = await applySiteAgreement(created, "result");
            after = { ...raw, operationResultId: documentId };
          }
        }
        target.after = after;
      }
      results.push({ documentId, ...(action === "convert" ? { resultId: documentId } : {}) });
    }
    const referencePlans = [...plans.values()].map((entry) => ({ ...entry, references: entry.referenceKind === "notification" ? notificationEmployeeReferences : (raw) => operationEmployeeReferences(raw, entry.referenceKind === "schedule" ? { scheduleId: entry.path.split("/").at(-1) } : {}) }));
    await readAddedEmployees(transaction, firestore, identity.companyId, referencePlans);
    let updated = false;
    const audit = { uid: identity.uid, updatedAt: timestamp() };
    for (const entry of plans.values()) {
      if (equal(entry.before, entry.after)) continue;
      updated = true;
      const ref = firestore.doc(entry.path);
      if (entry.after === null) transaction.delete(ref);
      else if (entry.before === null) transaction.create(ref, { ...entry.after, ...audit, createdAt: timestamp() });
      else {
        const patch = Object.fromEntries(Object.entries(entry.after).filter(([key, value]) => !equal(entry.before[key], value)));
        transaction.update(ref, { ...patch, ...audit });
      }
    }
    for (const [id, revision] of siteRevisions) transaction.update(firestore.doc(`${root}/Sites/${id}`), { scheduleRevision: revision, ...audit });
    return { success: true, updated, results };
  });
}
