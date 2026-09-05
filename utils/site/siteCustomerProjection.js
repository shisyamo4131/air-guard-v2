// Exact runtime-minimal Customer projection embedded in a Site. The current
// application reads code/name/abbreviation/cutoffDate from Site.customer;
// docId and updatedAt bind that display/payment view to Customer identity and
// freshness without copying search, address, geocoding, or other master data.
export const SITE_CUSTOMER_PROJECTION_FIELDS = Object.freeze([
  "docId",
  "updatedAt",
  "code",
  "name",
  "abbreviation",
  "cutoffDate",
]);

export function createSiteCustomerProjection(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("取引先の埋込み情報を生成できません。");
  }
  return Object.fromEntries(
    SITE_CUSTOMER_PROJECTION_FIELDS.map((field) => {
      if (!Object.hasOwn(source, field)) {
        throw new Error(`取引先の埋込み項目 ${field} を生成できません。`);
      }
      return [field, source[field]];
    }),
  );
}
