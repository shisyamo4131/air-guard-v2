# Dev remote検証

- 状態: Confirmed
- 役割: Dev deploy後に、変更したserviceと受入れ経路だけを選んで確認するための個別手順
- 対象: `air-guard-v2-dev`

## 共通境界

固定commit、対象service、actor、data経路、期待結果、停止条件をrelease checkpointへ記録してから実行する。結果とexit statusはcommandごとに記録し、raw config、秘密情報、token、実account、個人・顧客・勤怠・請求dataを出力しない。

Dev受入れは選択した範囲だけを保証する。対象外serviceや未確認actorまで成功したと扱わない。個別機能の確認項目が既存の実装文書、ADR、verification receiptにある場合は、ここへ複写せずrelease checkpointから参照する。

## Hosting

- preflightで生成した同一`dist/`をdeployしたことを確認する。
- 配信中version、HTTP status、cache header、主要artifactの一致を確認する。
- 新しいbrowser sessionで、checkpointに固定した主要画面と操作を確認する。

## Functions

- 期待した公開集合、region、runtime、状態、scheduled job、対象時間帯のERROR logを確認する。
- Web clientから呼ぶv2 Callableは、対応するCloud Run serviceのinvoker設定とbrowser originからのCORS preflightを確認する。Functionの`ACTIVE`、credential付きserver request、Callable内部の未認証拒否だけではbrowser到達性の証拠にしない。
- 公開入口を許可しても、Callable内部のFirebase ID token、actor、tenant、target検証を維持する。
- invoker設定を変更する場合は、exact service、公開範囲、内部認証、rollbackを示した別の明示承認を得る。変更後はread-only IAM取得、browser preflight、正常actor、未認証・権限不足actorの拒否を分けて確認する。
- 共通Auth identity gateを使うFunctionsは、実行service accountがFirebase Authentication Userを参照できることを確認する。権限不足はfail closedとして扱う。

## Firestore Rules・Indexes

- Rulesの正常経路と拒否経路を確認する。
- tenant拒否は、承認済みの専用合成会社と正規ID tokenを使い、自社pathの陽性readと別の合成会社への拒否を分ける。
- write拒否probeには対象documentの存在を必須とするpreconditionを付け、Rules不備時にも新しいdocumentを作らない。
- indexは対象indexが利用可能な状態になったことと、そのindexを使う実queryを確認する。

## Storage Rules

Storage Rulesが`firestore.get()`または`firestore.exists()`を使う場合、StorageとFirestoreの連携許可、Firebase Storage service accountの必要role、正常Userと拒否対象Userのaccessを確認する。権限を推測で追加せず、初回prompt、付与済み、権限不足を区別する。

## User・Authentication lifecycle

非破壊確認では、管理画面の正常応答・空状態・page操作と、削除確認dialogの対象・理由・不可逆性を確認して取消し、対象Userと履歴が変わっていないことを確認する。

退職、本登録Userの物理削除、Authentication User削除を実行する場合は、合成対象、data影響、復旧不能範囲、停止条件を別途承認する。

## Maintenanceを使うrelease

解除前にserver、data、client、log、主要正常・拒否経路を確認する。解除後は新しいbrowser sessionで最終受入れを行う。maintenanceはRules、Functions、Admin SDK、scheduled処理、開始済みwriteを排他しない。
