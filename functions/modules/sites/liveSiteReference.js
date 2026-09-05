const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function assertIdentifier(value, name) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128 ||
      value.trim() !== value || value.includes("/") || CONTROL_CHARACTERS.test(value)) {
    throw new Error(`${name} is invalid`);
  }
}

export async function assertLiveSiteReference({ firestore, transaction, companyId, siteId } = {}) {
  if (!firestore || typeof firestore.doc !== "function" ||
      !transaction || typeof transaction.get !== "function") {
    throw new Error("Firestore transaction is required");
  }
  assertIdentifier(companyId, "companyId");
  assertIdentifier(siteId, "siteId");
  const snapshot = await transaction.get(
    firestore.doc(`Companies/${companyId}/Sites/${siteId}`),
  );
  if (!snapshot?.exists) throw new Error(`Site not found: ${siteId}`);
  return snapshot;
}
