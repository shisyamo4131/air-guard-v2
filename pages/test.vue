<script setup>
// import { collection, getDocs, updateDoc } from "firebase/firestore";
// import { useAuthStore } from "@/stores/useAuthStore";

// const { $firestore } = useNuxtApp();
// const auth = useAuthStore();
// const companyId = auth.companyId;

// onMounted(async () => {
//   const colRef = collection($firestore, `Companies/${companyId}/Employees`);
//   const snapshot = await getDocs(colRef);
//   snapshot.forEach((doc) => {
//     if (doc.data().gender === "male") {
//       updateDoc(doc.ref, { gender: "MALE" });
//     } else if (doc.data().gender === "female") {
//       updateDoc(doc.ref, { gender: "FEMALE" });
//     }
//   });
// });
</script>

<template>
  <v-container> </v-container>
</template>
