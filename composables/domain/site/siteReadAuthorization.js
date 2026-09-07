export function canReadSite({ uid, companyId, isEmailVerified, user } = {}) {
  return Boolean(
    typeof uid === "string" &&
      uid &&
      typeof companyId === "string" &&
      companyId &&
      isEmailVerified === true &&
      user &&
      user.docId === uid &&
      user.companyId === companyId &&
      user.isTemporary === false &&
      user.disabled === false,
  );
}
