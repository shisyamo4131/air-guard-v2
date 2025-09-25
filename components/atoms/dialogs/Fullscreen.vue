<script setup>
/**
 * @file components/atoms/dialogs/Fullscreen.vue
 * @description A dialog component that switches to fullscreen mode on mobile devices.
 */
import { useDisplay } from "vuetify";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { mobile } = useDisplay();
</script>

<template>
  <v-dialog :fullscreen="mobile">
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </v-dialog>
</template>
