/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/getEmployeeReinstatementContext.js
 * @description UWB-07C UIへ最新退職operationの最小contextだけを返します。
 *****************************************************************************/
import {
  assertEmployeeReinstatementActor,
  assertEmployeeReinstatementTarget,
  resolveEmployeeReinstatementContextInput,
} from "../policies/userLifecyclePolicy.js";
import {
  employeeLifecycleHeadPath,
  LIFECYCLE_DOMAIN_ERROR_CODES,
  lifecycleOperationPath,
} from "./lifecycleOperationSchema.js";
import {
  assertEmployeeReinstatementNoUserRelationship,
  assertEmployeeReinstatementSourceAndHead,
  REINSTATE_EMPLOYEE_ERROR_CODES,
  ReinstateEmployeeError,
} from "./reinstateEmployee.js";

function fail(code, message, domainCode) {
  throw new ReinstateEmployeeError(code, message, { domainCode });
}

function assertDependencies(firestore) {
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function"
  ) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.DEPENDENCY_INVALID,
      "[getEmployeeReinstatementContext] Firestore dependency is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL,
    );
  }
}

function assertIdentity(identity) {
  if (
    !identity ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    typeof identity.uid !== "string" ||
    !identity.uid ||
    typeof identity.companyId !== "string" ||
    !identity.companyId ||
    identity.isSuperUser !== false
  ) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
      "[getEmployeeReinstatementContext] verified identity is invalid",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
}

export async function getEmployeeReinstatementContext({
  firestore,
  identity,
  input,
} = {}) {
  assertDependencies(firestore);
  assertIdentity(identity);
  const normalizedInput = resolveEmployeeReinstatementContextInput(input);
  const companyId = identity.companyId;
  const employeeId = normalizedInput.employeeId;
  const actorRef = firestore.doc(`Companies/${companyId}/Users/${identity.uid}`);
  const employeeRef = firestore.doc(`Companies/${companyId}/Employees/${employeeId}`);
  const headRef = firestore.doc(employeeLifecycleHeadPath(companyId, employeeId));
  const reservationRef = firestore.doc(
    `Companies/${companyId}/EmployeeUserReservations/${employeeId}`,
  );
  const usersQuery = firestore
    .collection(`Companies/${companyId}/Users`)
    .where("employeeId", "==", employeeId)
    .limit(1);

  const [
    actorSnapshot,
    employeeSnapshot,
    headSnapshot,
    reservationSnapshot,
    usersSnapshot,
  ] = await Promise.all([
    actorRef.get(),
    employeeRef.get(),
    headRef.get(),
    reservationRef.get(),
    usersQuery.get(),
  ]);

  if (!actorSnapshot.exists) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.IDENTITY_INVALID,
      "[getEmployeeReinstatementContext] actor User was not found",
      LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_INVALID,
    );
  }
  assertEmployeeReinstatementActor({
    companyId,
    actorUser: actorSnapshot.data(),
  });
  if (!employeeSnapshot.exists) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.TARGET_NOT_FOUND,
      "[getEmployeeReinstatementContext] Employee was not found",
      LIFECYCLE_DOMAIN_ERROR_CODES.TARGET_NOT_FOUND,
    );
  }
  assertEmployeeReinstatementTarget({ employee: employeeSnapshot.data() });
  assertEmployeeReinstatementNoUserRelationship({
    reservationSnapshot,
    usersSnapshot,
  });
  if (!headSnapshot.exists) {
    fail(
      REINSTATE_EMPLOYEE_ERROR_CODES.LATEST_OPERATION_MISMATCH,
      "[getEmployeeReinstatementContext] lifecycle head was not found",
      LIFECYCLE_DOMAIN_ERROR_CODES.LATEST_OPERATION_MISMATCH,
    );
  }

  const head = headSnapshot.data();
  const sourceSnapshot = await firestore
    .doc(lifecycleOperationPath(companyId, head.latestOperationId))
    .get();
  const source = assertEmployeeReinstatementSourceAndHead({
    sourceSnapshot,
    currentHead: head,
    employeeId,
    reversesOperationId: head.latestOperationId,
  });

  return Object.freeze({
    eligible: true,
    employeeId,
    reversesOperationId: source.operationId,
    requiresUserReprovisioning: source.targetUserUid !== null,
  });
}
