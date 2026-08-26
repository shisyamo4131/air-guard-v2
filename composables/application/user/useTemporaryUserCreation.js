import { createTemporaryUserCreationController } from "../../../utils/auth/temporaryUserCreationController.js";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useAuthFunctions } from "../../auth/useAuthFunctions";

export function useTemporaryUserCreation() {
  const auth = useAuthStore();
  const {
    createStandaloneTemporaryUser: requestStandalone,
    createEmployeeLinkedTemporaryUser: requestEmployeeLinked,
  } = useAuthFunctions();

  return createTemporaryUserCreationController({
    getContext: () => ({ companyId: auth.companyId, actorUser: auth.user }),
    requestStandalone,
    requestEmployeeLinked,
  });
}
