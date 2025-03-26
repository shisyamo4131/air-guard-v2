import FireModel from "air-firebase-v2";

export default class Company extends FireModel {
  static collectionPath = "Companies";
  static useAutonumber = false;
  static logicalDelete = false;
  static classProps = {
    name: { type: String, default: "", required: true },
    nameKana: { type: String, default: "", required: true },
    zipcode: { type: String, default: "", required: false },
    prefecture: { type: String, default: "", required: false },
    city: { type: String, default: "", required: false },
    address: { type: String, default: "", required: false },
    buiding: { type: String, default: "", required: false },
    tel: { type: String, default: "", required: false },
    fax: { type: String, default: "", required: false },
  };
}
