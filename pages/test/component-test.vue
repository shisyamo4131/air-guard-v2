<script setup>
import { Employee } from "@/schemas";

const instance = reactive(new Employee());
const data = reactive(["a7"]);
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-container>
      <v-table>
        <thead>
          <tr>
            <th v-for="field of instance.constructor.schema" :key="field.key">
              {{ field.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) of data" :key="index">
            <td v-for="field of instance.constructor.schema" :key="field.key">
              <component :is="field.component.name" />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-container>
  </TemplatesFixedHeightContainer>
</template>
