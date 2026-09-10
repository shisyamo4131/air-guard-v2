import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Customer } from "@/schemas";
import { CUSTOMER_DOCUMENT_FIELDS } from "./customerDocumentContract.js";

function customerCollection(firestore, companyId) {
  return collection(firestore, "Companies", companyId, "Customers");
}

function serializeCustomer(customer) {
  return Customer.converter().toFirestore(customer);
}

function pick(source, fields) {
  return Object.fromEntries(
    fields.map((field) => {
      if (!Object.prototype.hasOwnProperty.call(source, field)) {
        throw new Error(`取引先の保存項目 ${field} を生成できません。`);
      }
      return [field, source[field]];
    }),
  );
}

export function createCustomerWriter({ firestore }) {
  if (!firestore) throw new Error("Firestoreを利用できません。");

  function reserveDocument(companyId) {
    return doc(customerCollection(firestore, companyId));
  }

  async function create({ documentReference, customer }) {
    const data = pick(serializeCustomer(customer), CUSTOMER_DOCUMENT_FIELDS);
    data.createdAt = serverTimestamp();
    data.updatedAt = serverTimestamp();
    await setDoc(documentReference, data);
    return customer;
  }

  async function update({ companyId, customer }) {
    const data = pick(serializeCustomer(customer), CUSTOMER_DOCUMENT_FIELDS);
    data.createdAt = customer.createdAt;
    data.updatedAt = serverTimestamp();
    await setDoc(
      doc(customerCollection(firestore, companyId), customer.docId),
      data,
    );
    return { updated: true, fields: [...CUSTOMER_DOCUMENT_FIELDS] };
  }

  return { reserveDocument, create, update };
}
