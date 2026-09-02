import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Customer } from "@/schemas";
import {
  CUSTOMER_ADDRESS_FIELDS,
  CUSTOMER_NAME_FIELDS,
  CUSTOMER_OPERATION,
} from "@/composables/domain/customer/customerOperations";

const CREATE_FIELDS = Object.freeze([
  "docId",
  "uid",
  "createdAt",
  "updatedAt",
  "code",
  "name",
  "branchName",
  "abbreviation",
  "nameKana",
  "zipcode",
  "prefCode",
  "city",
  "address",
  "building",
  "location",
  "geopoint",
  "tel",
  "fax",
  "contractStatus",
  "cutoffDate",
  "paymentMonth",
  "paymentDate",
  "remarks",
  "fullAddress",
  "prefecture",
  "tokenMap",
]);

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
    const data = pick(serializeCustomer(customer), CREATE_FIELDS);
    data.createdAt = serverTimestamp();
    data.updatedAt = serverTimestamp();
    await setDoc(documentReference, data);
    return customer;
  }

  async function update({ companyId, operation, customer, fields }) {
    if (!fields.length) {
      return { updated: false, fields: [] };
    }

    const serialized = serializeCustomer(customer);
    const patchFields = new Set(fields);
    if (
      operation === CUSTOMER_OPERATION.UPDATE_BASIC &&
      fields.some((field) => CUSTOMER_NAME_FIELDS.includes(field))
    ) {
      patchFields.add("tokenMap");
    }
    if (
      operation === CUSTOMER_OPERATION.UPDATE_BASIC &&
      fields.some((field) => CUSTOMER_ADDRESS_FIELDS.includes(field))
    ) {
      patchFields.add("location");
      patchFields.add("geopoint");
      patchFields.add("fullAddress");
      patchFields.add("prefecture");
    }

    const patch = pick(serialized, [...patchFields]);
    patch.uid = customer.uid;
    patch.updatedAt = serverTimestamp();
    await updateDoc(
      doc(customerCollection(firestore, companyId), customer.docId),
      patch,
    );
    return { updated: true, fields: [...patchFields] };
  }

  return { reserveDocument, create, update };
}
