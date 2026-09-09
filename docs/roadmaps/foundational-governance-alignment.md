# 根本ガバナンス整合phaseロードマップ

- 状態: In progress
- 開始日: 2026-09-09
- 現在の進捗: 10%
- 目的: 利用者が提示するプロジェクト固有の根本ルールを正本へ反映し、既存機能を新ルールへ小さく安全に整合させる。
- 実装順: Customer管理 → Site管理 → Employee管理 → Outsourcer管理 → その他transaction系機能。
- 進捗方式: milestone weightは工程完了の比率であり工数見積りではない。合計100。各機能milestoneは、着手時に利用者と合意した小checkpointへweightを配分し、各checkpointの実装、必須検証、必要なmigration、固定commitのDev反映・受入れが完了した場合だけ部分加点できる。ルール整理だけ、local実装だけ、未承認Dev待ちは製品milestoneへ加点しない。

## フェーズ原則

- 新しいルールごとに、project governanceとしての妥当性、正本、既存仕様・ADR・実装との矛盾、互換性、migration、rollback、testを確認してから反映する。利用者は2026-09-09にルール提示完了を明示し、FGA-01を完了した。後続の新規ルール追加は別の仕様変更として同じ確認を行う。
- 製品改修は機能順を守りつつ、対象operation、変更規模、data・外部作用・破壊性に応じて利用者と小checkpointを決める。一つのcheckpointで安全にreview・rollback・Dev受入れできない場合はさらに分割する。
- 各checkpointは `現行挙動と全reader/writer確認 → 変更契約・例外分類・data互換・rollback・test合意 → 実装 → 影響別自動検証 → 必要な環境検証 → 固定commitのDev反映・受入れ → 文書・証拠・Git closeout` の順で閉じる。
- 破壊的変更、data migration、Dev/Prod、remote read/write、外部作用、pushは既存runbookに従い個別承認する。このphase、branch、前checkpointの承認を後続操作へ拡張しない。
- branchはphaseの作業境界であり、未完了checkpointをまとめてDevへ出す根拠にしない。Dev反映方法とmain統合単位は各checkpointの開始時に決める。

## Milestones

| マイルストーン | 重み | 得点 | 状態 | 完了条件 |
|---|---:|---:|---|---|
| FGA-01 新ルールの検証・ガバナンス反映 | 10 | 10 | Completed | 利用者が提示完了を明示し、全ルールの正本、相互整合、置換ADR、実装差、検証が揃う |
| FGA-02 Customer管理 | 18 | 0 | In progress | Customerの全通常operationと例外を小checkpointで整合し、必要なdata処置とDev受入れまで完了する |
| FGA-03 Site管理 | 18 | 0 | Not started | Customer完了後、Siteの全通常operationと例外を同条件で完了する |
| FGA-04 Employee管理 | 18 | 0 | Not started | Site完了後、Employeeの機微情報分離を含む通常operationと例外を同条件で完了する |
| FGA-05 Outsourcer管理 | 16 | 0 | Not started | Employee完了後、Outsourcerの全通常operationと例外を同条件で完了する |
| FGA-06 その他transaction系機能 | 20 | 0 | Not started | master完了後、残るtransaction、Rules、Callable、data互換を小checkpointで整合し、Dev受入れとphase closeoutを完了する |

## 現在地

- [Firestore document構成](../specification.md#firestoreドキュメントの構成)と[ADR 0064](../decisions/0064-sensitive-firestore-document-boundaries.md)を採用し、Company振込先の現行root同居を未解消の実装差として記録した。
- [通常業務のtenant信頼境界](../specification.md#テナントと認証)と[ADR 0065](../decisions/0065-tenant-trust-normal-business-authorization.md)を採用した。FGA-02-RULES-01ではCustomer通常Rulesからrole・schema・operation field検査を外し、有効な本登録User、tenant、actor UIDへ簡素化した。固定commit `3c67a95e`をFirestore・HostingへDev反映し、会社管理者による合成Customerの作成、更新、再読込後のlistener正本表示まで完了した。[実行証拠](../verification/fga-02-customer-rules-dev.md)を参照する。archive・物理deleteの例外境界、Functions、schema、既存dataの変換は変更していない。
- [Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)と[ADR 0066](../decisions/0066-pre-production-document-level-last-write-wins.md)を採用した。Prod公開前はdocument単位last-write-wins、field単位方式は未確定の将来案とし、既存の部分writer、競合拒否、Manager非依存はまだ変更していない。
- CompanyとUserは認証・tenant管理の基点としてtenant共通権限とdocument単位last-write-winsの対象外にし、現在の厳密なactor・field・validation・競合制御を維持する。Companyの機微情報分割は別の確定規則として維持する。
- [Component階層・useFetch・表示data・従属参照](../decisions/0067-component-fetch-and-dependent-reference-boundary.md)を採用した。主対象はlistener、従属補完は共有cacheを優先し、missing表示と物理削除時の限定検査を定めた。製品実装はまだ変更していない。
- 利用者はFGA-02-RULES-01の変更契約とDev releaseを承認し、実装・必須検証・独立review・Dev反映・正常経路の受入れを完了した。FGA-02全体の得点は、残るCustomer application／UI checkpointの粒度と配点を合意していないため0のままとし、完了済みcheckpointを未実施へ戻す意味には使わない。次はdocument単位last-write-wins、Manager利用、listener正本、role別UXの既存実装差を調査し、次の小checkpointを合意する。

## 完了条件

- 提示された全ルールが一つのcurrent specificationとproject ruleへ矛盾なく反映され、置換された判断と未決事項が区別されている。
- Customer、Site、Employee、Outsourcer、その他transaction系の順で、承認済み全checkpointが実装・検証・必要なDev受入れまで完了している。
- 現行仕様と実装の既知不整合が0件、または利用者が明示承認した別phaseへ根拠・risk・開始条件付きで移されている。
- 最終差分のchange class union、必須gate、review、verification receipt、Git状態、未検証・残存risk、rollbackがcloseoutされている。
