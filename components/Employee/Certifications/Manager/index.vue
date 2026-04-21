<script setup>
import { useBaseManager } from "@/composables/useBaseManager";
import { Certification } from "@/schemas";

const { attrs } = useBaseManager("EmployeeCertificationsManager");
</script>

<template>
  <air-array-manager v-bind="attrs" :schema="Certification" item-key="key">
    <template #table="{ items, toUpdate, toCreate }">
      <v-card>
        <v-toolbar color="secondary" density="compact" title="保有資格">
          <template #append>
            <v-btn icon="mdi-plus" size="small" @click="() => toCreate()" />
          </template>
        </v-toolbar>
        <v-card-text class="py-0">
          <EmployeeCertificationsTable
            :items="items"
            @click:update="(item) => toUpdate(item)"
          />
        </v-card-text>
      </v-card>
    </template>
  </air-array-manager>
</template>
