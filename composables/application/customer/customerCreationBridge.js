export function captureCustomerCreationScope(auth = {}) {
  return Object.freeze({
    companyId: typeof auth.companyId === "string" ? auth.companyId : null,
    uid: typeof auth.uid === "string" ? auth.uid : null,
  });
}

export function isCustomerCreationScopeCurrent(scope, currentScope) {
  return Boolean(
    scope?.companyId &&
      scope?.uid &&
      scope.companyId === currentScope?.companyId &&
      scope.uid === currentScope?.uid,
  );
}

export function initializeCommittedCustomerDraft(draft, created) {
  if (
    !created?.docId ||
    typeof created.toObject !== "function" ||
    typeof draft?.initialize !== "function"
  ) {
    return false;
  }
  draft.initialize(created.toObject());
  return true;
}

export function deliverCommittedCustomer({
  created,
  creationScope,
  currentScope,
  pushCustomer,
  selectCustomer,
}) {
  if (
    !created?.docId ||
    !isCustomerCreationScopeCurrent(creationScope, currentScope)
  ) {
    return false;
  }
  pushCustomer(created);
  selectCustomer(created);
  return true;
}
