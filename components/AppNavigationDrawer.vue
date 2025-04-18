<script setup>
import { computed } from "vue";
import { getNavigationItems } from "@/utils/pageSettings";

const auth = useAuthStore();

/**
 * ナビゲーション項目を生成 (新しい pageSettings.js に対応)
 * Generate navigation items based on user roles using the new function
 */
const navigationItems = computed(() => {
  return getNavigationItems(auth.roles);
});
</script>

<template>
  <v-navigation-drawer app>
    <v-list nav>
      <template v-for="item in navigationItems" :key="item.value">
        <v-list-group
          v-if="item.children && item.children.length > 0"
          :value="item.value"
        >
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              :prepend-icon="item.prependIcon"
              :title="item.title"
              :value="item.value"
              :to="item.to"
            ></v-list-item>
          </template>
          <v-list-item
            v-for="child in item.children"
            :key="child.value"
            :title="child.title"
            :value="child.value"
            :to="child.to"
            :prepend-icon="child.prependIcon"
          ></v-list-item>
        </v-list-group>
        <v-list-item
          v-else-if="!item.children"
          :title="item.title"
          :value="item.value"
          :to="item.to"
          :prepend-icon="item.prependIcon"
        ></v-list-item>
      </template>
    </v-list>
    <template #append>
      <slot name="append" />
    </template>
  </v-navigation-drawer>
</template>
