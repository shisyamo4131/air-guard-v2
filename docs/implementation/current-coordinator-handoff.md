# Current coordinator handoff snapshot

- 状態: Current / PM-12 active ownership
- 更新日: 2026-08-30
- active coordinator: PM（AirGuardV2）-12 / task `01a05183-9ab8-7f23-8e13-2ec47296dc04` / host `local`
- active callback and assignment destination: PM（AirGuardV2）-12 task `01a05183-9ab8-7f23-8e13-2ec47296dc04`
- former coordinator: PM（AirGuardV2）-11 / task `01a05143-0fd6-76c2-ad4c-099742f6e527` / host `local` / retired after ownership activation and safe for user manual deletion。Codexはarchive/deleteしない。
- program coordinator: PM（SPG）-04 / task `01a04795-86ec-7d32-a6f7-9b1dd4f3c6c8` / host `local`
- coordination procedure: [project coordination](../runbooks/project-coordination.md)、[efficient handoff](../runbooks/coordinator-handoff-efficient-activation.md)、[ADR 0030](../decisions/0030-efficient-coordinator-handoff-activation.md)

## Repository baseline

- direct repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- branch: `codex/dev-user-reservation-migration`
- activation baseline: `c729803ecc431bd94a5b627719c9d846fec5c24b`
- corrective rollback start baseline: `1629e9925159a8342e646faf3c875e31995dac75`
- corrective rollback implementation HEAD: `98595711cba758170442e9777ac5e992fee6d4ee`
- operation editor governance commit: `6c4b84ba724e64fc81d0d24ec224838629ecbdc1`
- Company profile implementation commit: `5ff6144f608c8c9a0d6efea6a210fed61632d243`
- Company profile edit visibility commit: `4f7c52f580e18db11cd5a93ec83549be8a9cb8c3`
- Company profile local UI correction commit: `2b7cdf00e73d343264a6ca6a05e747f271d1a599`
- Company billing implementation commit: 本snapshotと同じlocal commit
- Company editor saving-state correction commit: `ebbecf26ae4f8eae9db0d79c4b5311977a1cfb20`
- Company editor saving-state acceptance commit: 本snapshotと同じlocal commit
- Company operations implementation commit: `df1d656d56cc39b51e43bb6367e3c709aa760095`
- Company operations acceptance commit: 本snapshotと同じlocal commit
- Company arrangement implementation commit: 本snapshotと同じlocal commit
- expected upstream: none
- expected worktree: clean
- expected worktree registry: primary repository 1件のみ。linked/task-specific/alternate worktreeは禁止。
- common governance: `1.4.0` / SHA-256 `d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`
- generated `AGENTS.md`: 13,659 bytes。project上限内であることをactivation validatorで確認する。
- specification: `0.8.0`
- unintegrated work: 0。Company基本情報・振込先・通常設定・表示順のapplication・Functions・Rules・test・文書はlocal commitへ統合済みである。基本情報、通常設定、保存中制御補正の利用者acceptanceは完了し、振込先と表示順の利用者最終UI acceptanceを残す。

## Confirmed product state

- AirGuardV2正式運用準備roadmapは10%。Company設定の旧巨大roadmap 10%はADR 0031でSupersededとなり、active進捗へ持ち越さない。
- CCBは2026-08-30にrestartした。目的はCompany全体を置換する保存を廃止し、operationが所有するexact fieldだけを更新することである。
- 一つの業務対象を一つのdocumentに保つことを既定とする。読取actor、保存・削除・復旧条件、増加し続ける量、具体的size、独立query、field updateで解消できない実測競合がある場合だけ分割する。writer権限、画面、責務名だけでは分割しない。
- 通常編集はreal-time listenerとlast-write-winsを既定とする。expected value、revision、transaction、idempotency、lock、ledgerは、権限・停止、削除、金銭、外部作用、複数resource、復旧困難なdata loss等の具体的被害があるoperationだけに限定する。
- `AirItemManager`・`AirArrayManager`をFirestore CRUDの既定componentから外し、Class schemaを共通validationの正本として維持したoperation固有editorへ段階移行する。editorはlive Companyと独立したdraftを使い、保存は実際に変更されたoperation所有fieldと更新metadataだけに限定する。
- Stripe、subscription、entitlement、employeeLimitは現段階のCompany構造とCCBから除外した。将来サブスクリプション機能の実装時に新規設計する。
- Devで確認済みのCompany rootは4件。正式release前で旧client継続利用を要しないため、backup・dry-run・短時間maintenance・全件変換・post-check・Dev受入れをbounded cutoverとして行える。実data操作は別の明示承認を必要とする。
- 旧CCBのruntime compatible reader、8-target migration planner/Emulator、SettingAudits restore planner、candidate Rulesと専用testは主repositoryからcorrective rollback済みである。Company Rulesは旧CCB直前blobへ戻しつつ、UWBとCompany client create/delete拒否を保持した。
- Schemas exact `2.4.2-dev.167`の公開artifactとAirGuardV2 consumer pin、Admin SDKのfail-closed guardは独立成果として保持した。Schemasをunpublishせず、関連repository、Dev、remote/dataは変更していない。
- Company基本情報10 fieldは独立draftと専用Callableへ移行済みである。利用者が変えたfieldだけを最新Companyへ重ねてclient/server双方で検証し、server timestampと更新者を記録する。編集中のlive変更は自動上書きせず、会社管理者以外の編集controlとserver保存を拒否する。Rulesは同profile fieldのclient直接変更を閉じ、未移行operationの対象外field更新を暫定維持する。
- 利用者local確認で権限と更新metadataは合格した。基本情報card titleを復元し、dialogをVuetifyの`scrollable`前提DOMへ修正して本文だけをscrollさせた。競合時は保存を止め、「最新値を読み直す」だけを表示する。利用者は修正版UIを再確認し、Company基本情報のlocal受入れを完了した。
- Company振込先は専用editorと`updateCompanyBilling` Callableへ移行した。同社の有効な本登録User readを維持し、非super-user会社管理者だけが編集・保存できる。5 field all-null/all-complete、changed-only update、client直接write拒否、再読込専用競合、明示clear、完全な口座名義込み帳票をlocal実装・自動検証した。Codex in-app UIで管理者の入力・保存反映まで確認し、利用者の実際の利用環境での最終UI acceptanceを待っている。
- 利用者確認で、基本情報・振込先の保存中も入力欄が操作でき、自分の保存結果を外部更新として一瞬表示する問題が見つかった。両editorは入力検査開始からserver応答まで全入力・選択・操作buttonを無効化し、自分の保存reflectionは警告にせず、本当に異なるlive値だけを競合として扱うよう補正した。
- 利用者は実際の環境で、保存中の全入力・操作button無効化、自己保存時の外部更新警告非表示、本当の外部更新時の警告維持を確認し、保存中制御補正を受け入れた。
- Company通常設定4 fieldは専用editorと`updateCompanyOperations` Callableへ移行した。Company rootを分割・移行せず、legacy勤怠値を共有canonical parserへ写像し、欠損時は検証だけ既定化して補完writeしない。会社管理者だけのchanged-only transaction、client直接write拒否、保存中全control無効、自己保存reflection識別、真正競合の再読込をlocal実装・検証した。
- 利用者は実際の環境で、通常設定4項目の表示・1項目保存、保存中の全入力・操作無効、自己保存時の外部更新警告非表示、真正な外部更新時の再読込、非管理者・super-userの編集拒否を確認し、通常設定operationを受け入れた。
- Company既定取極めのUI/writerは撤去し、Site取極めと保存済みCompany値は維持した。`siteOrder`・`scheduleOrder`は会社管理者またはfield別既知preset actorだけが専用Callableで更新する。Company全体保存を外し、独立draft、再読込専用競合、自保存reflection除外、保存中全関連操作停止、失敗時維持、missing/deleted Site除外、protected 3 fieldのclient直接write拒否を実装した。終了済み等の既存Siteは表示順へ残す。完全同時保存は後commit優先の残存riskである。
- 利用者は、task交代中を除き独立して分割できる調査・review・test・明示承認済み補助実装等に適切なsubagentを使用し、Checkpoint固有の禁止を当該Checkpointだけへ限定するproject-wide方針を承認した。交代手順内はcoordinatorだけで実施する。
- 利用者はADR 0034として、承認済みcheckpointまたはfeature boundary内ではCodex developerをapplication実装の標準担当とし、Codexが必要なFunctions・Rules、自動test、必要なin-app UI smokeまで担当し、利用者が実際の利用環境で最終UI acceptanceを行うproject-wide方針を承認した。file-by-file確認はcheckpointが明示した場合だけとし、外部作用の別承認境界は維持する。

## Current checkpoint and next work

- no-change checkpoint: `NO-CHANGE-GOV18-AIRGUARDV2-PM12-001` COMPLETE。task `01a05183-9ab8-7f23-8e13-2ec47296dc04` / host `local`、direct repository、baseline `c729803ecc431bd94a5b627719c9d846fec5c24b`、upstream none、clean、primary-only worktree、common governance `1.4.0`、specification `0.8.0`、managed `workspace-write` / `auto_review` / network restricted、`AGENTS.md`、project rules、documentation map、coordination runbook、本snapshot、ADR 0034、効率化runbookを確認し、PM-11がreceiptを受理した。
- implementation and user acceptance complete checkpoint: `CCB-COMPANY-ARRANGEMENT-CODEX-IMPLEMENT-001`。Company既定取極めUI/writer撤去と表示順専用更新を実装し、専用Emulator 106件、一般review GO、security review 4/5を確認した。利用者確認は項目1〜13と一般利用者の対象画面非表示まで合格した。二画面では、未保存変更がない画面は他画面の保存結果を自動反映し、未保存変更がある画面は自身の順を維持して外部更新警告・保存無効となることを同じ会社管理者Chrome 2画面で再現し、利用者が区別を確認して受け入れた。
- corrective implementation and user acceptance complete checkpoint: `CCB-COMPANY-ARRANGEMENT-TERMINATED-SITE-FIX-001`。利用者が終了済み現場にも突発的な稼働予定が発生し得ると確認したため、既存Siteは状態にかかわらず表示順へ残し、missing/deletedだけを除外するよう画面処理と仕様を補正した。専用15件、全domain 722件、一般review GOを確認し、利用者が実際の利用環境で終了済み現場の表示を最終確認した。CPU-04は20点を加算して完了し、Company部分更新roadmapは50%となった。
- recorded future investigation: DEVの上下番確定でOperationResult登録成功後にerror Snackbarが表示された未解決事象を既存FUT-0027へ統合した。ArrangementNotification LEAVED更新は仮説に留め、OperationResult・SiteOperationSchedule・全通知の実行順、await、部分成功、再実行、Snackbar source、FcmTokens 403・SecurityReports 404・Chrome message channel errorとの因果分離を次回改修時に調査する。共有logのFCM token等の機密値は記録していない。
- ownership activation checkpoint: `GOV18-AIRGUARDV2-PM12-ACTIVATION-001`。本snapshot 1件だけのfile-scoped local commitでPM-12へcallbackとassignmentをretargetし、効率化runbookのvalidator・blob・commit gateを満たす。exact new HEADはactivation receiptへ記録する。
- completed product checkpoint: `CCB-RESTART-ROLLBACK-INVENTORY-001`と承認済みcorrective rollback。commit rangeの一括revertを使わず、compatible reader、audit planner、migration tooling、Rulesの4単位で実装・testを完了した。
- completed product checkpoint: `CCB-COMPANY-PARTIAL-UPDATE-001`。Company基本情報の専用editor・Callable、Class schema/operation validation、会社管理者境界、変更fieldだけの保存、server timestamp、編集中listener変更の通知、Rulesのclient直接変更拒否をlocal実装・検証した。
- completed acceptance checkpoint: Company基本情報のtitle、dialog本文限定scroll、外部更新後の再読込専用UIを利用者local環境で再確認し、受入れを完了した。
- completed governance checkpoint: `GOV17-AIRGUARDV2-SUBAGENT-ROUTING-001`。project-wide delegation方針をproject rules、仕様、ADR 0032、runbook、開始prompt、roadmap、snapshot、changelogへ反映し、instruction-chain変更として検証・commitした。task交代中を除き独立して分割できる必要な調査・review・test・利用者承認済み補助実装等へ適切なsubagentを使用し、Checkpoint固有の禁止は当該Checkpoint内だけに限定する。
- implementation complete / user acceptance pending checkpoint: `CCB-COMPANY-BILLING-CODEX-IMPLEMENT-001`。承認済みowned filesでapplication、Functions、Rules、test、PDFを実装し、振込先・PDF対象17件、全domain 676件、専用Emulator 102件、Codex in-app UIの管理者表示・5項目・明示clear・架空口座保存反映を確認した。非管理者UIと実請求PDFを含む利用者の実際の利用環境での最終UI acceptanceまではfeature・roadmapを最終完了としない。
- completed acceptance checkpoint: `CCB-COMPANY-EDITOR-SAVING-STATE-FIX-001`。ProfileEditor/BillingEditorの保存中制御と自己保存reflection識別を修正し、会社情報12件、振込先19件、全domain 688件を成功させた。Codex専用UI smokeは起動templateから製品画面へ遷移せずNuxt `ECONNRESET`で対象操作前に停止したが、利用者が実際の環境で保存中の入力無効化、自己保存時の警告非表示、本当の外部更新時の警告維持を確認して受け入れた。
- completed acceptance checkpoint: `CCB-COMPANY-OPERATIONS-CODEX-IMPLEMENT-001`。通常設定4 fieldの専用editor・Callable、legacy/canonical validation、欠損時の非移行互換、会社管理者境界、changed-only transaction、Rules、保存中・競合UIを実装した。対象19件、全domain 707件、専用Emulator 104件とCodex in-app UI smokeが成功し、利用者が実際の環境で最終UI acceptanceを完了した。CPU-03は振込先の残る利用者最終UI acceptanceまで完了としない。
- completed governance checkpoint: `GOV18-AIRGUARDV2-CODEX-IMPLEMENTER-001`。ADR 0034、project rules、仕様0.8.0、runbook、agent定義、roadmap、snapshot、changelogを同期し、managed `AGENTS.md`を再生成したbaseline commit `c729803ecc431bd94a5b627719c9d846fec5c24b`から、利用者承認済みturnoverとしてPM（AirGuardV2）-12のno-change、permissions、最初のfile限定activation commit、callback/assignment retargetを実施した。activation commitではproduct実装を開始していない。
- following active product roadmap: [Company legacy Stripe情報削除](../roadmaps/company-stripe-removal.md) 0%。whole-document replacement除去のreview済みbaseline後にSTRIPE-01へ接続する。

## Active source set

PM-12はno-change開始時に次だけを読み、不足・矛盾がなかったため履歴へ拡張しなかった。

1. `AGENTS.md`
2. `governance/project-rules.md`
3. `docs/README.md`
4. `docs/runbooks/project-coordination.md`
5. 本snapshot
6. `docs/decisions/0034-codex-bounded-implementation-and-user-ui-acceptance.md`
7. `docs/runbooks/coordinator-handoff-efficient-activation.md`

次のproduct checkpoint開始時は`docs/decisions/0032-required-specialist-subagent-routing.md`、`docs/specification.md`のCompany設定節、`docs/decisions/0031-proportional-data-boundary-and-change-safeguards.md`、`docs/decisions/0033-company-bank-transfer-update-boundary.md`、`docs/roadmaps/company-partial-updates.md`、`docs/roadmaps/company-stripe-removal.md`、`docs/implementation/company-settings.md`、`docs/implementation/company-configuration-compatibility.md`を追加する。

旧`task-handoff-2026-08-14-user-led-governance.md`と旧Company roadmapはHistoricalであり、current snapshotに不足・矛盾がある場合だけ参照する。

## Permissions and approval boundaries

- managed `workspace-write`。taskから観測可能なworkspace rootのうち、AirGuardV2と明示された関連repositoryだけが書込候補であり、各checkpointのowned filesをさらに優先する。
- review policy: `auto_review`。networkはrestricted。sandbox外操作は明示された承認境界とreviewに従う。
- `NO-CHANGE-GOV18-AIRGUARDV2-PM12-001`と`GOV18-AIRGUARDV2-PM12-ACTIVATION-001`では、指定されたread-only確認、snapshot 1件のfile-scoped commit、validator、local Git確認、旧coordinatorへのreceipt以外を行わない。
- PM-11 ownership activationとcorrective rollbackは完了した。利用者はCompany CRUDをoperation固有editorへ段階移行する方針と、`CCB-COMPANY-PARTIAL-UPDATE-001`のlocal application/Functions/Rules/test/document変更を承認した。
- 利用者はADR 0034のgovernance反映とPM-12 turnoverを承認した。承認済みcheckpointまたはfeature boundary内ではCodex developerがapplicationと必要なFunctions・Rulesを実装し、Codexが自動testと必要なin-app UI smokeを担当し、利用者が実際の利用環境で最終UI acceptanceを行う。file-by-file確認はcheckpointが明示した場合だけとし、外部作用は別承認とする。
- ADR 0033のCompany振込先product contractを`CCB-COMPANY-BILLING-CODEX-IMPLEMENT-001`のlocal実装へ反映した。利用者最終UI acceptanceを待ち、Dev、remote/data、deployへは拡張しない。
- 利用者はproject-wide subagent routing変更とPM-11へのcoordinator交代を承認した。task交代中以外は独立した必要scopeに適切なsubagentを使用し、Checkpoint固有の禁止はそのCheckpointだけに限定する。
- Schemas/Admin SDK、Dev、remote/data、network、push、main merge、Prodは別承認である。Dev migration/deployは対象commit、件数、backup、rollback、停止条件、post-check、受入れを固定した利用者承認を必要とする。
- former taskをCodexがarchive/deleteしない。ownership activation成功後、利用者がPM-11を手動削除できる。

## Current evidence contract

Company振込先checkpointでは振込先・PDF対象17件、全domain 676件、隔離Codex Emulator 102件を成功させた。Emulatorはdemo project・loopback・合成dataだけを使用し、利用者saved-data不変を確認した。Codex in-app UIで会社管理者の編集入口、5項目、明示clear、架空口座の保存反映を確認し、終了後に専用port閉鎖とruntime空を確認した。非管理者UI、実際の請求PDF、利用者環境の最終表示は利用者acceptance待ちである。文書同期ではproject documentation validator、managed governance validator、renderer `-Check`、`git diff --check`を各独立commandで成功させ、branch/full HEAD、upstream none、clean、primary-only worktreeを確認する。capacity script、network、remote/data操作は実行しない。

保存中制御の補正では会社情報12件、振込先19件、全domain 688件を成功させた。Codex専用UIは製品画面到達前のNuxt `ECONNRESET`で対象操作を確認できなかったためUI成功とは扱わなかったが、その後、利用者が実際の環境で保存中の操作不可、自己保存時の警告非表示、本当の外部更新時の警告維持を確認して受け入れた。Functions・Rules・package・Schemas/Admin SDK・Dev・remote/data・deployは変更していない。

Company通常設定checkpointでは対象19件、全domain 707件、隔離Codex Emulator 104件を成功させた。Codex in-app UIで会社管理者の4項目表示、15分→20分保存中の全control無効、完了反映、自己保存警告なし、15分への復元、console error 0件を確認した。Emulatorはdemo project・loopback・合成dataだけを使用し、終了後は専用port 0、runtime 0である。利用者は実際の環境で4項目表示・1項目保存、保存中制御、自己保存警告なし、真正競合の再読込、非管理者・super-user拒否を確認し、最終UI acceptanceを完了した。Company document分割、data migration、Dev、remote/data、deployは行っていない。

Company表示順checkpointでは初回に専用14件、全domain 721件、隔離Codex Emulator 106件を成功させ、security reviewは4/5 GOで権限・tenant・入力・直接write境界にblockerなしと確認した。利用者確認は項目1〜13が合格し、一般利用者は稼働予定・配置管理へアクセスできないことも確認した。二画面では、未保存変更がない画面は他画面の保存結果を自動反映し、その後の編集を最新順から開始する。未保存変更がある画面は自身の順を維持し、外部更新警告を表示して保存を無効化する。利用者が開いていた同じ会社管理者Chrome 2画面で両経路を確認し、利用者が受け入れた。確認で変更した表示順は元へ戻した。利用者指摘により、終了済みSite除外は業務と不一致と判明したため、既存Siteを状態にかかわらず残しmissing/deletedだけを除外する補正を行い、専用15件、全domain 722件、一般review GOを確認した。Codex in-app UIはHTTP 200とEmulator/Functions ready後も起動templateから製品画面へ遷移せず、対象操作前に停止した。終了後は専用port 0、runtime 0、saved-data 7 files・3492 bytesを確認したが、開始前fingerprintを採取していないためUI実行前後のbyte一致証拠には使わない。利用者は実際の利用環境で終了済み現場の表示も確認し、CPU-04の最終UI acceptanceを完了した。Company分割、data migration、Dev、remote/data、deployは行っていない。
