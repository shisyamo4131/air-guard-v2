import { Employee } from "@shisyamo4131/air-guard-v2-schemas";
import { FieldValue, GeoPoint } from "firebase-admin/firestore";
import { ADDRESS_FIELDS, INSURANCE_KINDS, EmployeeOperationError, employeeAllowed, parseEmployeeInput, assertExpected, buildEmployeePatch, equal } from "../../shared/employeeContract.js";
import { parseEmployeeInsuranceInput, prepareEmployeeInsurance } from "../../shared/employeeInsuranceContract.js";

export async function saveEmployee({ firestore, resolveIdentity, input, operation, geocode, timestamp = () => FieldValue.serverTimestamp() }) {
  const parsed = operation === "insurance" ? parseEmployeeInsuranceInput(input) : parseEmployeeInput(operation, input);
  const identity = await resolveIdentity();
  const root = `Companies/${identity.companyId}`;
  const employeeRef = firestore.doc(`${root}/Employees/${parsed.employeeId}`);
  const archiveRef = firestore.doc(`${root}/Employees_archive/${parsed.employeeId}`);
  const actorRef = firestore.doc(`${root}/Users/${identity.uid}`);
  async function inspect(transaction, currentIdentity) {
    if (currentIdentity.uid !== identity.uid || currentIdentity.companyId !== identity.companyId) throw new EmployeeOperationError("permission-denied");
    const actor = await transaction.get(actorRef);
    if (!actor.exists || !employeeAllowed({ ...currentIdentity, actorUser: actor.data() })) throw new EmployeeOperationError("permission-denied");
    const snapshot = await transaction.get(employeeRef);
    if (operation === "create") {
      const archive = await transaction.get(archiveRef);
      if (snapshot.exists || archive.exists) throw new EmployeeOperationError("already-exists", "同じ登録先が既に存在します。登録結果を確認してください。");
      if (Object.keys(parsed.expected).length) throw new EmployeeOperationError("invalid-argument");
      const initial = new Employee().toObject();
      initial.employmentStatus = "ACTIVE";
      const { model } = buildEmployeePatch(initial, parsed.changes, operation);
      const value = model.toObject();
      return { raw: null, patch: { ...value, geopoint: null, location: null, insuranceOperationVersions: Object.fromEntries(INSURANCE_KINDS.map((kind) => [kind, 0])) }, model };
    }
    if (!snapshot.exists) throw new EmployeeOperationError("not-found");
    const raw = snapshot.data();
    if (raw.docId !== parsed.employeeId || raw.employmentStatus !== "ACTIVE") throw new EmployeeOperationError("failed-precondition", "在職中の従業員だけを編集できます。");
    if (operation === "insurance") {
      const prepared = prepareEmployeeInsurance(raw, parsed);
      const patch = Object.fromEntries(Object.entries(prepared.mapChanges).map(([field, value]) => [`${parsed.kind}.${field}`, value === undefined ? FieldValue.delete() : value]));
      if (prepared.legacyVersions) patch.insuranceOperationVersions = prepared.versions;
      else patch[`insuranceOperationVersions.${parsed.kind}`] = prepared.versions[parsed.kind];
      return { raw, patch };
    }
    assertExpected(raw, parsed.changes, parsed.expected, operation);
    return { raw, ...buildEmployeePatch(raw, parsed.changes, operation, parsed) };
  }
  // Preflight authorizes and validates before any external request. It writes nothing.
  const before = await firestore.runTransaction((transaction) => inspect(transaction, identity));
  const needsCoordinates = operation === "create" || ADDRESS_FIELDS.some((field) => Object.hasOwn(before.patch, field));
  let coordinates = null;
  if (needsCoordinates) {
    try { coordinates = await geocode(before.model.fullAddress); } catch { coordinates = null; }
    if (!coordinates || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng) || Math.abs(coordinates.lat) > 90 || Math.abs(coordinates.lng) > 180 || typeof coordinates.formattedAddress !== "string") coordinates = null;
  }
  const result = await firestore.runTransaction(async (transaction) => {
    // Auth is outside Firestore; revalidate it on every final transaction attempt.
    const currentIdentity = await resolveIdentity();
    const current = await inspect(transaction, currentIdentity);
    if (!needsCoordinates && ADDRESS_FIELDS.some((field) => Object.hasOwn(current.patch, field))) throw new EmployeeOperationError("aborted", "住所が更新されました。最新値を読み直してください。");
    if (needsCoordinates && (ADDRESS_FIELDS.some((field) => !equal(current.raw?.[field], before.raw?.[field])) || !equal(current.model.fullAddress, before.model.fullAddress))) throw new EmployeeOperationError("aborted", "住所が更新されました。最新値を読み直してください。");
    if (Object.keys(current.patch).length === 0) return { success: true, updated: false, employeeId: parsed.employeeId, warning: null };
    if (needsCoordinates) {
      current.patch.location = coordinates;
      current.patch.geopoint = coordinates ? new GeoPoint(coordinates.lat, coordinates.lng) : null;
    }
    const audit = { uid: identity.uid, updatedAt: timestamp() };
    if (operation === "create") transaction.create(employeeRef, { ...current.patch, ...audit, docId: parsed.employeeId, createdAt: timestamp() });
    else transaction.update(employeeRef, { ...current.patch, ...audit });
    return { success: true, updated: true, employeeId: parsed.employeeId, warning: needsCoordinates && !coordinates ? "住所を保存しました。地図座標は取得できませんでした。" : null };
  });
  return result;
}
