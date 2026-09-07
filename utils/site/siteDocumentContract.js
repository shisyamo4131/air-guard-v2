export const SITE_DOCUMENT_FIELDS = Object.freeze([
  "docId", "uid", "createdAt", "updatedAt", "customerId", "customer",
  "customerName", "code", "name", "hasAbbreviation", "abbreviation",
  "nameKana", "zipcode", "prefCode", "city", "address", "building",
  "securityType", "siteNumber", "constructionPeriodStartAt",
  "constructionPeriodEndAt", "location", "remarks", "agreementsV2", "status",
  "fullAddress", "prefecture", "isTemporary", "hasConstructionPeriod",
  "hasConstructionPeriodStartAt", "hasConstructionPeriodEndAt", "displayName",
  "tokenMap", "geopoint",
]);

export const SITE_DERIVED_FIELDS = Object.freeze([
  "customer", "location", "geopoint", "fullAddress", "prefecture",
  "isTemporary", "hasConstructionPeriod", "hasConstructionPeriodStartAt",
  "hasConstructionPeriodEndAt", "displayName", "tokenMap",
]);
