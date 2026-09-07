# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進むための案内です。taskのowner、交代状態、Git先端、過去の検証結果は保存しません。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。

## 現在の作業

- 製品は試験運用中。Customer状態改修はCS-03、Customer archive safetyはCAS-04までlocal実装・検証・Git統合を完了しました。CS-04とCAS-05のDev反映・利用者受入れは、マスタデータ管理改修後まで延期しています。
- 2026-09-04の反省会に基づくproject rule整理の判断は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)、現在の入口と必読routeは[project rule index](../../governance/project-rules.md)を正とする。共通ガバナンス、生成AGENTS、lock記録済みmanaged reference、verification policy、製品code・data・environmentはこの整理の変更対象外である。
- 仕様・実装・進捗・実行証拠をこの案内へ複製せず、以下の各正本を参照します。remoteのlive状態は別承認の直接照合がない限り未確認です。
- governance移行の実行範囲・未検証事項は[移行記録](../migrations/2026-09-03-governance-3.0.0.md)、通常startupへの変更判断は[ADR 0045](../decisions/0045-governance-3-normal-startup.md)を参照します。

## 未決事項と承認

- Customer archive safetyは[確認済み仕様](../specification.md)、[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)、[工程・進捗](../roadmaps/customer-archive-safety.md)、[実装設計](customer-archive-safety.md)に従いCAS-04までlocal完了した。[local受入れ証拠](../verification/customer-archive-local-acceptance.md)を参照する。
- Spark用standalone Developer taskは中止済みで再利用しない。SiteはSITE-08のLocal追加確認で再現した不具合を修正し、最終buildと承認済みcleanupまで完了した。現在の残作業は[Siteロードマップ](../roadmaps/site.md)、実測は[SITE-08証拠](../verification/site-08-local.md)を正とする。破棄された別taskのEmployee改修案は採用しない。Dev/Prod、remote data/migration、package、緊急restore、retention/purge、OUT-08以降は別承認である。
- Sparkはこの規模・必読範囲に適さないという試験結果として扱い、再採用しない。反省会の恒久判断は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)、実行履歴は[CAS-02試験記録](customer-archive-cas02-developer-trial.md)に保存し、一時メモへ依存しない。

## 次の作業

最優先は、利用者が2026-09-07に指定した「4マスターのDev反映直前までの準備」である。下記の[準備作業一覧](#dev反映前の準備作業一覧)を起点に、通常startup後、未確定の対象・手順を具体化する。これは次作業の案内であり、release契約・反映可否の確定や外部操作の承認ではない。Dev反映後の技術確認・利用者受入れは後続に残す。

1. Outsourcerは特定の協力会社masterであり、同じ外注先を配置へ複数回登録できる方式を維持する。旧試行の人数集約方式は採用しない。[Outsourcerロードマップ](../roadmaps/outsourcer.md)のOUT-01からOUT-07はlocal完了し、90%である。[OUT-07証拠](../verification/outsourcer-out07-local-integration.md)に自動検証、write actorのUI smoke、利用者承認済みの拒否actor自動代替、省略、cleanupを記録した。配置・通知・実績・請求・帳票のFirestore更新経路は変更していない。OUT-08のDev反映・受入れはマスタ管理改修後の別承認である。
2. Site masterのSITE-08は[SITE-08検証記録](../verification/site-08-local.md)のLocal試験・build・cleanupまで完了した。次はDev反映前のlegacy確認とDev・remote接続であり、[Siteロードマップ](../roadmaps/site.md)のSITE-09として別承認である。
3. Employee masterの現在工程・進捗は[Employeeロードマップ](../roadmaps/employee.md)、Local統合の実測は[EMP-08記録](../verification/employee-08-local.md)を正とする。次のEMP-09ではマスタ一連改修後にDev反映・旧client・必要data/索引・対象service・復旧を別承認する。通常archive APIのDev反映、対象tenant開放、remote・実data・migrationは承認前に開始しない。UI（見た目）の追加変更も事前に理由・影響・代替を提示して利用者判断を得る。全体範囲は[正式運用ロードマップ](../roadmaps/airguard-v2.md#次の作業)を参照する。
4. マスタデータ管理の一連の改修が揃った後、[Dev受入れの実施時期](../roadmaps/airguard-v2.md#今後のdev受入テストの実施時期)に従い、Customer状態のCS-04とarchive safetyのCAS-05を含むDev反映・権限別受入れ、他マスタとの関連操作をまとめて行う。停止済み専用Auth/Emulator/serverを再利用せず、別承認前にDev・remote・実dataへ進まない。

## Dev反映前の準備作業一覧

利用者は残作業を新しい通常taskへ引き継いで進めることを指示した。到達点はDev反映直前であり、前の説明に含まれていた「Dev反映済み・利用者受入れ開始待ち」まで自動的に進めない。以下は未実施の準備・確認事項で、実施順と必要な変更は各正本・actual sourceへ照合して具体化する。機能別進捗は各roadmapを正とし、この一覧で加点しない。

### 共通の準備

- [ ] primary repository、branch、HEAD、未統合差分、4マスター改修の包含を確認する。Employee用branchで横断release作業を始める前に、project ruleに沿ってbranchの作業範囲を決める。
- [ ] Hosting、Functions、Rules、必要な検索索引と、参照保護で変更した予定・実績・請求・背景処理を洗い出し、反映対象候補と対象外を分ける。
- [ ] 旧clientの継続利用、更新・再ログイン、client/serverの互換性、反映順序、一時停止の要否を検討する。
- [ ] 変更差分とreader/writerから、既存data確認が必要なfield・利用経路・範囲を絞る。全件診断・一括修復・migrationを一律前提にしない。
- [ ] 対象commit・service・data影響・必要なbackup・停止条件・復旧・検証を具体化した反映計画を提示する。実行手順は[Dev runbook](../runbooks/dev-deployment.md)、data対応は[data migration手順](../runbooks/data-migrations.md)へrouteする。
- [ ] 受入れ用の会社・権限別account・合成data、試験で許可する操作、外部通知等の扱い、終了後の処置を具体化する。

### マスター固有の準備

- [ ] Customer: 状態表示・契約終了/復帰・絞込み等の新UIについて、CS-04に残る利用者判断の対象画面と確認順を提示する。[状態roadmap](../roadmaps/customer-status.md)を参照する。
- [ ] Customer: archive APIと関連参照writer/Rulesの反映整合を確認する。既存flat archive等の確認が必要な範囲を決め、旧形式が存在しても自動変換しない。[archive roadmap](../roadmaps/customer-archive-safety.md)を参照する。
- [ ] Site: 自動終了が参照する既存予定の必須field、工期、自動終了対象への影響、公開・実行開始時期を検討する。
- [ ] Site: archive形状、通常原本/archiveの同ID、埋込みCustomer、取極め、下流の日次snapshotについて、SITE-09が求める必要範囲の確認を具体化する。[Site roadmap](../roadmaps/site.md)を参照する。
- [ ] Outsourcer: 既存data・旧client・実利用actorの確認範囲を決める。会社管理者/strict managerのwrite、契約終了後の選択継続、同じ協力会社の複数配置、archive/delete入口不在をDev確認表へ落とす。[Outsourcer roadmap](../roadmaps/outsourcer.md)を参照する。
- [ ] Employee: 通常archive APIは`MASTER-DEV-PREFLIGHT-01`のNo.2で通常indexへlocal接続した。通常の許可tenant設定は既定空集合のまま維持する。No.3で公開契約・正常/拒否・専用demo分離を検証し、remote公開・tenant開放と区別する。
- [ ] Employee: 日次2種・BillingのEmployee参照索引と実明細の整合を確認する範囲を決め、必要な補完だけを別途具体化する。限定dry-runの成功だけでarchiveを開放しない。
- [ ] Employee: 参照writer、背景再生成処理、旧Employee削除triggerのUser/Auth連鎖削除を無作用にする処理を反映対象へ含める。
- [ ] Employee: 既存保険map/世代値の互換性、User/Auth・予約状態、住所の実provider接続などDev固有の確認項目を用意する。[Employee roadmap](../roadmaps/employee.md)、[実装記録](employee-master.md)を参照する。

### 結果次第で必要となる対応と最終準備

- [ ] 必要なdata変換・索引補完が確認された場合だけ、対象・件数・変更内容・dry-run・backup・apply・post-check・復旧を提示する。実data変更をこの一覧だけで承認済みとしない。
- [ ] DevのCallable公開権限・認証・設定に不足が判明した場合は、exact serviceと最小修正を提示する。IAM変更やtenant開放を推測で実行しない。
- [ ] 必要なlocal実装を具体化して承認範囲と照合し、review・影響別test・Emulator・文書検証を行う。見た目変更には既存の利用者判断境界を適用する。
- [ ] 最終release差分を[verification policy](../../governance/verification-policy.json)で分類し、必要gateと証拠失効条件を固定する。Dev buildは承認済みcheckpointのexact commandで行い、sourceとartifact、接続先、Emulator無効を確認する。
- [ ] Dev反映前の未確認事項・必要承認を明記し、具体的な反映計画と受入れ表を利用者へ渡す。未承認・未検証が残る間は反映準備完了としない。

### 利用者確認待ち

1. Customer新UIの操作・見た目に変更希望があるか。未確認なら対象画面と確認順を先に用意する。
2. Devを現在利用している人・協力会社がいるか。一時停止の可否と時間帯の制約。
3. 既存のテスト専用会社・権限別accountを使えるか。なければ準備案を提示する。資格情報をchatへ記載させない。

上記への回答はまだ得ていない。独立して可能なlocal調査・具体化は進める。remote read、Dev build/deploy、実data変更、migration、IAM変更等は[環境・承認rule](../project-rules/environment-and-approval.md)と既存runbookへ照合し、対象を示して必要な承認を得る。今回の引継ぎで権限を拡張しない。

### 今回の停止点より後の作業

DevへのFunctions/Rules/Indexes/Hosting反映、必要なdata変更、反映済みversion・Functions状態・索引準備・browser到達性・正常/拒否経路・logの技術確認、一時停止解除、利用者の権限別受入れは後続である。今回準備する手順・受入れ表には含めるが、Dev反映直前という停止点を越えて実行しない。将来のrestore/purge、transaction全体の刷新、未承認package変更は既存の別工程に残す。

## 参照

- [確認済み仕様](../specification.md)
- [Siteマスター改修ロードマップ](../roadmaps/site.md)
- [Outsourcerロードマップ](../roadmaps/outsourcer.md)
- [Outsourcer OUT-07 local統合確認の進行記録](../verification/outsourcer-out07-local-progress.md)
- [Outsourcer OUT-07 local統合確認証拠](../verification/outsourcer-out07-local-integration.md)
- [Site SITE-08 local統合確認証拠](../verification/site-08-local.md)
- [Customer取引状態roadmap](../roadmaps/customer-status.md)
- [Customer archive safety roadmap](../roadmaps/customer-archive-safety.md)
- [Customer archive safety実装設計](customer-archive-safety.md)
- [Customer archive safety local受入れ証拠](../verification/customer-archive-local-acceptance.md)
- [Customer状態のlocal検証記録](../verification/customer-02-status-local.md)
- [確認事項台帳](pending-confirmations.md)
- [local UI手順](../runbooks/local-ui-testing.md)
- [project rule index](../../governance/project-rules.md)
- [project rule整理の判断](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)
