<script setup></script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" v-for="n in 20" :key="n">
        <v-card>
          <v-card-title>Component Test</v-card-title>
          <v-card-text>
            This is a test page for components. {{ height }}</v-card-text
          >
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
