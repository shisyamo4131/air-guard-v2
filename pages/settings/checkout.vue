<script setup>
import { ref, computed, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNuxtApp } from "#app";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Stripe決済ページ
 *
 * このページでは以下の処理を行います:
 * 1. checkout_sessionドキュメントを作成
 * 2. Cloud Functionがcheckout sessionを生成し、sessionUrlを返す
 * 3. sessionUrlが取得できたらStripe決済ページにリダイレクト
 * 4. エラーが発生した場合はエラーメッセージを表示
 */

definePageMeta({ layout: "default" });

const authStore = useAuthStore();
const { $firestore } = useNuxtApp();
const router = useRouter();

// States
const isLoading = ref(false);
const error = ref(null);
const sessionDoc = ref(null);
const unsubscribe = ref(null);

// Stripe Price ID (本番環境では環境変数から取得することを推奨)
// TODO: 環境変数または設定から取得する
const STRIPE_PRICE_ID = "price_1SZPgXDs5cB9LhvEz0NwgJTc"; // 実際のPrice IDに置き換え

// Computed
const companyId = computed(() => authStore.companyId);
const stripeCustomerId = computed(() => authStore.company?.stripeCustomerId);

/**
 * Checkout Sessionを作成し、Stripe決済ページにリダイレクトします
 * Stripe顧客IDがない場合は自動的に作成します
 */
async function createCheckoutSession() {
  if (!companyId.value) {
    error.value = "会社情報が取得できませんでした。";
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const currentUrl = window.location.origin;
    const successUrl = `${currentUrl}/settings/checkout?success=true`;
    const cancelUrl = `${currentUrl}/settings/checkout?canceled=true`;

    // Checkout sessionドキュメントを作成（モジュラーAPI）
    // Cloud Functionが顧客IDの有無をチェックし、なければ作成する
    const checkoutSessionsRef = collection(
      $firestore,
      "Companies",
      companyId.value,
      "StripeData"
    );

    const docRef = await addDoc(checkoutSessionsRef, {
      price: STRIPE_PRICE_ID,
      success_url: successUrl,
      cancel_url: cancelUrl,
      createdAt: serverTimestamp(),
    });

    // ドキュメントの更新を監視（モジュラーAPI）
    unsubscribe.value = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data();

        if (data?.error) {
          // エラーが発生した場合
          error.value =
            data.error.message || "決済セッションの作成に失敗しました。";
          isLoading.value = false;
          if (unsubscribe.value) {
            unsubscribe.value();
            unsubscribe.value = null;
          }
        } else if (data?.sessionUrl) {
          // セッションURLが取得できたらリダイレクト
          window.location.href = data.sessionUrl;
        }
      },
      (err) => {
        error.value = `エラーが発生しました: ${err.message}`;
        isLoading.value = false;
        if (unsubscribe.value) {
          unsubscribe.value();
          unsubscribe.value = null;
        }
      }
    );
  } catch (err) {
    error.value = `エラーが発生しました: ${err.message}`;
    isLoading.value = false;
  }
}

/**
 * クエリパラメータをチェックして決済結果を表示
 */
const route = useRoute();
const paymentStatus = computed(() => {
  if (route.query.success === "true") return "success";
  if (route.query.canceled === "true") return "canceled";
  return null;
});

// クリーンアップ
onUnmounted(() => {
  if (unsubscribe.value) {
    unsubscribe.value();
  }
});
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card>
          <v-card-title class="text-h5"> サブスクリプション登録 </v-card-title>

          <v-card-text>
            <!-- 決済成功メッセージ -->
            <v-alert
              v-if="paymentStatus === 'success'"
              type="success"
              class="mb-4"
            >
              サブスクリプションの登録が完了しました！
            </v-alert>

            <!-- 決済キャンセルメッセージ -->
            <v-alert
              v-if="paymentStatus === 'canceled'"
              type="warning"
              class="mb-4"
            >
              決済がキャンセルされました。
            </v-alert>

            <!-- エラーメッセージ -->
            <v-alert v-if="error" type="error" class="mb-4">
              {{ error }}
            </v-alert>

            <!-- 現在の顧客タイプ表示 -->
            <v-sheet color="grey-lighten-4" class="pa-4 mb-4 rounded">
              <div class="text-subtitle-2 mb-2">現在のステータス</div>
              <v-chip
                :color="
                  authStore.customerType === 'paid'
                    ? 'success'
                    : authStore.customerType === 'expired'
                    ? 'error'
                    : 'default'
                "
              >
                {{
                  authStore.customerType === "paid"
                    ? "有料プラン契約中"
                    : authStore.customerType === "expired"
                    ? "期限切れ"
                    : "無料プラン"
                }}
              </v-chip>
            </v-sheet>

            <!-- プラン情報（仮） -->
            <div v-if="authStore.customerType !== 'paid'" class="mb-4">
              <div class="text-h6 mb-2">スタンダードプラン</div>
              <div class="text-body-2 mb-2">
                従業員数に応じた柔軟な料金体系で、すべての機能をご利用いただけます。
              </div>
              <ul class="text-body-2 mb-4">
                <li>従業員登録数: プランに応じて設定</li>
                <li>すべての機能が利用可能</li>
                <li>30日間の無料トライアル</li>
              </ul>
            </div>

            <!-- サブスクリプション情報 -->
            <div v-if="authStore.customerType === 'paid'" class="mb-4">
              <div class="text-subtitle-2 mb-2">契約情報</div>
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>ステータス</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ authStore.company?.subscription?.status || "-" }}
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>従業員上限</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ authStore.company?.subscription?.employeeLimit || 0 }}名
                  </v-list-item-subtitle>
                </v-list-item>
                <v-list-item
                  v-if="authStore.company?.subscription?.currentPeriodEnd"
                >
                  <v-list-item-title>次回更新日</v-list-item-title>
                  <v-list-item-subtitle>
                    {{
                      new Date(
                        authStore.company.subscription.currentPeriodEnd.toMillis()
                      ).toLocaleDateString("ja-JP")
                    }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </div>
          </v-card-text>

          <v-card-actions>
            <v-btn @click="router.push('/dashboard')"> 戻る </v-btn>
            <v-spacer />
            <v-btn
              v-if="authStore.customerType !== 'paid'"
              color="primary"
              :loading="isLoading"
              :disabled="isLoading || !!error"
              @click="createCheckoutSession"
            >
              サブスクリプションに登録
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
