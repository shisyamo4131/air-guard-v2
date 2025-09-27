## createUserWithCompany

- Cloud Run のセキュリティを"公開"にしないと CORS エラーが発生。
- authentication の signUp メソッドを使えばアカウントをシンプルに作成することが可能だが、Company と User の作成をアプリから行わなければならない。
  - Cloud Run サービスを公開するよりはセキュリティ上好ましいとは思う。

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
