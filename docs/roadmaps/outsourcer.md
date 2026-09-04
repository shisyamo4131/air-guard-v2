# Outsourcerマスター改修ロードマップ

- 目標: 特定の協力会社を表すOutsourcer masterについて、同一tenant内の権限、保存契約、契約終了、archive、検索・表示、重複配置を段階的に整合させる。
- 確認済み業務境界: Outsourcerは外注警備員個人ではなく協力会社masterである。同じOutsourcerを一つの配置へ複数回登録できる。Outsourcerと人数を一組にして集約する方式は採用しない。
- 現在の進捗: 90%
- 部分加点: 行わない。各phaseの完了条件をすべて満たした時点で当該重みを加点する。
- 環境境界: OUT-01からOUT-07はlocal仕様・実装・検証までを対象とする。Dev反映・remote/data確認はマスタ改修後の別承認checkpointまで行わない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 内容と完了条件 |
|---|---:|---:|---|---|
| OUT-01 更新権限と破壊操作停止 | 15 | 15 | Completed | 会社管理者またはstrict `manager`だけが作成・編集でき、UIとRulesが一致する。client deleteとarchive writeを拒否し、domain 927/927、local Emulator 146/146、専用local UI build、文書検証、独立reviewを完了した。実装commit `82e22179`。 |
| OUT-02 保存data契約 | 15 | 15 | Completed | exact 11 field、型・長さ・status・system metadata、部分更新、名称変更時のtoken再生成、独立draftと同一field競合拒否をUI・専用writer・Rulesへ実装した。domain 934/934、local Emulator 147/147、専用local UI build、文書検証を完了した。実装commit `31d11b15`。 |
| OUT-03 契約終了と候補 | 10 | 10 | Completed | statusをCustomerと同じ説明用フラグとし、一覧検索・Autocomplete・配置・稼働実績の選択を制限しない。終了日・理由・履歴・自動変更を追加せず、domain 934/934と専用local UI build、文書検証を完了した。実装commit `995488a5`。 |
| OUT-04 archive・restore安全性 | 20 | 20 | Completed | Outsourcerをlive masterとして保持し、通常productにarchive／restore／物理deleteを設けない。既存の破壊操作拒否と入口不在を回帰testで固定し、対象test 22/22、domain 935/935、local Emulator 147/147を完了した。 |
| OUT-05 code・検索・一覧表示 | 10 | 10 | Completed | codeを任意・重複可・検索外として維持し、通常一覧を20件server cursor、名称検索を20件memory paginationへ整合した。外注先専用rendererと契約終了表示を追加し、対象test 25/25、domain 953/953、local Emulator 147/147、専用local UI build、文書検証、独立reviewを完了した。 |
| OUT-06 協力会社masterと重複配置の互換性 | 10 | 10 | Completed | 同一Outsourcerを人数1の別明細として複数配置し、安定した`workerId`で行・通知・実績を区別する契約を回帰testで固定した。重複行のVue keyを修正し、対象test 48/48、domain 961/961、専用local UI build、文書検証、独立reviewを完了した。実装commit `794af0ed`。 |
| OUT-07 local統合確認 | 10 | 10 | Completed | 対象test 48/48、domain 961/961、local Emulator 147/147、専用build、write actorのCRUD UI smoke、Rules陰性、保存data不変、cleanupを確認した。拒否actorの実browserは未実施だが、利用者承認により自動UI契約テストとRules陰性をOUT-07固有の代替証拠とした。周辺transaction機能は変更していない。[証拠](../verification/outsourcer-out07-local-integration.md)を参照。 |
| OUT-08 Dev反映・受入れ | 10 | 0 | Deferred / 別承認 | 他のマスタ改修とまとめたbounded Dev releaseで、旧client・既存data・権限別操作・関連操作を確認する。 |

## OUT-01の確定範囲

- readは現行の同一tenant境界を維持する。
- create、update、`contractStatus`変更は、認証UIDとUser document IDが一致する同社の有効な本登録会社管理者、またはnon-super-userかつ既知presetがexactに`manager`であるUserだけに許可する。会社管理者かつsuper-userは会社管理者を根拠に許可する。
- non-admin super-user、controller、accountant、その他preset、直接permission文字列、未知または混在role、仮登録、無効User、他tenantはwriteを拒否する。
- live deleteは全clientで拒否し、`Outsourcers_archive`のclient writeを全て拒否する。archive readは現行どおり維持する。
- UIはread-only actorへ作成・編集・削除を表示せず、write actorにも削除を提供しない。create/update transport直前に同じ純粋policyを再評価する。
- Firestore Rulesの広いfallbackからlive/archiveを除外し、個別Rulesを迂回できないようにする。
- schema、data shape、Functions、migration、検索、pagination、個人外注警備員、archive/restoreの正式policyは対象外とする。

## OUT-01の互換性・rollback・検証

- 既存document、path、ID、配置明細、下流readを変更せず、data migrationは行わない。
- controller・accountant等のreadは維持するが、従来到達できたwriteは意図的に拒否する。manager・会社管理者の作成・編集は維持する。
- rollbackはclientとRulesのreview済み変更を対で戻す。ただし既知の広いwriteを再開するため、検証失敗時はwriteを広げずlocalで停止する。
- 変更classは`ui-css-layout`、`application-logic`、`data-contract-schema-migration`の和集合とする。completion gateは`project-docs`、`domain-full`、`local-emulator-suite`、`local-ui-build`、`diff-check`である。

## OUT-02の確定範囲

- documentはexact `docId/uid/createdAt/updatedAt/code/name/nameKana/displayName/contractStatus/remarks/tokenMap`とする。文字列長はcode 10、name 20、nameKana 40、displayName 6、remarks 200を上限とし、name/nameKana/displayNameを必須にする。
- createは常に`ACTIVE`とし、updateは`ACTIVE/TERMINATED`を許可する。statusの候補・過去訂正への効果はOUT-03へ、codeの書式・一意性はOUT-05へ残す。
- docId/createdAtは更新不能、uidは実行actor、updatedAtはrequest時刻とする。更新は実変更fieldだけを保存し、名称系変更時だけtokenMapを再生成する。
- 入力draftをlive dataと分離し、同じfieldの外部更新は保存前transactionで拒否する。別fieldの更新は最新値を維持してmergeし、変更なしはwriteしない。
- RulesはtokenMapを最大512件・値trueだけに制限する。名称との完全な意味的一致はRulesだけでは証明できないため、専用writerを正規経路として維持する。

## OUT-02の互換性・rollback・検証

- 既存pathと11 fieldの意味を維持し、migrationは行わない。検索、配置、delete/archive、statusの業務制御は変更しない。
- rollbackは専用create/editor/action/writerとRules validationを一組で戻す。検証失敗時はRulesを緩和して旧whole-document writeへ戻さず、localで停止する。
- 変更classは`ui-css-layout`、`application-logic`、`data-contract-schema-migration`の和集合とし、completion gateは`project-docs`、`domain-full`、`local-emulator-suite`、`local-ui-build`、`diff-check`とする。

## OUT-03の確定範囲

- `contractStatus`は現在の取引状況を示す可逆なフラグに限定し、`ACTIVE/TERMINATED`のどちらも一覧、検索、Autocomplete、配置、稼働実績その他の候補から除外しない。
- 状態変更によって既存・新規の配置、通知、稼働実績、請求、帳票を禁止または自動変更しない。
- 契約開始日・終了日、終了理由、専用履歴を追加せず、通常の更新時刻を終了日時として扱わない。
- archiveは状態変更と分離し、参照確認・復元・保持はOUT-04へ残す。code、pagination、一覧上の状態表示はOUT-05へ残す。

## OUT-03の互換性・rollback・検証

- 永続field、Rules、index、保存済み配置・実績を変更せず、migrationは行わない。既存のstatus非限定AutocompleteとID直接取得を維持し、一覧と配置購読からACTIVE条件だけを除去する。
- rollbackは一覧と配置購読のquery変更を戻す。data変更や外部作用はない。
- 変更classは`ui-css-layout`と`application-logic`の和集合とする。completion gateは`project-docs`、`domain-full`、`local-ui-build`、`diff-check`である。Rules・永続data契約を変更しないため`local-emulator-suite`は省略でき、completion reportへ理由を記録する。

## OUT-04の確定範囲

- Outsourcerは通常の製品運用ではlive masterとして保持し、誤登録・重複・取引終了を含めてarchive、restore、物理deleteを提供しない。
- 製品UI、application action、Callableからgeneric `delete()`／`restore()`へ到達させない。live deleteとarchive client CUDを拒否する現行Rulesを維持する。
- 既存archiveの同一tenant read境界は変更しない。live/archive dataの変換・復元・削除、自動purge、保持期限は追加しない。
- status、検索・配置・実績、同一IDの重複配置は変更しない。判断理由は[ADR 0050](../decisions/0050-outsourcer-live-retention-without-archive.md)を正とする。

## OUT-04の互換性・rollback・検証

- 現行runtimeが承認済み契約を満たすため、製品code、Rules、schema、index、Functions、dataを変更せず、回帰testと文書だけを追加する。migrationは行わない。
- rollbackは文書と回帰testを戻す。ただしclient破壊操作拒否はOUT-01から継続する既存安全境界であり、別仕様なしに解除しない。
- 変更classは`data-contract-schema-migration`とする。completion gateは`project-docs`、`domain-full`、`local-emulator-suite`、`diff-check`である。UI sourceを変更しないため`local-ui-build`は省略し、理由をcompletion reportへ記録する。

## OUT-05の確定範囲

- codeは任意の手動入力、最大10文字、重複可とする。自動採番・一意制約・検索対象にはせず、document IDをidentityとして維持する。
- 通常一覧はstatusで絞らず、`nameKana asc`、同値時document ID ascで21件を取得し、20件ずつserver cursorで表示する。現在pageだけをlive購読し、前pageのcursorは画面内memoryに保持する。
- 検索は正規化後2〜40文字の`name/nameKana/displayName`由来tokenだけを対象とし、codeを含めない。動的token equalityへ追加indexを要求しないため、検索queryにはorder、limit、cursorを加えず一致結果をlive購読し、clientで`nameKana`、document ID順にsortして20件ずつ表示する。
- 入力なしは通常一覧、範囲外入力はqueryを行わない案内表示とする。作成・更新後は先頭pageへ戻し、失敗時は表示中pageを維持して再試行できる。重複loadと古いlistener callbackは反映しない。
- Autocompleteは従業員用ではなく外注先専用ListItemを使い、既存の最大50件取得を維持する。一覧・Card・Autocompleteでは略称、正式名称、codeを識別でき、`TERMINATED`へ「契約終了」を表示するが選択を制限しない。

## OUT-05の互換性・rollback・検証

- 既存path、document shape、tokenMap生成、status非制限、配置・実績のID参照を維持し、Rules、index、schema、package、migration、dataを変更しない。
- rollbackは一覧pagination composableとPage／Manager／Iterator、Card／ListItem／Autocompleteの表示変更を一組で戻す。検証失敗時は追加indexやcode制約へ拡張せずlocalで停止する。
- 変更classは`ui-css-layout`と`application-logic`の和集合とする。completion gateは`project-docs`、`domain-full`、`local-ui-build`、`diff-check`である。`local-emulator-suite`はRules・schema変更がないためpolicy上は省略可能だが、承認済みlocal回帰として実行した。

## OUT-06の確定範囲

- Outsourcerは協力会社masterのままとし、外注警備員個人masterやOutsourcer＋人数の集約方式を追加しない。通常UIで同じOutsourcerを配置するたび、`amount=1`の独立した配置明細を一つ作る。
- 配置明細のidentityは、従業員ではraw ID、Outsourcerでは`outsourcerId:index`形式の`workerId`とする。masterの名称解決はraw `id`を使い、表示行、配置操作、通知照合は`workerId`を使う。
- Outsourcerの`index`は同じ配置内の最大値に1を加えて採番する。途中の明細を削除しても残存明細を再採番せず、再追加は新しい最大値を使う。並べ替えでも`workerId`と明細数を維持する。
- 配置通知はschedule IDと`workerId`の組で明細を区別し、ScheduleからOperationResultへの変換は配置明細を1対1で維持する。`contractStatus`は配置identityへ含めず、`ACTIVE/TERMINATED`のどちらも同じ契約とする。

## OUT-06の互換性・rollback・検証

- 永続path、document shape、Rules、index、schema、package、既存dataを変更せず、migrationを行わない。製品変更はWorkersTableのVue keyをraw `id`から既存`workerId`へ合わせる1行である。
- rollbackはWorkersTableのkey変更とOUT-06回帰test・文書を戻す。人数集約や個人master、低レベルAPIの再設計へ拡張しない。
- 変更classは`ui-css-layout`と`application-logic`の和集合とする。completion gateは`project-docs`、`domain-full`、`local-ui-build`、`diff-check`である。Rules・schema・永続data契約を変更しないため`local-emulator-suite`はpolicyに基づき省略する。
- 通常UIは`amount`を渡さずschema既定値1を使うが、導入済みschema packageの低レベル`addWorker`はcallerが渡した別の`amount`も受け入れる。通常UI契約の回帰は固定したが、全callerでの`amount=1`強制は未実装であり、package・Rules・data validationを含む別承認範囲とする。

## OUT-07の確定範囲

- 主対象はOUT-01からOUT-06で確定したOutsourcer masterの一覧、検索、作成、更新、status変更、非archive・非delete、権限境界、保存契約である。既存の配置・通知・稼働実績・請求・帳票は、Outsourcer masterとの互換性を確認するために必要な範囲だけ回帰する。
- 検証はCodex専用demo project、loopback、合成data、専用Emulator・local UIだけで行う。Dev・Prod、remote Firestore、利用者用local saved-data、実data、外部通知・外部課金へ接続しない。
- 配置・通知・稼働実績・請求・帳票などtransaction系機能のFirestore書込み経路、client/server分担、楽観的更新、rollback/refetch、同時実行、Rules、schema、package、APIを変更しない。問題を検出した場合は既知課題へ記録し、マスタ管理機能の一連の改修後に別checkpointで見直す。
- 製品変更が必要になった場合はOutsourcer master CRUDを直接成立させる範囲に限定する。主機能以外へ波及する変更はFirestore更新に関係しない表示・読取り・描画identityの互換修正に限り、別の業務仕様を推測して実装しない。範囲または仕様が未確定なら変更前に停止して利用者へ確認する。

## OUT-07の互換性・rollback・検証

- 永続path、document shape、Rules、index、schema、package、Functions、既存dataを変更せず、migrationを行わない。配置管理の作業員追加・変更・削除・並べ替えは現行のFirestore client transaction経路を維持し、Server APIへ移行しない。
- rollbackはOUT-07で追加する検証・記録と、別途必要性を確認して承認範囲内で行ったOutsourcer master CRUD修正だけを戻す。周辺transaction機能の既存riskを解消するためにrollback範囲を広げない。
- 変更classは、実際に変更したfileに対応するclassの和集合とする。現時点のverification計画は`project-docs`、Outsourcer対象test、`domain-full`、`local-emulator-suite`、`local-ui-build`、Codex専用local UI smoke、`diff-check`、独立reviewである。最終worktreeの変更classに応じて機械可読policyを再評価し、実行結果と省略理由を完了報告へ記録する。
- 2026-09-05の利用者承認により、拒否actorの実browser確認は、OUT-07に限ってdomain source contractのrole別UI契約と専用EmulatorのRules陰性で代替する。write actorの実UIは省略せず実施済みであり、この判断を他checkpointの権限別UI省略へ一般化しない。

## 未確認・別承認

- Dev・Prodの現在Rules、remote Firestore、既存Outsourcer/archive件数、実利用actor、旧client併存は未確認である。
- OUT-08以降の具体仕様、Dev/Prod、remote/data、migration、deploy、package変更は未承認である。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-09-04 | 15% | +15 | actor/tenant/UIDをfail-closedで一致させ、UIとRulesで作成・編集を会社管理者またはstrict `manager`へ限定した。live delete、archive write、fallback迂回を拒否し、domain 927/927、local Emulator 146/146、専用local UI build、独立security/code reviewを完了した。 |
| 2026-09-04 | 30% | +15 | exact document、型・長さ・metadata、部分更新、token再生成条件、独立draft・同一field競合拒否を実装し、domain 934/934、local Emulator 147/147、専用local UI build、文書検証を完了した。 |
| 2026-09-04 | 40% | +10 | statusを説明用フラグに限定し、一覧検索・Autocomplete・配置・稼働実績の候補制限を除去した。domain 934/934、専用local UI build、文書検証を完了した。 |
| 2026-09-04 | 60% | +20 | 通常productにはarchive・restore・物理deleteを設けず、live masterとして保持すると確定した。製品runtime・Rules・schema・dataを変更せず、対象test 22/22、domain 935/935、local Emulator 147/147を完了した。 |
| 2026-09-04 | 70% | +10 | codeを任意・重複可・検索外として確定し、通常一覧20件server cursor、名称検索20件memory pagination、外注先専用renderer、契約終了表示を実装した。対象test 25/25、domain 953/953、local Emulator 147/147、専用local UI build、文書検証、独立reviewを完了した。 |
| 2026-09-04 | 80% | +10 | 同一Outsourcerの複数配置を人数1の別明細とし、安定した`workerId`で行・通知・実績を区別する契約を固定した。Vue keyを修正し、対象test 48/48、domain 961/961、専用local UI build、文書検証、独立reviewを完了した。 |
| 2026-09-05 | 90% | +10 | Outsourcer master CRUDのlocal統合確認として対象48/48、domain 961/961、local Emulator 147/147、専用build、write actorのCRUD UI smoke、Rules陰性、保存data不変とcleanupを確認した。拒否actor実browserの自動代替は利用者が明示承認した。 |
