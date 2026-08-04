# AirGuard v2 運用・開発ガイドライン

> このドキュメントは、AirGuard v2 の実務的な運用手順と開発ガイドラインを記載したものです。
> 設計思想や仕様の詳細については DESIGN.md を参照してください。

## 目次

1. [運用ガイド](#運用ガイド)
1. [開発ガイドライン](#開発ガイドライン)
1. [Stripe 決済統合](#stripe-決済統合)
1. [開発トピック](#開発トピック)

# 運用ガイド

## 従業員管理

## 取引先管理

### 入金サイト

- 取引先ごとの請求データに対する支払期日を計算するために使用します。
- 締日から起算していつを支払期日にするかを設定してください。
- 請求データはリアルタイムに反映されますが、一度設定した入金サイトは変更しても現在集計期間の請求データには反映されません。
- 現在集計期間の請求データの支払期日は個別に変更してください。
- 将来作成される請求データには自動で新しい入金サイトが反映されます。

## 現場管理

### 取極め

- 取極めは現場ごとに登録が可能で、いつの稼働実績から、いくらの単価を適用するかを事前に設定することができます。
- 取極めは曜日、勤務区分（日勤、夜勤）ごとに登録します。登録した単価は適用開始日付以降の稼働実績に適用されます。
- 途中で単価などの情報を変更しても、既存の稼働実績には反映されません。手動で個別に設定する必要があります。
- 適用開始日付、曜日、勤務区分（日勤、夜勤）を重複して登録することはできません。

## 現場稼働予定

- 現場ごとの稼働予定と、その予定に配置する作業員（警備員・外注先）の管理を行います。
- 現場稼働予定は稼働日から 60 日が経過すると自動的に削除されます。復元することはできません。

## 上下番確定処理

- 配置作業が完了し、稼働日が過ぎたタイミングで現場稼働予定に登録されている情報を稼働実績へと変換します。
- 配置通知(ArrangementNotification)が作成されている場合は、通知上の実際の勤務時間(actualXXXX)をもとに稼働実績が作成されます。
- 配置通知が作成されていない場合は、現場稼働予定の予定勤務時間がそのまま実績として扱われます。
- 日付、勤務区分、曜日区分に該当する取極めが登録されていない場合、取り込みはできません。画面の指示に従って取極めの仮登録（すべての単価を 1 円で設定）することも可能です。

## 稼働実績管理

- 売上データのもととなる稼働実績情報を管理します。
- 現場稼働予定の上下番確定処理によって登録されるほか、管理画面で作成することも可能です。
- 現場稼働予定の上下番確定処理の際、適用可能な取極めが当該現場に登録されている場合は自動的に適用されます。管理画面で作成した場合、取極めは適用されません。
- 現場稼働予定の上下番確定処理で登録された稼働実績は、一度削除すると元に戻すことはできません。
- 一度登録された稼働実績の現場を変更することはできません。（適用されている取極めが別現場のものになってしまう可能性を排除）
- 稼働日や勤務区分などを変更することは可能ですが、作業員（特に警備員）の勤怠実績も連動して変更されるので注意してください。
- 「稼働請求管理」でロックされた稼働実績は編集・削除することができません。

## 稼働請求管理

- 稼働実績による売上（請求）情報を管理します。
- 請求単価を直接変更することや、調整額として請求単価を変更することが可能です。
- また、貸与品の請求など、稼働に関わらないデータを登録することが可能です。
- ここでロックした稼働実績データは「稼働実績管理」で編集・削除することができなくなります。
- 稼働請求管理画面から稼働請求データを作成することはできません。必ず稼働実績管理から作成してください。

### 取極めの取り扱い

- 原則では、稼働に対して取極めをもとにした売上が計上されるべきです。
- 運用上、取極めが定まる前に稼働実績が確定するケースに対応しています。
- また、売上に連動しない稼働についても実績として登録することが可能です。この場合、取極めを設定する必要はなく、「取極めなしを無視」にチェックすることで実績を確定することができます。
- 同時に、稼働に対応しない売上を計上することも可能です。

| ケース     | 取極め | 取極めなしを無視 | 実績確定 | 稼働売上 | 用途           |
| ---------- | ------ | ---------------- | -------- | -------- | -------------- |
| 通常       | あり   | －               | 可能     | あり     | 通常の稼働実績 |
| 取極め未定 | なし   | －               | 不可能   | 0 円     | 取極め待ち     |
| 取極めなし | なし   | チェック         | 可能     | 0 円     | 稼働の記録のみ |

## 消費税の計上

稼働実績は稼働日を基準とした適用税率を保持し、消費税額の端数処理は請求書内の税率ごとに行う。

- 稼働実績の `date` から適用税率を判定することで、請求期間中の税率変更に対応する。
- 現場別請求書は、現場内の税率別税抜売上合計に税率を乗じ、税率ごとに端数処理する。
- 取引先統合請求書は、全現場の税率別税抜売上合計に税率を乗じ、税率ごとに端数処理する。
- 取引先統合請求書の税額は、現場別請求書の税額合計と一致しない場合がある。
- 端数処理は会社設定に基づき `RoundSetting.apply` を使用する。

## 端数処理

### 売り上げの端数処理について

稼働実績ごとに売上が確定されるが、設定単価、数量によっては端数が生じるケースがある。
RoundSetting によって生じた端数の取り扱いを制御できるようにする。

- 通常、資格者ごとの金額、残業代は数量・時間に単価をかけた純粋な数値
- 合計（最終的な売上金額）のみ RoundSetting に設定された端数処理を行う。

## 勤怠管理・給与計算

- 法令改正等への対応コストを鑑みて、AirGuardV2 単独では勤怠管理・給与計算を完結させません。稼働実績に登録された従業員の打刻データをエクスポートできる機能を実装し、従業員の勤怠管理・給与計算は外部サービスに依存することとします。
- 外部サービスに提供するための打刻データは従業員分のみとします。外注先についてはエクスポートを行いません。
- ここでの「打刻データ」とは、実際に従業員が打刻したデータではなく、OperationResultDetail データから生成されるものです。

### 従業員別日次稼働

- `DailyOperationsByEmployee` コレクションは、従業員ごとの稼働を `OperationResultDetail.dateAt`（稼働日・請求基準日）で日次集計します。
- ドキュメントIDは `${employeeId}_${date}` とします。
- `DailyAttendance` が `attendanceDateAt` を基準とする実際の勤怠データであるのに対し、`DailyOperationByEmployee` は `dateAt` を基準とする稼働数・取極め基準売上の確認に使用します。
- 外注先は集計対象に含めません。
- OperationResult の作成・更新・削除トリガーにより、会社設定にかかわらず `DailyAttendance` と `DailyOperationByEmployee` の両方を更新します。
- `operationResultIds` に OperationResult のドキュメントIDを保存し、OperationResult の更新・削除時は `array-contains` によって既存の配置先を逆引きします。
  - 逆引きした全ドキュメントから対象OperationResultを除去します。
  - `operationResults` が1件以上残る場合は更新し、0件になった場合はドキュメントを削除します。
  - 更新後のOperationResultが存在する場合は、各従業員明細の `id` と `dateAt` を基準に再配置します。

#### 取極め基準売上

- 従業員別売上は、実際の請求額ではなく、OperationResult に保存された取極めを従業員明細へ適用した参考値です。
- `OperationResult.useAdjusted` が `true` の場合も、調整後単価・調整後数量を使用しません。
- `OperationResult.articles` は従業員別売上に含めません。
- 外注先売上は集計対象に含めません。
- 資格者単価の適用は `OperationResultDetail.isQualified` により判定します。
- OJT明細は稼働数に含め、取極めの有無にかかわらず売上を0円とします。
- 通常明細に適用可能な取極めまたは単価情報がない場合は、0円ではなく未算出として扱います。
- 明細ごとに基本金額と残業金額を合算し、四捨五入した金額を当該明細の取極め基準売上とします。会社の端数処理設定は使用しません。
- 日次の取極め基準売上は算出可能な明細だけを合計し、未算出明細数を別途記録します。
  - 算出可能な明細が1件もない場合、日次の取極め基準売上は `null` とします。
  - 未算出明細が1件でも存在する場合、`isAgreementBasedSalesComplete` は `false` とします。

### エクスポートするデータ

- 従業員コード
- 名前
- 打刻種別コード（1: 出勤、2: 退勤、3: 休憩開始、4: 休憩終了）
- 打刻日時（YYYYMMDDHHMM）

#### 勤務日

- 従業員の勤務日には OperationResultDetail の `attendanceDate` が使用されます。
  - DailyAttendance ドキュメントの作成時に、`dateAt` は OperationResultDetail.`attendanceDateAt` を基準に設定され、`date` はその `dateAt` から算出されます。
  - 警備業においては、暦日を超えた時刻に開始する稼働について、その「暦日」基準で取引先に請求する慣習があります。ですが、法令上、勤怠管理においては「実際の勤務日」を管理する必要があります。OperationResultDetail の `attendanceDate` は「実際の勤務日」を表します。
    - 例: 7月31日 25時開始 → 請求基準は7月31日、勤怠基準は8月1日でなければならない。
    - OperationResultDetail では `isStartNextDay` フラグによって勤怠基準が翌日になるかどうかを判断します。
  - 会社によっては勤怠管理においても**請求基準日で給与計算を行うケース**がありますが、法令順守の観点から、AirGuardV2 では勤怠基準のみを採用します。

#### 休憩の開始時刻と終了時刻の取り扱い

勤怠管理サービスの多くは、休憩についてその開始および終了時刻を求めます。ですが、警備業（特に2号警備）では休憩の開始および終了時刻を記録する慣習がありません。よって以下のように取り扱うこととします。

- 単一の稼働実績について休憩は当該稼働実績就業時間帯の中央で取得したものと見做します。
  - 例: 8時00分～17時00分（休憩: 60分）の場合、12時00分～13時00分を休憩時間と見做します。
- 見做し休憩の開始日時は、勤務区間の中央から休憩時間の半分を差し引いて算出し、分未満を切り捨てます。休憩終了日時は、算出した開始日時に休憩時間を加算します。

#### 同一日で複数の稼働実績がある場合の取り扱い

- 最も早い `startAt` を「始業日時」、最も遅い `endAt` を「終業日時」として扱います。
  - `startAt` および `endAt` は `isStartNextDay` と日跨ぎ（`isSpansNextDay`）が反映された日時です。
- 稼働実績ごとの休憩開始・終了日時は前述のとおりです。
- 複数の稼働実績について「空白の時間帯」が存在する場合は、その時間帯を休憩として扱います。
  - 移動、待機等、会社の指示によって「労働時間」に該当する時間が含まれる場合はエクスポート前に稼働実績を修正する必要があります。
- 複数の稼働実績について「重複する時間帯」が存在する場合、当該 DailyAttendance ドキュメントはエクスポート対象外とします。
  - DailyAttendance には、勤怠データとしてエクスポート可能かを返す `isExportable` ゲッターと、エクスポートできない理由を返す `exportInvalidReasons` ゲッターを実装します。
  - 重複する時間帯が存在する場合、`isExportable` は `false` を返します。
  - この場合、`exportInvalidReasons` の返り値には、エラーコード `OVERLAPPING_OPERATION_RESULTS` を持つ検証エラーが含まれます。
  - `isExportable` および `exportInvalidReasons` はエクスポート可否を判定するためのゲッターであり、`BaseClass` が提供する `isInvalid` および `invalidReasons` ゲッターとは分離して扱います。
  - エクスポートに関する検証エラーは DailyAttendance ドキュメントの Firestore への保存を妨げません。
  - 勤務区間は開始日時を含み、終了日時を含まない半開区間として比較します。前の稼働実績の終了日時と次の稼働実績の開始日時が同一の場合、重複および空白はないものとします。

## メンテナンス状態の切り替え（完了）

- SDK からメンテナンス状態を切り替えられるコマンド作成済み。

- Nuxt プラグイン（07.system.js）が System/system ドキュメントの isMaintenance フラグを監視。
  - isMaintenance が true に更新されると /maintenance へのリダイレクトを強制。
  - isMaintenance が false に更新されると / へのリダイレクトを強制。
  - プラグインだけでは isMaintenance が更新された時のリダイレクトしか制御できないため
    さらにナビゲーションガードで制御。
- ナビゲーションガード（auth.global.js）がメンテナンス中かどうかによってページ遷移を制御。

## バックアップ

## キルスイッチ（完了）

- SDK で実装済み（メンテナンスモードにすれば OK）

# 開発ガイドライン

# Stripe 決済統合

(2025-12-01 仮実装完了)

## 基本設計

- **課金モデル**: 従業員数に応じた月額サブスクリプション
- **無料トライアル**: 30 日間
- **顧客作成タイミング**: 初回サブスクリプション登録時（管理者サインアップ時ではない）

## 実装内容

**1. スキーマ拡張**

- `air-guard-v2-schemas` v1.3.0 リリース
- `Company`クラスに以下を追加:
  - `stripeCustomerId`: String (Stripe Customer ID)
  - `subscription`: Object (id, status, currentPeriodEnd, employeeLimit)

**2. Cloud Functions (`functions/modules/stripe.js`)**

- `onCreateCheckoutSession`: Checkout Session 自動作成
  - Stripe 顧客の自動作成（未登録の場合）
  - `Company.stripeCustomerId`の保存
  - Stripe Checkout URL の生成
- `webhooks`: Webhook イベント処理
  - `customer.subscription.created/updated/deleted`を処理
  - `syncCompanySubscription()`で`Company.subscription`を更新
- Firebase Functions v2、Stripe SDK、ES Modules 対応
- API Version: `2025-11-17.clover`

**3. フロントエンド**

- `pages/settings/checkout.vue`: サブスクリプション登録画面
  - Firestore v9 モジュラー API 使用
  - `Companies/{companyId}/StripeData`サブコレクションにセッション作成
  - `onSnapshot`でリアルタイム監視
  - 決済 URL へのリダイレクト
- `stores/useAuthStore.js`:
  - `customerType` computed property 追加
  - 'free' / 'paid' / 'expired'の 3 状態を判定

**4. セキュリティ設定**

- `firestore.rules`: `StripeData`サブコレクションのアクセス制御
  - 読み取り・作成: 同一会社ユーザーのみ
  - 更新・削除: Cloud Functions のみ
- 環境変数管理:
  - ローカル: `functions/.secret.local` (STRIPE_SECRET, STRIPE_WEBHOOK_SECRET)
  - DEV/PROD: Firebase Secret Manager

**5. 開発環境構築**

- Stripe CLI インストール (v1.33.0)
- Webhook forwarding 設定:
  ```powershell
  stripe listen --forward-to http://127.0.0.1:5001/air-guard-v2-dev/asia-northeast1/webhooks
  ```
- `functions/index.js`に`stripe.js`のエクスポート追加
- `npm install stripe` (functions 配下)

**6. テスト完了項目**

- ✅ ローカル環境（Emulator）での Checkout Session 作成
- ✅ Stripe 顧客の自動作成
- ✅ `Company.stripeCustomerId`の保存
- ✅ Webhook 経由での`Company.subscription`更新
- ✅ `customerType`の状態判定
- ✅ テストカード決済（4242 4242 4242 4242）

## 技術的課題と解決

1. **Firestore パス構造エラー**
   - 問題: 4 セグメント（偶数）のパス指定でエラー
   - 解決: `Companies/{companyId}/StripeData/{sessionId}`に修正（3 セグメント）

2. **Timestamp 変換エラー**
   - 問題: `Timestamp.fromMillis()`に無効な値
   - 解決: `current_period_end`の存在と型チェックを追加

3. **環境変数管理**
   - 問題: `.env`と`.secret.local`の使い分け
   - 解決: 通常の環境変数は`.env`、シークレットは`.secret.local`

4. **Functions エクスポート漏れ**
   - 問題: `stripe.js`が`index.js`でエクスポートされていない
   - 解決: `export * from "./modules/stripe.js";`を追加

## 今後の実装予定

- [ ] DEV/PROD 環境へのデプロイ
- [ ] Firebase Secret Manager へのキー登録
- [ ] Stripe Dashboard での本番 Webhook 登録
- [ ] プラン選択 UI（複数プラン対応）
- [ ] サブスクリプションキャンセル機能
- [ ] 従業員数制限のエンフォースメント
- [ ] 決済履歴表示
- [ ] 請求書ダウンロード機能

# 開発トピック

## Emulator 環境を実機（スマホ）で確認するための設定

1. `firebase.json` で各種エミュレーターに `host: 0,0,0,0` を設定
2. サーバー起動に `--host` オプションを追加
3. `firebase.init.js` でエミュレーターへの接続時に PC の IP アドレスを取得して設定

## コンポーザブルの利用定義

むやみやたらとコンポーザブル化すると、コンポーネントの設計にも一貫性がなくなるため注意。
以下の仕様に従うこと。

1. 特定の汎用コンポーネントに機能を注入する位置づけで作成すること。
2. マスタデータの取得はコンポーネント内でその取得条件を定義して構わない。
3. トランザクションデータは取得条件を外部から受け取り、set 関数で取得を開始すること。（例: dateRange コンポーザブルで日付範囲を管理し、コンポーザブルは dateRange コンポーザブルを受け取る）
4. 複数の機能を複合した機能を提供する場合、コンポーザブルは統合せず、コンポーネント内でそれぞれのコンポーザブルをセットアップすること。（例: Arrangements）
   4-1. コード全体の見通しが悪くなるだけでなく、責任の分離がしづらく、各コンポーザブル同士の依存度が高くなるため。

## Firebase の環境変数

- 環境変数は .env ファイルに設定する。
- .env ファイルは .env.local（ローカル開発環境）, .env.development（テスト環境） も用意している。
- .env ファイルには process.env オブジェクトからアクセス可能で、Nuxt3 に読み込まれる .env ファイルは package.json の script 実行時に --dotenv オプションで指定したものになる。
- Nuxt3 からは nuxt.config.js の runtimeConfig からアクセスする。
- 本番環境では --dotenv オプションを指定せず、.env ファイルを読み込ませる？

## コンパイルとデプロイ

Firebase の hosting にデプロイする手順は以下のとおり。

1. `npm run generate:'environment'` でコンパイル

- 'environment' は `prod`, `dev` のどちらかを指定。
- Firebase Hosting にデプロイする場合、コンパイルしたファイルは dist ディレクトリに作成されなければならない。

2. `firebase deploy` でデプロイ

- `firebase deploy` でのデプロイ先 Firebase プロジェクトは .firebaserc に定義されている。デプロイ先を変更する場合は当該ファイルに定義を追加し、 `firebase use` コマンドで変更する。

## 動的な高さを持つコンポーネントにスクロールバーを適用する方法

```
<template>
  <v-container class="fill-height">
    <v-row class="fill-height">
      <v-col cols="6"> </v-col>
      <v-col cols="6" class="d-flex flex-column fill-height">
        {{ layout }}
        <v-list class="overflow-y-auto">
          <v-list-item v-for="employee in employees" :key="employee.docId">
            {{ employee.fullName }}
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
</template>
```

- 最終的なスクローラブルコンポーネントには `overflow-y-auto` を付ける
- 親コンポーネントから先祖の要素にはすべて高さが指定されていること。

## UI を自由設計にした、ボタンアクションを既定するコンポーネント

```
<template>
  <slot
    :model="proxyModel"
    :actions="ActionsComponent"
  />
</template>

<script setup>
// 仮のモデル
const proxyModel = reactive({ value: "" });

// actions用の内部コンポーネントを定義
const ActionsComponent = defineComponent({
  name: "VConfirmEditActions",
  emits: ["confirm", "cancel"],
  setup(props, { emit }) {
    return () => (
      <div>
        <button onClick={() => emit("confirm")}>OK</button>
        <button onClick={() => emit("cancel")}>Cancel</button>
      </div>
    );
  }
});

// actionsコンポーネントからemitされたイベントを受け取る
function handleConfirm() {
  // ここでv-confirm-editの内部処理を呼ぶ
  alert("confirmイベントを受信しました");
}
function handleCancel() {
  alert("cancelイベントを受信しました");
}

// provide/injectや$attrs/$emitを使わず、
// スロットで渡したコンポーネントのイベントを受け取るには、
// template側で明示的にイベントリスナをバインドする必要がある
</script>
```

## pdfMake を利用する上での注意事項

- VFS フォントデータの読み込みには時間がかかるため、必要な時に読み込むように遅延読み込みを使うと吉。

## dayjs

### 基本

- dayjs はデフォルトだと実行環境に合わせてタイムゾーンを判断する。
- `dayjs()` は現在日時（UTC）を内部値とした dayjs オブジェクトを生成する。
- `dayjs().format('YYYY-MM-DD')` とすると、実行環境のタイムゾーンに合わせてフォーマットする。

### UTC プラグイン

- `dayjs().utc()` は `dayjs()` によって生成された dayjs オブジェクトのその後の挙動についてタイムゾーンを UTC に固定する。

### timezone プラグイン

- dayjs の挙動についてタイムゾーンを指定するためのプラグイン。
- `dayjs().tz("Asia/Tokyo")` とすると、1. 内部値として UTC 現在日時の dayjs オブジェクトを生成し、2. それ以降の挙動が `Asia/Tokyo` に合わせられる。
- `dayjs().format("YYYY-MM-DD")` は実行環境のタイムゾーンに合わせたフォーマットで出力され、`dayjs().tz("Asia/Tokyo").format("YYYY-MM-DD")` とすると `Asia/Tokyo` のタイムゾーンに合わせたフォーマットで出力される。

#### dayjs オブジェクト生成時のタイムゾーン指定

- `dayjs("2026-01-01")` とすると生成される dayjs オブジェクトの内部値（UTC）は実行環境に依存する。
- `dayjs.tz("2026-01-01", "Asia/Tokyo")` とすれば、当該日付を JST として扱った dayjs オブジェクトが生成される。
- 現在日時を dayjs オブジェクトとして生成し、以降の挙動のタイムゾーンを指定するなら `dayjs().tz("Asia/Tokyo")` とすればよい。
- 実行環境に依存させずに UTC 日時を使って dayjs オブジェクトを生成するには `dayjs.utc(value)` とすればよい。
- Firestore から取得した UTC Date オブジェクトを dayjs に与える場合は `dayjs.utc(value).tz("Asia/Tokyo")` とすれば、「受け取った日時は UTC」で、「それ以降の挙動を JST に固定」できる。
- `value` が Date オブジェクトである場合、当該 Date オブジェクトの内部 UTC 値がそのまま使用される。

## td での ellipsis

```
<td class="ellipsis">
  <span>some text</span>
</td>

.ellipsis {
  position: relative;
}
.ellipsis:before {
  content: "&nbsp;";
  visibility: hidden;
}
.ellipsis span {
  position: absolute;
  left: 0; /* td の padding と合わせる */
  right: 0; /* td の padding と合わせる */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

## GitHub でブランチを切って管理する方法

1. ブランチを作成

```
git switch -c feature/your-branch-name
```

2. 変更をステージング＆コミット

```
git add .
git commit -m "feat: 変更内容の説明"
```

3. リモートにプッシュ

```
git push -u origin feature/your-branch-name
```

4. ブランチをマージ

```
git switch main
git pull origin main
git merge feature/your-branch-name
git push origin main
```

- ブランチ側を npm パッケージとして公開している場合、マージ後の公開は不要。
- 逆にブランチ側に問題があって破棄する場合は、ブランチ側を破棄してメインを再公開すればいい。

## ブランチを破棄する方法

```
git switch main
git branch -D feature/your-branch-name
git push origin --delete feature/your-branch-name
```

## リモートブランチ

git branch -r // リモートブランチ確認
git push origin --delete feature/xxx // リモートブランチ削除

## 復元

大きめの改修で問題にぶつかったらブランチで切った更新（変更）をもとに戻せる。

- ブランチを切る

```
git switch -c feature/xxx
```

- 改修、テストを繰り返す。
- 問題発覚。
- 復元

```
git switch main
git branch -D feature/xxx
git push origin --delete feature/xxx
```

- `feature/xxx` で行った更新（変更）はすべて削除される。
