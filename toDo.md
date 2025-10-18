# 課題

## 原因特定困難な課題

- 配置管理の初回画面ロードに時間がかかる。コンポーザブルを多用しているため、これのロードに時間がかかっているものと思われるが、
  特定するのが困難。（再表示のときはスムーズに開くため、コンポーネント自体の処理に時間がかかっているわけではなさそう）
  コンポーザブルのキャッシュが問題のはず。

## 全体

- 残業代の計算で端数が生じたときの処理
- 消費税の計算処理
- 休憩時間のプラス・マイナスをクリックしたときの単位

## 稼働実績取込（登録）処理

- 配置作業員がいない状態で放置された現場稼働予定が稼働実績として登録できない。どうする？
  - 「作業員が存在するのに配置通知が存在しない」場合は先に配置通知を作成する必要ありとし、作業員がいなければそのまま稼働実績として登録するで問題なし！

## ユーザー管理

- 新しくユーザーが追加されたら Verify メール
  - SDK からでないと送信できない。フローの見直しが必要か？
- 管理者権限の委譲

## 現場稼働予定

- 必要人数に対して不足している場合の対応をどうする？
  - ガチガチに固めすぎても使いづらい。あくまで「不足していること」の表示だけでいいのか？
- 保存期間を過ぎたドキュメントの削除
  - Cloud Functions で実装すること。
  - 保存期間は 60 日。

## 稼働実績管理

- 基本的な機能の実装。

## 請求実績管理

- 基本的な機能の実装。

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
