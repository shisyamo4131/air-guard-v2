# 0060 共通archive・物理削除・住所座標契約とEmployeeへの適用

- 日付: 2026-09-06
- 状態: Accepted
- 採用範囲: 共通原則・Employeeの方式変更と最終提案の操作/閲覧/段階移行条件。下記の実装設計・運用案は実装済みを意味しない。
- 関連仕様: [共通データ仕様](../specification.md#共通データ仕様)、[Employee](../specification.md#employeeの操作権限と保持)
- 一部置換: [ADR 0057](0057-employee-hard-delete-and-archive-deferral.md)の直接物理削除・archive延期、[ADR 0058](0058-employee-full-read-and-geocoding-scope.md)の従属writer変更禁止。全項目read・通常編集・退職・保険のactorと状態条件は維持する。
- 適用計画: [Employeeロードマップ](../roadmaps/employee.md)。今回はEMP-01の設計・review・文書保存で止め、EMP-02以降を開始しない。

## 背景と決定

利用者は、EmployeeのarchiveをSite同様の別collection移動へ戻し、従属側の参照整合性の設計を委ねた。また、archive・物理削除と住所・座標はcollectionごとの独立判断ではなく、システム共通仕様としてまとめるよう指示した。採用内容の唯一の正本は現行仕様の共通節とし、本書は理由・影響を記録する。

共通の実装調査文書は存在するが、adapterの古い共通挙動とCustomer/Siteの専用実装が混在し、確認済み共通原則への入口が不足していた。共通仕様を新設し、implementation文書は現行差分と設計、master固有仕様はactor・対象・従属・住所用途等へ役割を分ける。

## EMP-01最終提案の追加採用

2026-09-06、利用者は最終提案を採用し確定を承認した。姓名と表示名の同時変更では明示表示名を優先し、作成を在職一覧へ集約する。任意・手入力・重複可のcode、独立した表示名カナ、既存の検索・期間候補条件を維持する。archive全項目readは原本と同じ会社管理者・既知6業務roleとし、通常候補への混入・直接CUD・restoreを拒否する。archive管理一覧は追加しない。

段階移行ではEMP-02から原本/archiveのreadと直接CUD拒否を揃え、未移行editorをlocalで一時read-onlyにする。EMP-03/04で再開し、Devへ途中状態を反映しない。EMP-05へ参照保護・索引・旧trigger停止・専用archiveを含め、9工程・重み合計100を確定する。物理削除の実行は後続専用工程へ分け、保持・自動実行・最小ID記録の具体運用は未採用のままFUT-0146へ残す。

旧全文writerを暫定許可する方式は採らず、専用operationの所有field保存とraw期待値を使う。保険mapが履歴復元で同値に戻る場合も古い要求を拒否するため、保険別に巻き戻さない局所世代値を採る。全Employee共通revision/lockやpackage変更には広げない。具体的なwire・metadata・移行/受入れは[設計契約](../implementation/employee-master.md#通常保存の技術契約)に集約する。

## Siteから再利用するものと限界

`functions/modules/sites/archiveSite.js`は現在User・System・原本・同ID archive・5従属queryを同transactionで検査し、version付きsnapshotと監査をcreateして原本をdeleteする。`siteArchiveDocumentContract.js`がsnapshot/監査を検証する。Rulesと参照writerにも通常Siteの存在確認がある。これらの設計構成をEmployeeへ使い、Siteのfield・actor・依存一覧をそのまま流用しない。

Siteの通常製品には物理削除・restore操作がなく、汎用adapterのrestore APIを安全な運用の提供証拠にはしない。物理削除は新設設計として扱う。Customer/Siteの保持・運営者操作、Outsourcerの操作非提供を、共通原則の採用で解除しない。archive後の物理削除はarchive対象masterの契約とし、User/Authの専用直接削除・予約解放・業務transactionの削除へarchive前提を追加しない。

## 理由と代替

状態flag方式も移動方式も、参照を追加する側と削除側の整合が必要である。別collection移動は既存方式と揃い、通常queryへ新しいarchive状態条件を加えず候補から除外できる。参照なし検査だけの削除、候補UIだけの制限、夜間実行だけでは同時保存・遅延処理を保護できないため採用しない。

参照IDが変わらない更新ごとの全Employee読取り、全master共通の参照数counter・lock・ledgerは採用しない。保存前後の実dataから追加IDだけを検査し、それを強制できない操作に限定してserver保存を使う。具体設計と未確認は[Employee設計](../implementation/employee-master.md#employeeのarchive設計)に集約する。

## 影響・互換性・移行

共通仕様の記録とEmployeeのarchive設計を本branchのEMP-01へ含める。Employee参照に必要なwriter・Rules・背景処理・query用fieldは限定例外であり、金額計算、配置の業務規則、他masterのarchive方式を変えない。既存Billing埋込み参照等の検査可能性を含め、必要な既存data対応を確定してからarchiveを開放する。実dataのbackfill、外部接続、package変更、Dev/Prodは別承認のままとする。

住所・座標は共通失敗契約をEmployeeの保存へ先行適用する。他masterの不足は既存FUT-0140〜0143へ残し、この設計整理で全writerを同時変更しない。住所必須項目や利用目的の差は正当な固有条件であり、全住所文字列を自動geocoding対象にしない。

## 物理削除の設計境界

archive済み本体の抹消、直前の従属再検査、不整合時の拒否・原因記録は共通仕様とする。実行頻度・保持期間・エラー表示用collectionの初期化・自動実行は未採用であり、今回は設計案までとする。

archive本体を消すと同ID再作成を拒否する根拠も失われる。推奨案は本体とarchive監査を削除し、別のserver-only記録に使用済みIDと操作結果の最小情報だけを残す方式である。これは「Firestore上の関連情報を一切残さない」方式ではないため、保持項目・用途・期間と合わせて物理削除工程のreview対象として明示する。新collection名や保存fieldをここで実装しない。詳細は[共通物理削除設計案](../implementation/archive-restore.md#物理削除の設計案)へ集約する。

## rollback

文書変更は所有差分のcorrective commitで戻せる。将来の実装rollbackでは原本を汎用restoreで上書きせず、問題の操作を停止する。archive済みdataや物理削除済みdataはcode rollbackで復元されない。対象を限定した別承認の復旧が必要で、旧User削除trigger・広域writeの再開を復旧策にしない。

## 検証・再検討条件

設計文書は実装可能性・失敗経路・securityの独立reviewとcomprehensive 5 gateで照合する。実装時は許可/拒否actor、他tenant、従属あり/検査失敗、archiveと参照追加の両順序、明細とID集合の不一致、参照不変時の読取り数、遅延再生成、同ID衝突、再送、User/Auth不変を確認する。住所は成功/失敗/無変更/0座標/古い応答/DB保存失敗を共通受入れ例とする。runtime・実環境・既存dataはこの文書検証から成功と扱わない。
