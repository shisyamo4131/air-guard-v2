# 課題

## 原因特定困難な課題

- 配置管理の初回画面ロードに時間がかかる。コンポーザブルを多用しているため、これのロードに時間がかかっているものと思われるが、
  特定するのが困難。（再表示のときはスムーズに開くため、コンポーネント自体の処理に時間がかかっているわけではなさそう）
  コンポーザブルのキャッシュが問題のはず。

## AirGuardV2Schemas

- Operation.js で siteId, date, shiftType, startTime, isStartNextDay, endTime, breakMinutes が変更されたときの employees, outsourcers への同期処理をトリガーに変更すべき。
- Operation.js じゃない？？？
- SiteOperationSchedule は同期して OK。
- OperationResult は従業員の実績がある程度確定しているものなのでそもそも変更しちゃいけないのでは？

## 全体

- 時間（分）のプラス・マイナスをクリックしたときの単位をどうするか。
  - 規定時間や休憩時間などは少なくとも 1 分単位での入力にはならないはず。

## ユーザー管理

- 新しくユーザーが追加されたら Verify メール
  - SDK からでないと送信できない。フローの見直しが必要か？
- 管理者権限の委譲

## 取極め管理

- 請求単位が時間の場合、休憩時間をどのように取り扱うかを設定できるようにするべき。

## 現場稼働予定

- 保存期間を過ぎたドキュメントの削除
  - Cloud Functions で実装すること。
  - 保存期間は 60 日。

## 稼働実績管理

- 基本的な機能の実装。
- 現場稼働予定から作成された稼働実績は削除不可とする。
  - 作業員の上下番が発生しているのであれば、実態として勤怠は発生しているはず。
  - むしろ、現場の稼働予定を削除するべき。
  - 仮に客先に請求できない稼働実績になったとしたのであれば、請求額を 0 円に変更すれば良い。ただし、請求書出力を停止できるフラグが必要。

## 請求実績管理

- 基本的な機能の実装。
- 摘要する取極めの選択入力

# 運用

## 現場稼働予定の稼働実績への取り込み

- 配置作業までが完了し、作業日が過ぎたタイミングで現場稼働予定情報を稼働実績へと変換するための取り込み処理を行います。
- 作業員が登録した上下番（含む休憩時間）をもとに、稼働実績が作成されます。
- 配置通知が行われていない場合、現場取極めの定時で稼働実績が登録されます。
- 日付、勤務区分、曜日区分に該当する取極めが登録されていない場合、取り込みはできません。

## 消費税の計上

消費税の計上は稼働実績ごととする。

- 消費税をどのタイミングで計上するかは、特段の法的なルールはない。（厳密には明細毎）
- 現場ごと、取引先ごとの売上金額に消費税率をかける運用も見かけるが、税率に変更が生じた際の
  対応に追われることになる。
- 稼働実績ごと（＝日付ごと）に消費税を計上することで、税率の変更にも対応が可能。

## 端数処理

### 売り上げの端数処理について

稼働実績ごとに売上が確定されるが、設定単価、数量によっては端数が生じるケースがある。
RoundSetting によって生じた端数の取り扱いを制御できるようにする。

- 通常、資格者ごとの金額、残業代は数量・時間に単価をかけた純粋な数値
- 合計（最終的な売上金額）のみ RoundSetting に設定された端数処理を行う。

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
