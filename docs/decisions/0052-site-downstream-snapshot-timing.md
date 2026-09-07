# 0052 Site下流情報のsnapshot時点

- 日付: 2026-09-05
- 状態: Accepted
- 関連仕様: [取引先・現場・取極め](../specification.md#取引先現場取極め)
- 関連判断: [0003 稼働実績と請求の整合性](0003-operation-result-billing-integrity.md)、[0031 必要十分なデータ境界](0031-proportional-data-boundary-and-change-safeguards.md)、[0048 SiteのCustomer変更と履歴snapshot](0048-site-customer-change-and-historical-snapshots.md)、[0051 Siteの誤登録archive](0051-site-mistaken-registration-archive-boundary.md)

## 背景

現行OperationResultは作成時またはgroup key変更時にSiteから`customerId`と適用取極めを保存するが、Site名称、住所、警備種別等は保存しない。Billing PDFは生成時にlive Siteを取得して名称を表示するため、Site master変更後に過去請求を再生成すると、保存済みCustomer・取極めと現在のSite名称が混在し得る。Site内の埋込みCustomerもCustomer更新triggerの時点を表し、画面ごとに参照時点が一致しない。

予定、実績、請求書では必要な時点が異なる。予定は現在の業務計画として最新masterを使う一方、実績と確定請求書は後日のmaster変更から独立して再現できる必要がある。

## 決定

- SiteOperationScheduleは計画dataとして`siteId`を保持し、稼働実績へ変換されるまではSite名称・Customer・住所・警備種別・取極めをlive Siteから表示・選択する。Site master変更だけを理由に予定documentへsnapshotを複製または一括更新しない。
- OperationResultは作成時にSite名称・表示名、Customer ID・表示情報、住所、警備種別、適用取極めを実績snapshotとして固定する。Site masterの後日の変更では既存OperationResultを更新しない。
- Site・稼働日・勤務区分等を明示的に訂正して適用条件が変わる場合だけ、請求影響、発行状態、before/after、actor、reasonを確認する専用の実績訂正契約でsnapshotを更新する。Site masterの空更新または通常編集を再同期操作として使わない。
- Billing draftと未確定の請求表示はOperationResult snapshotを集計し、live Siteを請求表示の正本にしない。請求確定時に、そのrevisionで表示するSite・Customer・取極め由来の請求明細情報をBilling側へ固定する。
- 確定後の請求書再生成は保存済みBilling revision snapshotを使う。訂正・再発行は旧snapshotを書き換えず、新しいrevisionを作る。
- 現在・予定を扱う画面と帳票はlive Site、稼働実績を表す画面と帳票はOperationResult snapshot、確定請求書はBilling revision snapshotを使う。
- Site master変更は将来作成される実績・請求へ反映し、既存OperationResult・確定Billingへ自動反映しない。
- snapshot fieldを持たないlegacy documentは推測で過去値をbackfillしない。移行までは現行のlive fallbackと再現不能riskを明示し、具体的な件数・shapeと正しい過去値の根拠が確認できた場合だけ別承認のmigrationを設計する。

## 理由

予定まで全fieldをsnapshot化するとmaster訂正が計画へ反映されず、同期処理が増える。反対に実績・確定請求をlive masterだけで表示すると、後日のSite名称、Customer、住所、警備種別、取極め変更によって過去記録と再生成帳票が変わる。予定、実績、確定請求の各境界でsnapshot時点を分けることで、現在の計画と履歴再現性の両方を保てる。

## 代替案

- 全下流dataで常にlive Siteを参照する案: 過去実績・請求書の再現性を保てないため採用しない。
- SiteOperationSchedule作成時に全fieldをsnapshot化する案: 予定期間中の正当なmaster訂正を自動反映できず、実績時点とも一致しないため採用しない。
- OperationResultではIDだけを保持し、請求確定時だけsnapshot化する案: 実績画面・実績帳票がmaster変更で変わるため採用しない。
- legacy documentへ現在値を一括backfillする案: 過去時点の正しい値を復元した証拠にならず、誤った履歴を確定させるため採用しない。

## 影響と互換性

- 現行のSite、SiteOperationSchedule、OperationResult、BillingのpathとIDを維持する。既存OperationResultの`customerId`と`agreement`をSite master変更で書き換えない。
- OperationResultとBillingへsnapshot fieldまたはrevision構造を追加する実装が必要になる可能性が高い。正確なfield shape、所有operation、Rules、schema package要否は各transaction機能の実装checkpointで全reader/writerを確認して決める。
- 現行Billing PDFのlive Site名称取得は本判断と一致せず、Billing改修まで既知の再現不能riskである。
- Site master改修だけではOperationResult・Billing・帳票writerを変更しない。必要な互換readerと表示切替はtransaction側の承認済みcheckpointで実装する。

## 移行とrollback

この判断の文書化ではdata migrationを行わない。legacy documentへ現在のSite値を推測backfillしない。新snapshotの実装時は旧documentを読める互換readerを先に用意し、新規writeを切り替え、必要なrollback期間は新fieldを任意として扱う。data変換前の文書・codeはreview済みcommit単位でrevertできる。確定Billing revisionが作成された後は旧snapshotを削除・上書きせず、readerの互換経路を維持して修正する。

## 検証

- Site名称、Customer、住所、警備種別、取極めを変更し、変更前のOperationResult snapshotと確定Billing revisionが不変で、変更後に作成した実績・請求だけが新値を使うことを確認する。
- SiteOperationScheduleの表示はlive Site変更を反映し、予定documentへ不要なsnapshot writeが生じないことを確認する。
- Billing draftがOperationResult snapshot、確定請求書がBilling revision snapshotを使い、live Site欠損・archive・変更後も同じ確定内容を再生成できることを確認する。
- legacy snapshot欠損、明示的な実績訂正、請求済み実績、再発行revision、同時Site変更の失敗経路を確認する。
- 実装時のchange classは最終差分に応じて`application-logic`、`data-contract-schema-migration`、帳票・画面変更がある場合は`ui-css-layout`とのunionとする。Dev／Prod・remote/data・migration・packageは別承認とする。

## 再検討条件

予定確定時点を法令・契約上固定する必要が確認された場合、OperationResult作成と業務確定が別時点で履歴上区別される場合、または請求確定・revision lifecycleの正式仕様が異なる時点を要求する場合に再検討する。
