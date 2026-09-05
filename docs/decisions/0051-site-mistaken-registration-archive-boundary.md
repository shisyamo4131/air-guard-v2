# 0051 Siteの誤登録archiveと参照barrier

- 日付: 2026-09-05
- 状態: Accepted
- 関連仕様: [取引先・現場・取極め](../specification.md#取引先現場取極め)
- 関連判断: [0031 必要十分なデータ境界](0031-proportional-data-boundary-and-change-safeguards.md)、[0036 終了済み現場の表示順](0036-terminated-site-display-order-visibility.md)、[0046 Customer archive参照barrier](0046-customer-archive-reference-barrier.md)、[0048 SiteのCustomer変更と履歴snapshot](0048-site-customer-change-and-historical-snapshots.md)

## 背景

Siteには通常終了を表す`ACTIVE`／`TERMINATED`がある一方、誤登録または重複を業務一覧から取り除く必要がある。installed schemaとgeneric adapterにはlive documentを`Sites_archive`へ移すlogical deleteと逆方向のrestoreがある。

現行deleteはSiteOperationSchedules、OperationResults、ArrangementNotificationsだけをtransaction外で順に確認し、その後のtransactionでarchive copyとactive削除を行う。Billings、SiteEmployeeHistory等は参照確認に含まれず、確認後に新しい参照が作られる競合も防げない。UIはrestore不能と説明する一方でgeneric restore APIが存在し、`Sites_archive`のclient writeも同一tenant Userへ広く許可されている。このgeneric経路を誤登録archiveの正式操作にはできない。

## 決定

- Siteの通常の利用終了は`TERMINATED`で表し、liveの`Sites` collectionに保持する。archiveは誤登録・重複だけに限定する。
- 同じCustomerでの再利用は、`sites:write`を持つ許可actorが理由を伴う再有効化operationで`ACTIVE`へ戻す。終了・再有効化によって既存の予定、実績、請求、取極めを自動変更しない。
- archiveは`sites:write`を持つ許可actorだけが専用`archiveSite` Callableから実行する。入力はSite ID、必須reason、operation IDだけとし、actorと時刻はserverで確定する。
- serverは現在のAuthentication accountと同社の有効な本登録Userを再取得し、tenantとpermissionを照合する。一つのtransactionでactive Site、同ID archive、状態を限定しない全業務参照を確認し、参照、archive衝突、不正状態ではwrite 0とする。
- reader/writer inventoryで確認した直接参照catalogは`SiteOperationSchedules`、`OperationResults`、`ArrangementNotifications`、`Billings`、`SiteEmployeeHistories`の5 collectionとする。これらは状態を限定せず同じtransactionで確認する。Company表示順はADR 0036の不存在参照除去契約を使い、表示順だけではarchiveを拒否しない。
- `DailyAttendances`と`DailyOperationsByEmployee`が保持する`siteId`は、直接参照元であるOperationResultから生成される下流snapshotであり、live Siteを参照して業務判断するdocumentではない。archiveはこれらを変更せず、直接参照catalogにも含めない。OperationResult writerのlive Site barrierとarchive transaction内のOperationResult参照確認を安全境界とする。remoteにこの生成経路を外れたlegacy documentがないことはSITE-09のpreflightまで未確認とする。
- version付きSite snapshotとreason・actor・時刻・operation IDをsame-IDの`Sites_archive`へ上書きせず保存し、active Siteを削除する。同じoperation IDの再試行だけを冪等に扱う。
- archive後の新規参照を防ぐため、Siteを新規参照または変更する全client/server writerは、同じatomic boundaryでlive Siteの存在を必須にする。このbarrierを保証できないwriterが一つでも残る間はarchive機能を有効化しない。
- generic `delete()`／`restore()`と物理deleteは使用しない。通常画面からrestoreを提供せず、緊急restoreは別の権限制御・監査・競合防止を持つoperationとして改めて承認する。
- 既存live/archive dataを一括変更せず、自動purgeと保持期限を追加しない。既存archiveのread境界は本判断だけでは変更しない。

## 理由

通常終了を`TERMINATED`へ限定すれば、過去の予定、実績、請求、履歴が同じSite IDを参照できる。一方、参照を一度も持たない誤登録・重複は業務上の意味を持たないため、安全な条件で一覧から除去できる必要がある。

専用Callable、同一transactionの参照確認、並行writer側のlive Site存在barrierを一体にすることで、参照済みSiteの除去と確認直後の新規参照作成を防げる。いずれかを省くより、archiveを有効化しない方が安全である。

## 代替案

- 誤登録も`TERMINATED`で保持する案: 誤登録・重複を正式な履歴Siteと同じ一覧へ残すため、利用要件を満たさず採用しない。
- 現行generic deleteをそのまま使う案: 参照確認漏れ、確認後競合、監査metadata不足、restore上書きを解消できないため採用しない。
- 参照確認だけをCallableへ移してwriter barrierを設けない案: 確認後に並行writerが参照を作成できるため採用しない。
- 通常利用者向けのごみ箱とrestoreを追加する案: active/archive同ID競合、復旧監査、公開範囲の追加要件があり、誤登録archiveの必要範囲を超えるため採用しない。

## 影響と互換性

- `Sites` path、document ID、field、`ACTIVE`／`TERMINATED`値、Customer変更、既存OperationResult・Billingのsnapshot契約を変更しない。
- 現行UIのgeneric削除入口、generic delete／restore、Rulesのlive deleteとarchive write許可は本判断と一致しない。専用Callableと全参照barrierが揃うSITE-05まで正式archiveとして使用しない。
- SITE-05ではSite masterだけでなく、5つの直接参照collectionでSite参照を作成・変更するtransaction writerのlive Site存在guardが必要になる。archive barrier以外の配置・通知・実績・請求処理変更へscopeを広げず、下流snapshotをarchive時に書き換えない。
- 既存archive documentの有無・形状はremote未確認である。本判断で読取り、変換、復元、削除を行わない。
- schema package、index、Dev／Prod、remote dataは本判断の文書化では変更しない。

## 移行とrollback

この判断の文書化にdata migrationはない。既存live/archive dataを予防的に変換しない。実装後に停止条件へ達した場合はarchive入口を閉じ、live deleteとarchive client writeの拒否を維持したままlocalで停止する。文書・codeはdata変更前ならreview済みcommit単位でrevertできる。archive済みdataが生じた後はcode revertだけで復旧せず、対象とactive同ID競合を確認した別承認の緊急restoreを使う。

## 検証

- source contractでSiteのgeneric delete／restoreが正式archive経路から到達不能で、専用`archiveSite`だけが使用されることを確認する。
- Firestore Emulatorで許可actor、read-only actor、直接permission、未知role、non-admin super-user、temporary、disabled、他tenantを含むactor matrixを確認する。
- ACTIVE／TERMINATED、同ID archive衝突、各参照collection、参照なし、同operation再試行、別operation再試行、並行参照作成について、成功または拒否とwrite 0を確認する。
- 全Site参照writerが同じatomic boundaryでlive Site存在を検査することをsource contractとEmulatorで確認する。未対応writerがあればarchiveを有効化しない。
- archive snapshot、reason、actor、時刻、operation IDのallowlistと、通常restore入口不在を確認する。
- SITE-05実装時のchange classは最終差分に応じて`ui-css-layout`、`application-logic`、`data-contract-schema-migration`のunionとする。Dev／Prod・remote/data操作は別承認とする。

## 再検討条件

法令・契約・社内規程等によりSiteの削除・匿名化または保持期限が必要になった場合、参照済みSiteにもarchiveが必要になった場合、または運営者による個別復旧が必要になった場合に、通常archiveとは分離した新しいcheckpointとして再検討する。
