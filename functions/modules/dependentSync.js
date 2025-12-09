import { getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/firestore";
import { logger } from "firebase-functions";

/**
 * Schema package cache for cold start optimization
 * - Dynamically imports the entire schema package only once
 * - All classes are available from the cached package
 */
let schemaPackage = null;

/**
 * Get a schema class with caching to improve cold start performance.
 * - First call: Dynamically imports and caches the entire package
 * - Subsequent calls: Returns class from cached package
 * @param {string} className - The name of the schema class (e.g., "Customer", "Site")
 * @returns {Promise<Class>} - The schema class constructor
 * @throws {Error} - Throws if the schema class is not found
 */
async function getSchemaClass(className) {
  // Import and cache the schema package on first call
  if (!schemaPackage) {
    schemaPackage = await import("@shisyamo4131/air-guard-v2-schemas");
    logger.info("[getSchemaClass] Schema package imported and cached");
  }

  // Check if the requested class exists in the cached package
  if (!schemaPackage[className]) {
    throw new Error(
      `Schema class "${className}" not found in @shisyamo4131/air-guard-v2-schemas`
    );
  }

  // Return the requested class from the cached package
  return schemaPackage[className];
}

/**
 * Triggered when a Customer document is updated.
 * - Updates all Sites that reference this Customer with the new data.
 */
export const onUpdateCustomer = onDocumentUpdated(
  "Companies/{companyId}/Customers/{customerId}",
  async (event) => {
    const companyId = event.params.companyId;
    const customerId = event.params.customerId;
    const data = event.data.after.data();

    logger.info(
      `[onUpdateCustomer] Customer updated: ${customerId} in Company: ${companyId}`
    );

    try {
      const updatedCount = await syncCustomersInSites({
        companyId,
        customerId,
        customerData: data,
      });

      logger.info(
        `[onUpdateCustomer] Successfully synced ${updatedCount} Sites for Customer ${customerId} in Company ${companyId}`
      );
    } catch (error) {
      logger.error(
        `[onUpdateCustomer] Failed to sync Sites for Customer ${customerId} in Company ${companyId}:`,
        error
      );
      throw error;
    }

    return null;
  }
);

/**
 * Sync updated Customer data to Sites that reference it.
 * @param {Object} params
 * @param {string} params.companyId - The ID of the company.
 * @param {string} params.customerId - The ID of the updated customer.
 * @param {Object} params.customerData - The updated customer data.
 * @returns {Promise<number>} - The number of Sites updated.
 * @throws {Error} - Throws if Customer model instantiation or batch update fails.
 */
async function syncCustomersInSites({ companyId, customerId, customerData }) {
  const db = getFirestore();
  const colRef = db.collection(`Companies/${companyId}/Sites`);
  const queryRef = colRef.where("customerId", "==", customerId);
  const snapshot = await queryRef.get();

  if (snapshot.empty) {
    logger.info(
      `[syncCustomersInSites] No Sites found for Customer ${customerId} in Company ${companyId}`
    );
    return 0;
  }

  logger.info(
    `[syncCustomersInSites] Found ${snapshot.size} Sites for Customer ${customerId} in Company ${companyId}`
  );

  try {
    const Customer = await getSchemaClass("Customer");
    const customerModel = new Customer(customerData);
    const docRefs = snapshot.docs.map((doc) => doc.ref);

    await batchUpdateDocuments({
      docRefs,
      updateData: { customer: customerModel.toObject() },
    });

    logger.info(
      `[syncCustomersInSites] Updated ${docRefs.length} Sites for Customer ${customerId} in Company ${companyId}`
    );

    return docRefs.length;
  } catch (error) {
    logger.error(
      `[syncCustomersInSites] Error syncing Customer ${customerId} in Company ${companyId} to Sites:`,
      error
    );
    throw error;
  }
}

/**
 * Update documents in batches.
 * @param {Object} params
 * @param {Array} params.docRefs - Array of document references to update.
 * @param {Object} params.updateData - Data to update in each document.
 * @param {number} [params.batchSize=300] - Number of updates per batch.
 * @throws {Error} - Throws if batch commit fails.
 */
async function batchUpdateDocuments({ docRefs, updateData, batchSize = 300 }) {
  if (!docRefs || docRefs.length === 0) {
    logger.warn("[batchUpdateDocuments] No documents to update");
    return;
  }

  const db = getFirestore();
  const batchArray = [];

  docRefs.forEach((docRef, index) => {
    if (index % batchSize === 0) batchArray.push(db.batch());
    batchArray[batchArray.length - 1].update(docRef, updateData);
  });

  try {
    await Promise.all(batchArray.map((batch) => batch.commit()));
    logger.info(
      `[batchUpdateDocuments] Successfully updated ${docRefs.length} documents in ${batchArray.length} batches`
    );
  } catch (error) {
    logger.error(
      `[batchUpdateDocuments] Failed to commit batches (${docRefs.length} documents):`,
      error
    );
    throw error;
  }
}
