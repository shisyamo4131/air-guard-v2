## このファイルについて

このファイルはあなたに把握して欲しいプロジェクトの内容や注意点をまとめたものです。

## 回答時は以下の要件を満たすこと。

1. 日本語で回答すること。
2. あなたに質問する際は原則として議論の対象となるファイルを指定します。関連する関数やコードが不明である場合、その内容を理解したい旨を私に通知すること。
3. このファイルはあなたとのやり取りを行う際、必ず最初に読み込んでもらうものです。次回以降、読み込むべき（追記・修正すべき）内容がある場合はそれも提案すること。
4. このファイルはプロジェクトの定義書にもなり得ます。各項目の構成として順序の入れ替えやまとめ方について提案があれば積極的に行うこと。

## 1. プロジェクト概要

AirGuard という名前のアプリを構築します。警備業の業務管理アプリです。

## 2. 技術スタックと環境

### 2.1. 主要技術

Nuxt3、Vue3、Vuetify3 を使います。
BaaS には Firebase を使用します。

### 2.2. 特殊な依存パッケージ

#### air-firebase-v2

`export default class` で `FireModel` というクラスを提供するパッケージ。
`FireModel` は Firestore への CRUD 機能を提供するクラス。
`FireModel` を継承したサブクラスを Firestore で管理するコレクションごとに作成することで、各ドキュメントの CRUD 機能を実現する。
`FireModel` が Firestore への CRUD 機能を提供するには、後述するアダプターを注入する必要がある。
`FireModel` には `prefix` という属性があり、これを設定することで、サブクラスが管理するドキュメントをサブコレクションとして扱うことができる。

- AirGuard ではこの `prefix` 機能を利用して、ユーザーが所属する会社のデータのみを操作できるようにアクセス制御を実現しています。例えば、`Companies/{companyId}/` という prefix を設定することで、従業員情報や案件情報などを各会社ドキュメントのサブコレクションとして管理します。
- `Companies` コレクション自体は、この `prefix` 設定によってサブコレクション化されるわけではありません。`Company` モデル（`collectionPath` が `"Companies"`）を使用する場合、その `collectionPath` が `prefix`（例: `"Companies/{companyId}/"`）の先頭部分と重複すると見なされるため、サブコレクション化のルールが適用されず、ルートの `Companies` コレクションが直接参照されます。これにより、ユーザーの所属会社 ID をもとに特定の会社情報を取得したり、会社一覧を取得したりすることが可能です。

- クライアントサイドでは `FireModel.setConfig({prefix: "parentCollection/parentId/"})` のように設定する。
  - 例: `02.firebase.auth.js` では、ユーザー認証状態に応じて `Companies/{companyId}/` のような prefix を設定している。
- `FireModel` は、`prefix` が設定されている場合、原則として `prefix` と `collectionPath` を結合して Firestore のパスを構築します（例: `prefix` が `Parent/ID/` で `collectionPath` が `ChildCollection` なら、パスは `Parent/ID/ChildCollection` となります）。
- ただし、AirGuard のように特定のモデル（例: `Company` モデル、`collectionPath` は `"Companies"`）を常にルートコレクションとして扱いたい場合があります。このため、`collectionPath` で指定されたコレクション名（例: `"Companies"`）が、設定された `prefix`（例: `"Companies/{companyId}/"`）の最初のセグメントと完全に一致する場合、その `collectionPath` は `prefix` の影響を受けず、ルートコレクション（この例では `"Companies"`）として解釈されます。これは、`prefix` を利用したデータ分離を行いつつも、特定の基幹となるコレクションへは常にルートパスでアクセスするための意図的な仕様です。
- `collectionPath` 自体にスラッシュ区切りのパス（例: `"ParentCollection/ChildCollection"`) を指定して `FireModel` 側でサブコレクション構造を能動的に定義することは、現状想定しておらず、検証も行っていません。`collectionPath` は基本的に単一のコレクション名を指定することを意図しています。
- サーバーサイド（Cloud Functions）では `FireModel.setConfig` を使用できないため、各 CRUD メソッド（`create`, `read`, `update`, `delete` など）の引数オプションとして `prefix` を指定する。

#### air-firebase-v2-client-adapter

クライアント（アプリ）側で使用する `FireModel` のアダプター。
`FireModel` が提供する Firestore への CRUD 機能の実態。
Nuxt3 のプラグイン機能を利用してこのアダプターを `FireModel` に注入している。

#### air-firebase-v2-server-adapter

サーバー（Cloud Functions）側で使用する `FireModel` のアダプター。
Cloud Functions でこのアダプターを `FireModel` に注入している。

#### air-guard-v2-schemas

`FireModel` を継承したサブクラスを提供するパッケージ。
プロジェクトは `air-firebase-v2` とともにこのパッケージに依存しています。
このパッケージをクライアント（アプリ）側とサーバー（Cloud Functions）側でインストールすることにより、サブクラスの一元管理を実現します。

**具体的なモデルクラスの例： `Company.js` (`Company` モデル)**

`Company.js` は、Firestore の `Companies` コレクションに対応するモデルクラスです。
このクラスを通じて、会社情報のドキュメントに対する CRUD 操作が行われます。
主な定義内容は以下の通りです。

- **`static collectionPath = "Companies";`**:
  このモデルが Firestore のどのコレクションと紐づくかを示します。
- **`static classProps = { ... };`**:
  ドキュメントが持つべきプロパティ（フィールド）のスキーマを定義します。各プロパティには、型 (`type`)、デフォルト値 (`default`)、必須フラグ (`required`) などが指定されます。
  - 例：`name: { type: String, default: "", required: true }` (会社名、文字列型、必須)
  - 例：`zipcode: { type: String, default: "", required: false }` (郵便番号、文字列型、任意)
- **`static useAutonumber = false;`**: ドキュメント ID の自動採番機能を使用するかどうか。
- **`static logicalDelete = false;`**: 論理削除を使用するかどうか。

このように、`air-guard-v2-schemas` 内の各モデルクラスは、対応する Firestore コレクションのデータ構造や、そのデータを扱う上でのルール（バリデーション、デフォルト値など）を定義しています。

#### air-vuetify-v3

Vuetify3 をカスタムしたコンポーネントを提供する自作パッケージ。
各種コンポーネントは`Air`を接頭辞として持つ。

### 2.3. テスト環境

開発環境としてエミュレーターを使用することとし、現在使用できる状況になっています。

## 3. 開発規約

### 3.1. コーディング規約・スタイルガイド

#### 命名規則

| 対象             | 命名規則         |
| ---------------- | ---------------- |
| コンポーネント名 | PascalCase       |
| 変数名           | camelCase        |
| 関数名           | camelCase        |
| 定数名           | UPPER_SNAKE_CASE |

#### コーディングスタイル

開発者が私一人なので、リンターやフォーマッターについて特に必要性を現時点で感じていません。
（リンターやフォーマッターについての知識が乏しく、現時点では VSCode とそれに導入されているプラグインの機能に依存しています。）
本格的に導入することになった場合は必要に応じて追記しますので、私があなたに言及するまで、リンターやフォーマッターについては触れなくて OK です。

Vue コンポーネントについては原則として `script setup` を使用します。
`script setup` 内の記述順序は、可読性と一貫性を保つため、以下の順序を推奨します。

1.  `import` 文
2.  `defineOptions` (コンポーネント名指定、`inheritAttrs: false` など、必要に応じて)
3.  `defineProps`
4.  `defineEmits`
5.  `defineExpose` (必要に応じて)
6.  `useRouter()`, `useRoute()` などの `use` 系コンポーザブル関数
7.  `ref`, `reactive` などのリアクティブ変数定義
8.  `computed` プロパティ
9.  `watch`, `watchEffect` (依存する変数の近くに記述することも許容)
10. ライフサイクルフック (例: `onMounted`, `onUnmounted`)
11. イベントハンドラやその他のメソッド

### 3.2. ディレクトリ構成

#### ./components

プロジェクトで使用するコンポーネントのためのディレクトリ。
アトミックデザインに従い、atoms, molecules, organisms で分け、追加で template という区分でページに適用するテンプレートを保存する。

#### ./composables

プロジェクトで使用するコンポーザブルのためのディレクトリ。
必ずこのディレクトリ直下にコンポーザブルを保存するが、コンポーザブルが使用する共通関数などがある場合は`./composables/utils` ディレクトリに保存する。

#### ./functions

Cloud Functions の実態

#### ./layouts

レイアウト

#### ./middleware

プロジェクトで使用するミドルウェア用のディレクトリ。

#### ./pages

ページ

#### ./plugins

Nuxt3 の plugins ディレクトリ。

#### ./public

Nuxt3 の public ディレクトリ。

#### ./server

Nuxt3 の server ディレクトリ。CSR のため、現状は使用する予定なし。
但し、Cloud Functions 以外の API エンドポイントを実装する場合はここに書く。

#### ./stores

Nuxt3 の store ディレクトリ。
状態管理には Pinia を利用。

#### ./utils

プロジェクトで使用するユーティリティ用のディレクトリ。

## 4. アプリケーション設計

### 4.1. 状態管理

`./stores` ディレクトリに Pinia のストアを配置します。
主要なグローバルストアとして以下を使用します。

- `./stores/useErrorsStore.js`
- `./stores/useLoadingsStore.js`
- `./stores/useMessagesStore.js`

### 4.2. エラーハンドリング

`./stores/useErrorsStore.js` を使います。

### 4.3. グローバルローディング

`./stores/useLoadingsStore.js` を使います。
`./layouts/default.vue` で読み込んでおり、`{ key, text }` をキューに追加することでユーザーにローディング中であることを表すコンポーネントが表示されるようになる。

### 4.4. メッセージング

`./stores/useMessagesStore.js` を使います。
`./layouts/default.vue` で読み込んでおり、`{ text, color }` をキューに追加することで snackbar が表示されるようになっている。

### 4.5. ユーザー管理と権限

Firebase Authentication を利用してユーザーアカウントを管理します。

#### Firebase Authentication ユーザーアカウント仕様

`functions/modules/createUserWithCompany.js` API でユーザーアカウントが作成される際の主な仕様は以下の通りです。

- **基本情報**:
  - `uid`: Firebase Authentication が自動割り当てする一意の ID。
  - `email`: ユーザー提供のメールアドレス（システム内で一意）。
  - `password`: ユーザー提供のパスワード（最低 6 文字以上）。
  - `displayName`: ユーザー提供の表示名。
- **カスタムクレーム**: ユーザー作成後、以下のカスタムクレームが設定されます。
  - `companyId` (文字列): ユーザーが所属する会社のドキュメント ID。`FireModel` の `prefix` 設定と連動し、データアクセス範囲を所属会社に限定するために使用されます。
  - `isSuperUser` (真偽値):
    - `createUserWithCompany.js` で作成されるユーザーはデフォルトで `false` が設定されます。
    - 別途用意された admin-sdk を介して `true` に変更可能です。
    - `true` の場合、アプリ内で操作対象の会社を一時的に切り替えることが可能となり、複数の会社の情報を横断的に操作できるスーパーユーザー権限を持ちます。
  - `roles` (文字列の配列):
    - ユーザーが所属する会社内での機能アクセス権限を制御します。
    - `createUserWithCompany.js` で作成されるユーザーは、自身が所属する会社の管理者として初期ロール `["admin"]` が設定されます。
    - 同じ会社内に別のユーザーアカウントを作成する場合（別の API 経由を想定）は、`admin` 以外のロールが付与されます（具体的なロールの種類は未定）。

#### Firestore 上のユーザー情報

Firebase Authentication のユーザー情報とは別に、Firestore の `Users` コレクション（各会社のサブコレクションとして `Companies/{companyId}/Users/{uid}`）にもユーザー情報が保存されます。
このデータは `air-guard-v2-schemas` パッケージの `User.js` モデルで定義されており、主なフィールドは以下の通りです。
アプリ内でのユーザー情報表示や管理に利用されます。

- `uid` (文字列): Firebase Authentication のユーザー ID。
- `email` (文字列): メールアドレス。
- `displayName` (文字列): 表示名。
- `employeeId` (文字列): 従業員 ID（従業員でないユーザーもいるため任意）。
- `roles` (文字列の配列): アプリ内での機能アクセス権限。
- `docId` (文字列): ドキュメント ID（通常は `uid` と同じ値が設定される想定）。

## 5. UI/UX

現段階では Vuetify3 を使う以外に特段の取極めはない。
`air-vuetify-v3` パッケージで提供されるカスタムコンポーネントを積極的に利用します。
