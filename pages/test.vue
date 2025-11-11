<script setup>
import { doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import { OperationResult } from "@/schemas";
import { onMounted, onUnmounted } from "vue";

const operationResult = reactive(new OperationResult());

async function rollback() {
  const { $firestore } = useNuxtApp();
  const companyPath = "Companies/Qa1JpI7dLMjIXeW3lB2m";
  const docId = "2pom9ODWlpxdgsBiwSz7";
  const operationResultDocRef = doc(
    $firestore,
    `${companyPath}/OperationResults`,
    docId
  );
  await deleteDoc(operationResultDocRef);
  const siteOperationScheduleDocRef = doc(
    $firestore,
    `${companyPath}/SiteOperationSchedules`,
    docId
  );
  await updateDoc(siteOperationScheduleDocRef, {
    operationResultId: null,
  });
}

function setNewTime() {
  operationResult.regulationWorkMinutes = 500;
}

onMounted(() => {
  operationResult.subscribe({ docId: "2pom9ODWlpxdgsBiwSz7" });
});

onUnmounted(() => {
  operationResult.unsubscribe();
});
</script>

<template>
  <v-container>
    <v-card>
      <v-card-text>
        {{ operationResult.employees }}
      </v-card-text>
      <v-card-actions>
        <v-btn @click="rollback">ロールバック</v-btn>
        <v-btn @click="setNewTime">Set</v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>
