<script setup>
import {
  collection,
  query,
  limit,
  runTransaction,
  getDocs,
} from "firebase/firestore";
const { $firestore } = useNuxtApp();
import { User } from "@/schemas/User.js";

const company = new User();

async function transactionTest() {
  try {
    await runTransaction($firestore, async (transaction) => {
      const docs = await company.fetchDocs({
        constraints: [["limit", 1]],
        transaction,
      });
      if (docs.length) {
        console.log(`Found ${docs.length} document(s).`);
        docs.forEach((doc) => {
          console.log("Document ID:", doc.docId, "Data:", doc);
        });
      } else {
        console.log("No documents found matching the query.");
      }
    });
    console.log("Transaction successfully committed!");
  } catch (e) {
    console.error("Transaction failed: ", e);
  }
}

async function nonTransactionQueryTest() {
  const companiesColRef = collection(
    $firestore,
    "/Companies/Qa1JpI7dLMjIXeW3lB2m/Users"
  );
  const q = query(companiesColRef, limit(1));
  try {
    console.log("Attempting non-transactional query...");
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      console.log(
        `[Non-Transaction] Found ${querySnapshot.docs.length} document(s).`
      );
      querySnapshot.forEach((doc) => {
        console.log(
          "[Non-Transaction] Document ID:",
          doc.id,
          "Data:",
          doc.data()
        );
      });
    } else {
      console.log("[Non-Transaction] No documents found matching the query.");
    }
    console.log("[Non-Transaction] Query successful!");
  } catch (e) {
    console.error("[Non-Transaction] Query failed: ", e);
  }
}
</script>

<template>
  <v-container>
    <v-btn @click="transactionTest">トランザクション実行</v-btn>
    <v-btn @click="nonTransactionQueryTest" class="ml-2"
      >非トランザクションクエリ実行</v-btn
    >
  </v-container>
</template>
