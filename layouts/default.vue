<script setup>
import { useDisplay } from "vuetify";
import { useAuthStore } from "@/stores/useAuthStore";

const drawer = ref(false);
const { lgAndUp } = useDisplay();
const router = useRouter();
const auth = useAuthStore();

const handleSignOut = async () => {
  try {
    await auth.signOut();
    await router.push("/");
  } catch (error) {
    console.error("Failed to sign out:", error);
  }
};
</script>

<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>AirGuard</v-app-bar-title>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-model="drawer"
      :permanent="lgAndUp"
      :temporary="!lgAndUp"
      app
      width="240"
    >
      <v-list dense>
        <v-list-item title="Dashboard" to="/dashboard" />
        <v-list-item title="Users" to="/users" />
        <v-list-item title="Settings" to="/settings" />
      </v-list>

      <v-divider class="my-2" />

      <v-list-item
        title="Sign Out"
        @click="handleSignOut"
        prepend-icon="mdi-logout"
        class="text-error"
      />
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <NuxtPage />
    </v-main>

    <!-- Footer -->
    <v-footer app color="grey-darken-4" class="white--text text-center">
      <span class="mx-auto"
        >&copy; {{ new Date().getFullYear() }} AirGuard</span
      >
    </v-footer>
  </v-app>
</template>
