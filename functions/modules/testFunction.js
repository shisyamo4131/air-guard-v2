import { User } from "air-guard-v2-schemas";
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Cloud Functions で作成したモジュールをテストするためのAPIを提供
 */
export const testFunction = onRequest(
  {
    region: "asia-northeast1",
    cors: ["http://localhost:3000"],
  },
  async (req, res) => {
    const db = getFirestore();
    const user = new User();
    db.runTransaction(async (transaction) => {
      const docs = await user.fetchDocs({
        constraints: [["limit", 1]],
        prefix: "/Companies/Qa1JpI7dLMjIXeW3lB2m",
        transaction,
      });
      console.log(docs);
      res.json({ data: "ok" });
    });
  }
);
