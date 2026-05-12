/*****************************************************************************
 * Employee document deleted trigger
 *****************************************************************************/
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { User } from "@shisyamo4131/air-guard-v2-schemas";

/**
 * Triggered when an Employee document is deleted.
 * - Deletes the corresponding User document if exists.
 * - Searches for User by employeeId field.
 * - Admin users cannot be deleted (User.delete() will throw error).
 */
export const onEmployeeDeleted = onDocumentDeleted(
  "Companies/{companyId}/Employees/{docId}",
  async (event) => {
    const { companyId, docId } = event.params;
    const prefix = `Companies/${companyId}`;

    logger.info(`Employee deleted: ${docId} in company ${companyId}`);

    try {
      // Search for User with matching employeeId
      const userInstance = new User();
      const users = await userInstance.fetchDocs({
        constraints: [["where", "employeeId", "==", docId]],
        prefix,
      });

      if (users.length === 0) {
        logger.info(`No user found for employee ${docId}`);
        return;
      }

      const user = users[0];

      // User.delete() will throw error if user is admin
      await user.delete({ prefix });

      logger.info(`Deleted user ${user.docId} for employee ${docId}`);
    } catch (error) {
      logger.error({
        message: `Failed to delete user for employee ${docId}`,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  },
);
