# Customer保存形式のread-only事前検査

- 状態: Confirmed
- 役割: 必要と判断されたreleaseで、DevのCustomer保存形式を変更せず検査する個別手順
- 対象: `air-guard-v2-dev` / Firestore `(default)`

## 適用条件

`scripts/check-customer-dev-compatibility.mjs`はCustomer保存形式の専用検査toolであり、毎回のDev release gateではない。[project rulesの3条件](../../project-rules/development-and-data.md#dev試用中の既存document)に該当し、対象commit、読取範囲、上限を固定した承認がある場合だけ実行する。

実装状況と未確認範囲は[Customer実装](../../implementation/customer-master.md)、過去の実行結果は[CUSTOMER-01B receipt](../../verification/customer-01b-dev-compatibility.md)を参照する。

## 読取範囲と保証

- database rootから全階層の`Customers` collectionを読み、`Companies/{companyId}/Customers/{docId}`だけを正常pathとして受け入れる。
- ACTIVEとTERMINATEDを検査する。`Customers_archive`、Company本文、Users、他collectionは対象外とする。
- converterによる補完を行わず、Firestoreの生の型で定義済み26項目の有無、余分な項目、型、長さ、状態、支払条件、住所と座標の相関を確認する。
- actor権限、Userのtenant拒否、新規作成時のserver timestamp、検索、住所情報の意味上の正しさは保証しない。
- 更新、削除、migration、repair、backup、raw data export機能を持たない。service accountのIAM権限全体がread-onlyであるという意味ではない。

## 実行

[認証手順](authentication-and-windows.md)に従い、現在のprocessへ渡された`AIRGUARD_DEV_CREDENTIAL_PATH`の存在とDev project一致を確認する。環境変数をUser scopeから読み直さず、path、内容、account emailを表示しない。

primary repositoryの固定commitとclean状態を確認し、次を独立実行する。

```powershell
$env:NODE_USE_SYSTEM_CA = "1"
node scripts/check-customer-dev-compatibility.mjs --read-only --project air-guard-v2-dev --database '(default)'
```

接続前にtoolが固定local drive、通常file、credential種別、Dev project、service account、RSA鍵を検査する。ADCやmetadata認証、Emulator、接続先override、TLS検証無効化、未知の引数、不一致は拒否する。

上限は1000件、OAuth開始から応答bodyの読取り完了まで30秒、Firestore応答16 MiB、token応答とcredential fileは各64 KiBである。queryは上限+1件を要求し、1001件目があれば全件確認済みにしない。`--max-documents`と`--timeout-ms`は上限を下げる場合だけ使用できる。

出力は状態、件数、不適合理由の集計に限定し、値、ID、credential、data由来hash、raw errorを出さない。

| exit | 状態 | 意味 |
|---:|---|---|
| 0 | compatible | 取得完了かつ対象documentの保存形式がすべて適合 |
| 2 | incompatible | 取得完了、不適合または未検証表現を含むdocumentあり |
| 1 | blocked | 引数、環境、credential、通信、応答、上限等により確定不能 |

補助平面文字・単独surrogateのRules文字数判定と、GeoPointの省略されたゼロ座標は互換性未確認として非成功にする。`unicode-unverified`や`wire-unverified`をdata破損と断定しない。

不適合、上限超過、取得未完了は成功とせず終了する。無条件再試行、対象・上限拡大、修復へ進まない。0件と取得不能を区別し、結果だけでrelease全体の可否を決めない。

Dev反映は検査とは別のbounded release checkpointとする。候補Rulesとの形式不適合だけを理由にmigrationを必須にせず、project rulesの3条件に従って状態確認・変換の要否を判断する。
