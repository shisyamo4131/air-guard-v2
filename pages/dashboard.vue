<script setup></script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 font-weight-bold mb-6">ようこそ、AirGuardへ</h1>

    <!-- 概要カード -->
    <v-row class="mb-6" dense>
      <v-col cols="12" sm="4">
        <v-card>
          <v-card-title>本日のシフト</v-card-title>
          <v-card-text class="text-h5">8 件</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card>
          <v-card-title>未確認の報告書</v-card-title>
          <v-card-text class="text-h5">3 件</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card>
          <v-card-title>稼働中の拠点</v-card-title>
          <v-card-text class="text-h5">5 拠点</v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- リンクボタン -->
    <v-row dense>
      <v-col cols="12" sm="4">
        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/employees')"
          >スタッフ管理</v-btn
        >
      </v-col>
      <v-col cols="12" sm="4">
        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/sites')"
          >現場一覧</v-btn
        >
      </v-col>
      <v-col cols="12" sm="4">
        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/reports')"
          >報告書</v-btn
        >
      </v-col>
    </v-row>
  </v-container>
</template>
