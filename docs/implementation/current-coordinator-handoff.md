# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進むための案内です。taskのowner、交代状態、Git先端、過去の検証結果は保存しません。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。

## 現在の作業

- 製品は試験運用中。Site SITE-09、Customer状態CS-04、Customer archive safety CAS-05、Outsourcer OUT-08、Employee EMP-09のDev受入れを完了し、各roadmapを100%とした。
- 完了済みの4マスター共通UI、route認可、Dev受入れ、配置管理回帰は[正式運用ロードマップ](../roadmaps/airguard-v2.md)と各verification receiptを正とし、この再開案内へ実測結果を複写しない。
- 仕様・実装・進捗・実行証拠をこの案内へ複製せず、以下の各正本を参照します。remoteのlive状態は別承認の直接照合がない限り未確認です。

## 未決事項と承認

- CAS-05は参照なしarchive、経理account境界、active Site参照中のarchive拒否と拒否後の不変をDevで確認した。合成Site・Customerは各action-time承認後にarchive済みである。[roadmap](../roadmaps/customer-archive-safety.md)、[Dev受入れ結果](master-dev-acceptance-plan.md#no10後のcustomeroutsourceremployee-dev受入れ結果)を正とする。
- 通常Employee archive allowlistは空である。見た目・操作感、Prod、実data補完、package、緊急restore、retention/purgeは別工程である。Spark taskと破棄済みEmployee案は再利用しない。
- Sparkはこの規模・必読範囲に適さないという試験結果として扱い、再採用しない。反省会の恒久判断は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)、実行履歴は[CAS-02試験記録](customer-archive-cas02-developer-trial.md)に保存し、一時メモへ依存しない。

## 次の作業

現在は[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)のFGA-02 Customer管理である。CompanyとUserは現行の厳密な実装を維持する。FGA-02-RULES-01はCustomer通常Rulesを有効User・同一tenant・actor UIDへ簡素化し、commit `3c67a95e`のFirestore／Hosting Dev反映と会社管理者の作成・更新受入れまで完了した。[実行証拠](../verification/fga-02-customer-rules-dev.md)を参照する。合成Customer `FGA02001`は後続確認用に保持する。

FGA-02-CUSTOMER-UPDATE-01のlocal実装はcommit `6bf82e5264f72b39c540eb68c96b18690385198e`へ固定した。旧domain Manager分類はcommit `25069a79e398ad3fa98b960fb758f18f053238e0`、Customer初回実装はcommit `9bd4d43c23bf113790add10691dc91b7445a99d4`である。分類基準は[ADR 0069](../decisions/0069-domain-manager-editable-state-ownership.md)とcommit `b89e5c86`で訂正し、Customer実装もcommit `79301b04ebaf5aab4898f1c122677780b11d9afc`へ訂正した。現行のManager分類はFirestore上の通常のmaster data全般へ適用し、Customer・Site・Employee・Outsourcerを最初の適用例とする。Company・User等の例外境界は維持する。

Manager訂正と一般化したgovernanceはmerge commit `2eeb502bf163a5952f24a02a2e2f5da58ac26df6`として`main`へ統合し、GitHub Actions run #10でHostingへDev反映した。その後、FGA-02-CUSTOMER-MANAGER-SIMPLIFY-17として、Customer両Managerをbase Managerの既定editor・form validation・mode管理・error eventへ戻し、単数activatorを`toCreate`／`toUpdate`へ分離し、listener由来instanceを直接接続して編集中draftも最新document全体へ置き換える補正を進めている。既存の利用者Local／Dev受入れは補正前の履歴証拠であり、SIMPLIFY-17のruntime証拠ではない。現行routeにはAutocompleteのcreatable callerがないため、そのruntimeも未確認である。次はSIMPLIFY-17を固定commitへまとめ、利用者LocalとDevの必要範囲を承認後に検証する。FGA-02得点は0のままとする。

1. [Outsourcer](../roadmaps/outsourcer.md)はOUT-08まで完了し100%。合成masterは契約終了状態で保持し、transaction dataは作成していない。
2. Site masterは[SITE-08検証記録](../verification/site-08-local.md)のLocal統合と[SITE-09検証記録](../verification/master-dev-site-create-correction.md)のDev反映・機能受入れを完了し、[Siteロードマップ](../roadmaps/site.md)を100%とした。見た目・操作感、Site自動終了公開、既存data全件検査・補完、Prodは別工程である。
3. [Employee](../roadmaps/employee.md)はEMP-09まで完了し100%。合成Employeeは在職状態で、archive・User／Auth操作は行っていない。
4. [Customer状態](../roadmaps/customer-status.md)はCS-04、[archive safety](../roadmaps/customer-archive-safety.md)はCAS-05まで完了し、ともに100%。今回の合成Customer・Siteはarchive済みである。

## Dev反映前の準備作業一覧

利用者は残作業を新しい通常taskへ引き継いで進めることを指示した。到達点はDev反映直前であり、前の説明に含まれていた「Dev反映済み・利用者受入れ開始待ち」まで自動的に進めない。以下は未実施の準備・確認事項で、実施順と必要な変更は各正本・actual sourceへ照合して具体化する。機能別進捗は各roadmapを正とし、この一覧で加点しない。

### 共通の準備

- [x] No.1でprimary repository、branch、HEAD、未統合差分を確認し、`codex/master-dev-preflight`を4マスターの横断release準備branchとして開始した。No.4で4マスター改修の包含をsource差分と正本へ照合した。
- [x] Hosting、Functions、Rules、必要な検索索引と、参照保護で変更した予定・実績・請求・背景処理を洗い出し、反映対象候補と対象外を分けた。[No.4 release surface inventory](master-dev-release-surfaces.md)を参照する。
- [x] No.5で旧clientの書込み互換を前提にできない範囲、更新・再ログイン、boundedな無書込み時間帯、Indexes→Functions安全化→server closure→Rules→Hostingの順序、schedulerとEmployee archive tenant開放の分離、rollback境界を具体化した。[No.5 release順序](master-dev-release-surfaces.md#no5-旧clientと反映順序)を参照する。live Devの利用者・remote revision・index状態は後続Checkpointで確認する。
- [x] No.6でmaster別の既存data確認範囲、既存証拠の再利用、remoteで必要なSite／Employee参照索引確認、indexのREADY／保留／不要判定を限定した。初回releaseはEmployee archive allowlistを空、Site自動終了を未公開に保ち、補完・migrationを前提にしない。[No.6 data・index範囲](master-dev-release-surfaces.md#no6-既存dataindex確認範囲)を参照する。
- [x] No.7は初回releaseとdata作用を伴う後段を分離し、利用者から確認できた3区分のDev運用条件に基づく簡素化、backup適否、停止条件、forward correction／限定repair、解除条件を具体化した。利用者は2026-09-07に、初回は区分1だけの短い手動停止、区分3の合成data受入れとし、全体snapshot／全tenant scan／maintenanceを省略する方針を承認した。既存Admin SDKの不完全backupは全面復旧根拠に使わない。[No.7 backup・停止・rollback](master-dev-release-surfaces.md#no7-backup停止rollback計画)を参照する。
- [x] No.8で受入れ用の会社・権限別account・合成data、許可する操作、外部作用、終了後の処置とNo.10前後の担当を[受入れ計画](master-dev-acceptance-plan.md)へ具体化した。利用者は2026-09-07に4マスター全体のUIを概ね確認し、簡単な修正を反映したうえで、機能面はDev受入れへ進められると判断した。component責務・分割粒度・デザイン統一はDev受入れ後の別phaseで扱う。

### マスター固有の準備

- [x] Customer: 状態表示・契約終了/復帰・絞込み等の新UIについて、[U8-1](master-dev-acceptance-plan.md#利用者事前確認)で利用者確認を完了した。その後のDev反映・権限別受入れもCS-04で完了した。[状態roadmap](../roadmaps/customer-status.md)を参照する。
- [x] Customer: archive APIと3参照writer／Rulesの整合、exact対象のactive／same-ID archive／参照確認をNo.6へ固定した。既存flat archive等は自動変換せず、今回の変更だけを理由にCustomer全件保存形式検査を反復しない。[archive roadmap](../roadmaps/customer-archive-safety.md)を参照する。
- [x] Site: 自動終了候補をACTIVE＋工期終了日時へ限定し、候補に関係する予定field、必要index、公開時期をNo.6・No.7へ固定した。`runDailySiteTermination`はdata確認・snapshot・別承認後まで未公開とする。
- [x] Site: Site query field、工期派生値、任意revision、archive形状／同ID、埋込みCustomer、直接5参照の確認範囲をNo.6へ固定した。日次snapshotを過去値として推測backfillしない。[Site roadmap](../roadmaps/site.md)を参照する。
- [x] Outsourcer: status非制限の一覧・選択、会社管理者／exact manager、重複配置、archive／delete入口なしを前提に、受入れ対象だけのexact保存確認へ限定した。全件scan・migrationは行わない。[Outsourcer roadmap](../roadmaps/outsourcer.md)を参照する。
- [x] Employee: 通常archive APIを`MASTER-DEV-PREFLIGHT-01`のNo.2で通常indexへlocal接続し、No.3で公開契約・正常/拒否・専用demo分離を検証した。通常用許可設定は既定空集合のまま維持する。実測は[Dev反映前Local検証記録](../verification/employee-dev-preflight-local.md)を参照し、remote公開・tenant開放は別承認とする。
- [x] Employee: 選択tenantの予定・実績・通知・日次2種・Billingをraw明細から完全走査し、6 collectionすべての取得完了と参照索引一致を要求する範囲をNo.6へ固定した。不一致時は開放せず、導出可能な不足だけを別承認の補完候補とし、dry-run単独ではarchiveを開放しない。
- [x] Employee: 参照writer、背景再生成処理、旧Employee削除triggerのUser/Auth連鎖削除を無作用にする処理を反映対象候補へ含めた。exact Functions deploy closureと順序はNo.5で確定する。[No.4 release surface inventory](master-dev-release-surfaces.md#functions)を参照する。
- [x] Employee: 既存保険map/世代値の互換性を通常編集smoke、User/Auth削除と予約・通知・請求生成を対象外、住所の実provider接続をU8-4で許可する合成住所geocodingへ限定した。[受入れ計画](master-dev-acceptance-plan.md#合成dataと操作表)、[Employee roadmap](../roadmaps/employee.md)、[実装記録](employee-master.md)を参照する。

### 結果次第で必要となる対応と最終準備

- [ ] 必要なdata変換・索引補完が確認された場合だけ、対象・件数・変更内容・dry-run・backup・apply・post-check・復旧を提示する。実data変更をこの一覧だけで承認済みとしない。
- [ ] DevのCallable公開権限・認証・設定に不足が判明した場合は、exact serviceと最小修正を提示する。IAM変更やtenant開放を推測で実行しない。
- [x] 必要なlocal実装を具体化して承認範囲と照合し、release候補のreview、影響別domain test、既存Emulator証拠の失効確認、文書検証を完了した。見た目変更には既存の利用者判断境界を適用し、No.9で追加の見た目変更は行っていない。
- [x] 最終release差分を[verification policy](../../governance/verification-policy.json)で分類し、失効したdomain・文書・差分検証を最終状態へ結び付けた。承認されたlocal UI buildは一度だけ実行し、その後の文書だけの変更がbuild証拠を失効させないことを同policyへ照合した。
- [x] Dev反映前の未確認事項・必要承認を明記し、[受入れ計画](master-dev-acceptance-plan.md)と[release surface inventory](master-dev-release-surfaces.md)に基づく具体的なNo.10反映案を利用者へ提示する状態にした。remote actual確認、Dev反映、合成data smoke、IAM・data補正は未承認のままであり、自動実行しない。

### No.10の現在地と停止点

No.8の利用者事前確認、No.9のrelease候補reviewと、No.10の初回bounded Dev反映は実施済みである。必要index、対象Functions、Firestore Rules、Hostingを反映し、対象外のSite自動終了とEmployee archive tenant開放は未公開のまま維持した。Devのclean read-only smokeは成功した。

会社管理者の合成Customer作成は成功したが、そのCustomerを紐付け、非null座標を持つSite作成はFirestore Rulesの1000式評価上限で拒否された。Site documentは作成されなかった。Localで同条件を再現し、fallbackの早期拒否と重複する型・件数検証の整理により、既存のactor・tenant・maintenance・exact schema・Customer projection境界を保ったまま保存成功を確認した。詳細は[補正記録](../verification/master-dev-site-create-correction.md)を正とする。

Site作成補正は`c1be8faf`へcommitし、clean HEADの専用Local UI buildまで成功した。続いて補正版Firestore RulesだけをDevへ反映し、会社管理者でCustomer紐付け・座標ありSiteの作成、編集、検索、終了、終了済み検索、再有効化、参照なしarchiveに成功した。経理accountはSite一覧へ到達できる一方、作成導線は表示されなかった。合成Siteは利用者承認済みのarchive経路で通常一覧から除外し、合成Customerは残している。Hosting・Functions・Indexesは補正時に再反映していない。

### 今回の停止点より後の作業

4マスターのDev受入れ結果は[Dev受入れ計画](master-dev-acceptance-plan.md#no10後のcustomeroutsourceremployee-dev受入れ結果)を正とする。今回の一時合成Customer・Siteはcleanup済みである。見た目・操作感、将来のrestore/purge、自動終了公開、transaction全体の刷新、未承認package変更は既存の別工程に残す。

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
