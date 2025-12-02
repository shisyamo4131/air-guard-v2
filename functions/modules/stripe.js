/**
 * Stripeとの連携モジュール (AirGuard v2)
 *
 * [シークレット環境変数]
 * STRIPE_SECRET、STRIPE_WEBHOOK_SECRET
 *
 * [Firestore構造]
 * ----------------------------------------------------------------------------
 * Companies/{companyId}
 *   - stripeCustomerId: string
 *   - subscription: {
 *       id: string | null
 *       status: string | null
 *       currentPeriodEnd: Timestamp | null
 *       employeeLimit: number
 *     }
 *   StripeData (サブコレクション)
 *     checkout_sessions/{sessionId}
 *       - price: string
 *       - success_url: string
 *       - cancel_url: string
 *       - sessionUrl: string
 *       - customerId: string
 *       - error: object | null
 *
 * [Webhookエンドポイントで処理するイベント]
 * ----------------------------------------------------------------------------
 * customer.subscription.created  Stripeでサブスクリプションが作成・変更・削除された時に発行されるイベント。
 * customer.subscription.updated  CompaniesドキュメントのsubscriptionフィールドをFirestoreと同期する。
 * customer.subscription.deleted
 *
 * [参考]
 * https://zenn.dev/ryota_iwamoto/articles/web_checkout_on_mobile_app
 * https://qiita.com/mildsummer/items/de1c08d33b295f4633d6
 */
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import Stripe from "stripe";

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

// Define secrets
const stripeSecret = defineSecret("STRIPE_SECRET");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Initialize Stripe (will use STRIPE_SECRET from runtime environment)
let stripe;

/**
 * StripeからのWebhookイベントリクエストを処理します。
 *
 * StripeからのWebhookイベントを処理するには、whsecから始まる署名シークレットが必要です。
 * Stripeのダッシュボードから「開発者」->「Webhook」にアクセスし、署名シークレットを確認してください。
 *
 * 署名シークレットはCloud Functionsのシークレット環境変数を使用して管理します。
 * https://firebase.google.com/docs/functions/config-env?hl=ja#create-secret
 *
 * 処理するイベントは以下のとおりです。
 * ----------------------------------------------------------------------------
 * customer.subscription.created  Stripeでサブスクリプションが作成・変更・削除された時に発行されるイベント。
 * customer.subscription.updated  CompaniesドキュメントのsubscriptionフィールドをFirestoreと同期する。
 * customer.subscription.deleted
 * ----------------------------------------------------------------------------
 * 上記以外のイベントは無視され、無条件にHTTPレスポンス200が返されます。
 *
 * 処理中にエラーが発生するとログを出力し、HTTPレスポンス400を返します。
 *
 * [リクエストの検証]
 * ----------------------------------------------------------------------------
 * Cloud FunctionsにおけるWebhookエンドポイントは
 * https://{region}-{projectId}.cloudfunctions.net/{functionName}
 * というURLで構成されます。
 * 当該URLを叩けば起動されるため、受け取ったリクエストがStripeから発行されたものであるかを
 * 検証する必要があります。
 * 検証はverifyStripeSignature()を参照してください。
 */
export const webhooks = onRequest(
  {
    region: "asia-northeast1",
    secrets: [stripeSecret, stripeWebhookSecret],
  },
  async (request, response) => {
    const eventType = request.body.type;
    logger.info(`Received http request. type: ${eventType}`);
    try {
      // Stripeからのリクエストであることを検証 -> 署名が合わなければ400を返して終了
      const event = verifyStripeSignature(request);
      if (!event) return response.status(400).end();

      switch (eventType) {
        // CUSTOMER SUBSCRIPTION
        case "customer.subscription.created":
          await syncCompanySubscription(event.data.object, "CREATE");
          break;
        case "customer.subscription.updated":
          await syncCompanySubscription(event.data.object, "UPDATE");
          break;
        case "customer.subscription.deleted":
          await syncCompanySubscription(event.data.object, "DELETE");
          break;
        default: {
          logger.info(`EVENT: ${eventType} was ignored.`);
        }
      }
      response.status(200).send("Request received successful.");
    } catch (error) {
      logger.error("Webhook processing error:", error);
      return response.status(400).end();
    }
  }
);

/**
 * Firestoreのcheckout_sessionドキュメントの作成をトリガーとして実行される
 * ファンクションです。Stripeのcheckout_session_APIを利用して
 * checkout_sessionを作成し、当該APIから提供される決済フローのためのURLを取得後、
 * フィールド名<sessionUrl>としてcheckout sessionドキュメントを更新します。
 *
 * アプリではcheckout_sessionドキュメントの作成直後に当該ドキュメントの更新を
 * onSnapshotリスナーで監視し、取得できたsessionUrlフィールド値をもとに
 * Stripeの決済フローにリダイレクトしてください。
 *
 * 尚、checkout_sessionの作成中にエラーが発生した場合は、checkout_session
 * ドキュメントにエラー内容をフィールド名<error>として更新します。
 * 上記onSnapshotリスナーでerrorフィールドがnullでない場合は何かしらの
 * エラーが発生したものとして処理する必要があります。
 */
export const onCreateCheckoutSession = onDocumentCreated(
  {
    document: "Companies/{companyId}/StripeData/{sessionId}",
    region: "asia-northeast1",
    secrets: [stripeSecret],
  },
  async (event) => {
    const snap = event.data;
    const data = snap.data();
    const price = data.price;
    const successUrl = data.success_url;
    const cancelUrl = data.cancel_url;
    const companyId = event.params.companyId;

    try {
      // Initialize Stripe if not already done
      if (!stripe) {
        stripe = Stripe(process.env.STRIPE_SECRET, {
          apiVersion: "2025-11-17.clover",
        });
      }

      // Companyドキュメントを取得
      const companyRef = db.collection("Companies").doc(companyId);
      const companyDoc = await companyRef.get();

      if (!companyDoc.exists) {
        throw new Error(`Company document not found: ${companyId}`);
      }

      const companyData = companyDoc.data();
      let customerId = companyData.stripeCustomerId;

      // Stripe顧客が存在しない場合は新規作成
      if (!customerId) {
        logger.info(`Creating new Stripe customer for company: ${companyId}`);

        // Companyの情報からStripe顧客を作成
        const customer = await stripe.customers.create({
          email: companyData.email || undefined,
          name: companyData.name || companyData.abbr || undefined,
          metadata: {
            companyId: companyId,
          },
        });

        customerId = customer.id;

        // CompanyドキュメントにstripeCustomerIdを保存
        await companyRef.update({
          stripeCustomerId: customerId,
        });

        logger.info(`Stripe customer created: ${customerId}`);
      }

      // Checkout Sessionを作成
      const session = await stripe.checkout.sessions.create({
        automatic_tax: {
          enabled: true,
        },
        cancel_url: cancelUrl,
        customer: customerId,
        customer_update: {
          address: "auto",
        },
        line_items: [{ price, quantity: 1 }],
        mode: "subscription",
        payment_method_types: ["card"],
        success_url: successUrl,
        subscription_data: {
          trial_period_days: 30,
        },
      });

      logger.info("Stripe checkout session created successfully!");
      await snap.ref.set(
        { error: null, sessionUrl: session.url, customerId },
        { merge: true }
      );
    } catch (error) {
      logger.error("Error creating checkout session:", error);
      await snap.ref.set(
        { error: { message: error.message }, sessionUrl: null },
        { merge: true }
      );
    }
  }
);

/**
 * Stripeのサブスクリプション情報をCompaniesドキュメントのsubscriptionフィールドと同期します。
 * stripeCustomerIdからCompanyドキュメントを検索し、subscriptionフィールドを更新します。
 *
 * @param {object} data Stripe Subscription object
 * @param {string} mode 'CREATE' | 'UPDATE' | 'DELETE'
 */
async function syncCompanySubscription(data, mode = "CREATE") {
  logger.info("Syncing Company subscription with Stripe:", {
    subscriptionId: data.id,
    customerId: data.customer,
    mode,
  });

  try {
    const customerId = data.customer;
    if (!customerId) {
      throw new Error("Stripe subscription has no customer ID");
    }

    // stripeCustomerIdでCompanyドキュメントを検索
    const companiesRef = db.collection("Companies");
    const querySnapshot = await companiesRef
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      logger.warn(
        `No Company found with stripeCustomerId: ${customerId}. Subscription sync skipped.`
      );
      return;
    }

    const companyDoc = querySnapshot.docs[0];
    const companyRef = companyDoc.ref;

    if (mode === "DELETE") {
      // サブスクリプション削除時はsubscriptionをnullに
      await companyRef.update({
        subscription: {
          id: null,
          status: null,
          currentPeriodEnd: null,
          employeeLimit: 0,
        },
      });
      logger.info(`Company subscription deleted: ${companyDoc.id}`);
    } else {
      // CREATE or UPDATE
      const employeeLimit = parseInt(data.metadata?.employeeLimit || "0", 10);

      // current_period_endの値を確認してからTimestampに変換
      let currentPeriodEnd = null;
      if (
        data.current_period_end &&
        typeof data.current_period_end === "number"
      ) {
        currentPeriodEnd = Timestamp.fromMillis(data.current_period_end * 1000);
      }

      const subscriptionData = {
        id: data.id,
        status: data.status,
        currentPeriodEnd,
        employeeLimit,
      };

      await companyRef.update({
        subscription: subscriptionData,
      });

      logger.info(`Company subscription synced: ${companyDoc.id}`, {
        subscriptionId: data.id,
        status: data.status,
        employeeLimit,
        currentPeriodEnd: data.current_period_end,
      });
    }
  } catch (error) {
    logger.error("Error syncing Company subscription:", error);
    throw error;
  }
}

/**
 * リクエストがStripeから送信されたものかどうかを検証します。
 * 正常なリクエストであれば初期化されたEventオブジェクトを返します。
 * 当該関数を使用するfunctionsで以下が必要です。
 * runWith({ secrets: ['STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET]})
 * @param {*} request
 * @returns boolean
 */
function verifyStripeSignature(request) {
  const sign = request.headers["stripe-signature"];
  const whsecKey = process.env.STRIPE_WEBHOOK_SECRET;
  try {
    // Initialize Stripe if not already done
    if (!stripe) {
      stripe = Stripe(process.env.STRIPE_SECRET, {
        apiVersion: "2025-11-17.clover",
      });
    }
    const event = stripe.webhooks.constructEvent(
      request.rawBody,
      sign,
      whsecKey
    );
    logger.info("webhook signature verification: success");
    return event;
  } catch (error) {
    logger.error("webhook signature verification: error", error);
    return false;
  }
}
