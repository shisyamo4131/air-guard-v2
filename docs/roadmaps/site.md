# Siteマスター改修ロードマップ

- 状態: In progress（SITE-06までlocal完了）
- 目標: Site masterについて、同一tenantの閲覧・書込み権限、保存契約、Customer所属、終了・再有効化、archive、取極め、検索・表示を段階的に整合させる。
- 現在の進捗: 80%
- 部分加点: 行わない。各phaseの完了条件をすべて満たした時点で当該重みを加点する。
- 現在の承認境界: SITE-04までのUI・Functions・予定競合guard・Firestore Rules・自動test・文書をCodex専用localで実装・検証済み。利用者はSITE-08までのlocal実装・検証を承認済みであり、Dev・Prod・remote・実dataの変更・実行はSITE-09の別承認とする。
- 環境境界: 実装が承認された場合も、SITE-01からSITE-08はCodex専用local仕様・実装・検証を基本とする。SITE-09のDev反映・remote/data確認は、他のマスタ改修とまとめる別承認checkpointで行う。

## 現状確認

### 確認済み事実

- `/sites`、`/sites/[id]`、`/sites/terminated`は`sites:read`で到達する。SITE-02では作成、基本情報・Customer・取極め更新、手動終了のUIと送信直前を、会社管理者またはstrict role preset由来の`sites:write`へ限定した。
- Site masterの作成、基本情報、Customerはoperation別client writerを使うFirestore transactionである。取極めはSITE-06の専用Callableを使い、現在のAuth・User・maintenance・ACTIVE Site・同一field競合をserver transactionで再確認する。各editorはlive modelと独立draftを分け、変更なしはwrite 0、失敗時は入力を保持する。終了・再有効化はSITE-04、archiveはSITE-05の専用Callableへ分離した。
- Firestore Rulesは同一tenant readを維持し、Site create/updateを会社管理者またはstrict role preset由来の`sites:write`へ限定する。直接permission、未知role、non-admin super-user、temporary/disabled/他tenantは拒否する。exact 34-field create、operation別変更field、型・長さ・metadata・派生field・Customer projectionを強制し、Siteと`Sites_archive`のclient delete、`Sites_archive`のclient create/updateを拒否する。status遷移はSITE-04の専用処理までclient更新を許可しない。
- Customer未定の仮Siteを作成できる。Customer設定後のunsetは拒否し、同じ会社に存在する別Customerへの変更は許可する。SiteのCustomer変更だけでは既存OperationResult・BillingのcustomerIdを変更しない。
- ACTIVE一覧は全件live購読後にclient filterする。TERMINATED一覧は検索文字列がある場合だけ取得し、空検索は0件である。Site Autocompleteはstatusを限定しない。
- 旧手動終了は予定確認とstatus更新が一つのatomic boundaryでなく、安全な専用処理へ置換するまでUI入口を停止している。一方、日次自動終了は工期終了から3か月を超えたACTIVE Siteを、将来予定や同時更新のpreconditionなしでTERMINATEDへ変更する旧実装のため、SITE-04で置換する。
- generic archive/deleteのSite UI入口は除去し、managerからのdeleteも拒否する。SITE-05では誤登録・重複だけを対象とする専用archive、exact 5 collectionの直接参照確認、live Site writer barrier、冪等性を実装した。`Sites_archive`へのclient writeと同ID Site再作成をRulesで拒否する。共通adapter自体のgeneric restoreは残るが、Site UIからは到達しない。
- Customer更新triggerは同じcustomerIdを持つSiteへexact 6-field Customer projectionだけを複数batchで更新し、欠損・型不正・path ID不一致はquery前にfail closedとする。複数batch全体のatomicity、event順序、再収束は保証しない。
- Site detailはSite masterと同じ画面からSiteOperationSchedule、SiteEmployeeHistoryを扱う。SITE-04では終了競合を防ぐため、予定の作成・site/date変更・実績化参照だけをSite revisionと整合するtransaction/Rulesへ変更した。予定のworker・通知等、OperationResult/Billingのoperation別field・lock、その他のtransaction契約は別課題である。
- SITE-04では終了・再有効化Callable、通常編集制限、確認付き単発予定、JST工期終了90日後の自動終了、maintenance、予定競合guard、派生状態表示をdomain testとCodex専用Emulatorで固定した。SITE-05ではarchive競合、SITE-06では取極め権限・数値・競合・0円確認を固定した。検索・作成wizard・郵便番号・keyboardをSITE-07へ残す。

### 現行のまま維持する部分

- 会社prefix配下の`Sites/{docId}`、Firestore生成document ID、既存のSite fieldとACTIVE/TERMINATED値を、利用者判断なしに変更しない。
- 同社に存在するCustomerへの変更許可、設定済みcustomerIdのunset拒否、既存OperationResult・BillingのCustomer snapshot非移管を維持する。
- Customer未定の仮Siteを直ちに廃止しない。正式な作成・解消条件は既存dataとの互換性を確認してSITE-03で固定する。
- Companyの表示順では、documentが存在するSiteをstatusにかかわらず残し、不存在参照だけを次回の明示保存で除去するADR 0036の契約を維持する。
- Site内`agreementsV2`と、既存OperationResultへ適用済みのCustomer・AgreementをSite master変更だけで自動更新しない契約を維持する。

### 未確認・未決事項

- CONF-0049は回答済み。通常終了は`TERMINATED`としてlive Siteを保持し、誤登録・重複だけを全参照確認と並行writer barrierを備えた専用Callableでarchiveできる。generic delete／restoreと物理deleteは使用せず、通常restoreは提供しない。[ADR 0051](../decisions/0051-site-mistaken-registration-archive-boundary.md)を正とする。
- CONF-0050は回答済み。予定はlive Site、OperationResultは作成時snapshot、確定請求書はBilling revision snapshotを使い、既存実績・確定請求をSite master変更で更新しない。[ADR 0052](../decisions/0052-site-downstream-snapshot-timing.md)を正とする。
- CONF-0051からCONF-0053は回答済み。取極めの作成・編集・削除はstrict `sites:write`へ限定し、単価・時間・締日の範囲を固定する。適用済みmasterも編集・削除できるが既存OperationResult snapshotは変更せず、専用履歴・revision・承認workflowは設けない。[ADR 0053](../decisions/0053-site-agreement-write-validation-and-history.md)を正とする。
- CONF-0135は回答済み。ACTIVE/TERMINATEDの2値を維持し、工期終了後90日と予定guardによる競合安全な自動終了、派生Chip、現在遷移metadataを採用する。TERMINATEDも終了済み表示・確認付きで新規業務へ選択でき、単発残工事は終了状態のまま、継続再開はstrict `sites:write`・reason・新工期で扱う。[ADR 0054](../decisions/0054-site-auto-termination-and-terminated-selection.md)を正とする。
- 既存Site・archiveの件数とshape、仮Site・stale埋込みCustomerの状態、実利用actor、旧client併存、必要index、Dev/remote適用状態は未確認である。
- 導入済みschema packageの変更が必要かは未確定である。必要になった場合は関連repository、version、release、consumer導入を別承認とする。

### transaction系の既知課題として分離する事項

- SiteOperationSchedules Rulesは同一tenantの有効User、maintenance off、live Site、revision、実績参照遷移を確認するが、予定自体のoperation別permissionと全field validationはtransaction系の別課題である。
- Site名をlive取得するBilling PDFは、master変更後の再生成表示が変わり得る。Customer・Agreement・Site表示情報のsnapshot時点はADR 0052で確定したが、OperationResult・Billing・帳票へのsnapshot実装はtransaction側の別checkpointである。
- Site archiveの参照候補にはBilling、SiteEmployeeHistory等があるが、現行hasMany catalogには含まれない。ADR 0051により、誤登録archiveに必要な全参照inventoryとlive Site存在barrierだけはSITE-05の承認対象に含める。Company表示順はADR 0036の不存在参照除去契約を維持する。archive barrier以外のtransaction writer変更は、SITE-04の終了競合guardを除いて別checkpointへ分離する。
- 配置・通知・稼働実績・勤怠・請求・帳票のFirestore writer、rollback/refetch、同時実行、Rules、schema、APIは、SITE-04の予定作成・site/date変更・実績参照遷移とSITE-05のlive Site存在barrierに必要な範囲を除いて本ロードマップで変更しない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 内容と完了条件 |
|---|---:|---:|---|---|
| SITE-01 基準線・未決事項 | 10 | 10 | Completed | CONF-0049〜0053・0135について、現行規則、変更案、影響、互換性、migration、rollback、検証を利用者が判断し、仕様、ADR 0051〜0054、manual、実装記録を採用内容へ整合した。 |
| SITE-02 認証・書込み境界 | 15 | 15 | Completed | 同一tenant readを維持し、現存するcreate/update/Customer・Agreement変更/終了を会社管理者またはstrict role preset由来の`sites:write`へ限定した。直接permission、未知role、non-admin super-user、temporary/disabled/他tenantをUI・送信直前policy・Rulesでfail closedにし、generic delete/archive入口を停止した。再有効化と専用archiveは未実装のため、それぞれSITE-04/05で同じactor境界を強制する。 |
| SITE-03 CRUD・保存data契約 | 15 | 15 | Completed | 作成・基本情報・Customer・取極めをoperation別writerへ分離し、exact 34-field create、共通必須・型・長さ、server metadata、token・location等の派生field、Customer exact 6-field projection、仮Site解消を固定した。live modelと独立draft、同一field競合、変更なしwrite 0、失敗後再試行を検証した。 |
| SITE-04 終了・再有効化・自動終了 | 15 | 15 | Completed | ADR 0054に従い、TERMINATED masterの通常編集制限と確認付き新規選択、単発残工事、strict `sites:write`・reason・新工期による継続再開、工期終了後90日の派生Chipと自動終了、予定guard、競合、現在遷移metadataを実装した。予定作成・site/date移動はSite revisionとatomicにし、実績化は整合するOperationResultとの同時更新だけを許可する。既存予定等は暗黙に変更しない。 |
| SITE-05 archive安全性 | 15 | 15 | Completed | ADR 0051に従い、誤登録・重複だけを対象とする専用`archiveSite`、reason/audit/idempotency、exact 5 collectionの同一transaction参照確認、直接参照writerのlive Site存在barrier、generic delete／restore非到達、通常restore不在を実装した。下流snapshotとremote legacy shapeはSITE-09 preflightまで未確認とする。 |
| SITE-06 取極め契約 | 10 | 10 | Completed | ADR 0053に従い、strict `sites:write`、単価0〜10,000,000円の整数と0円確認、休憩・規定実働0〜1,440分、休憩と勤務区間、締日候補、重複を専用Callableで強制した。適用済みmasterの編集・削除を許可しつつ既存OperationResult snapshotを不変に保ち、専用履歴・revisionを追加せず、Siteの`agreementsV2/uid/updatedAt`だけを保存する。 |
| SITE-07 一覧・検索・UI整合 | 10 | 0 | Not started | ACTIVE/TERMINATED/仮Siteの表示、検索・pagination、Autocompleteのstatus境界、作成wizard validation、郵便番号反映、非同期race、loading/error/not-found、工期表示、keyboard操作、manualを整合する。 |
| SITE-08 Codex専用local統合確認 | 5 | 0 | Not started | 対象test、全domain、Firestore Emulator、専用local UI build、保存data、独立review、cleanup、文書・Git統合を完了する。内蔵ブラウザではSite画面に加え、SITE-04/05で直接・間接影響を受けた予定・稼働実績・請求・配置通知を、会社管理者・manager・controller・accountant・read-only相当・直接permission・未知role・temporary・disabled・他tenant・non-admin super-userの最小十分な組合せで操作する。成功時は改修前と同じまたは同等の結果と保存差分、拒否時は表示・実行拒否とDB不変を確認する。 |
| SITE-09 Dev反映・受入れ | 5 | 0 | Deferred / 別承認 | 他のマスタ改修とまとめたbounded Dev releaseで、旧client、既存data、権限別CRUD・終了・再有効化、関連表示を確認する。未実施のDev受入れを完了扱いしない。 |

重み合計は100である。本ロードマップ案の作成だけではマイルストーンを加点しない。

## 互換性・migration

- 現在のpath、document ID、status値、Customer変更、既存OperationResult・Billingのsnapshotを既定互換境界とする。既存dataを予防的に全件変換しない。
- UI・writer・Rulesを既存schemaへ揃えるだけならmigrationを作らない。field追加・削除・改名、型・必須・意味・保存構造が変わる場合、または既存dataへの確定した影響がある場合だけ、対象状態確認とmigrationを別checkpointへ固定する。
- Dev/remote状態確認はSITE-09の承認内で必要最小限に行う。既存flat archive、active/archive同ID、stale埋込みCustomer等が確認された場合は、件数・shape・backup・dry-run・post-check・rollbackを示すまでapplyしない。
- schema package変更は前提にしない。AirGuardV2内のoperation contractで解決できず変更が必要と確認された場合だけ、関連repositoryとpackage releaseを別承認する。

## rollback

- 各local phaseはUI、application action、Functions、Rules、test、文書をreview可能なcommit単位にし、data変更がなければ当該commitのrevertを基本とする。
- 権限縮小やarchive停止の検証が失敗した場合、既知の広いwriteやgeneric deleteを再開せずlocalで停止する。
- archive済みdata、status監査data、migration結果が生じた後はcode revertだけで復旧しない。入口停止、互換Rules維持、対象dataの別承認restoreを組み合わせる。
- SITE-09のDev releaseは対象commit、service、Rules、Functions、migration、backup、停止条件、復旧先を実行前に固定する。

## 検証計画

- 設計時: actor・tenant・field・status・Customer・archive・Agreement・自動終了・transaction分離の失敗経路とsecurity review。
- unit/source contract: operation入力、変更field、draft競合、検索sequence、UI表示・送信直前policy、generic delete/restore非到達。
- Firestore Emulator: actor matrix、他tenant、Customer参照、status遷移、archive CUD、nested fallback、同時実行とwrite 0拒否。
- local UI: write actorとread-only actor、作成・編集・終了・再有効化、検索、失敗後入力保持、二重送信、reload。今回の差分がSite外のwriterまたは参照へ影響する場合は、影響機能について改修前と同じまたは同等のUI操作結果を権限別に確認し、backendの保存差分または不変を照合する。自動testだけを実ブラウザ操作の代替にしない。具体的な省略・代替が必要なら利用者判断を得る。
- implementation時のchange classは最終差分に応じて`ui-css-layout`、`application-logic`、`data-contract-schema-migration`のunionを選ぶ。Dev/Prod generate・deploy・remote/data操作はSITE-09等の別承認がない限り実行しない。

## 次の承認点

SITE-05の安全な誤登録archiveとSITE-06の取極め契約をCodex専用localで実装・検証し、進捗は80%である。次は承認済みSITE-07として、一覧・検索・作成wizard・郵便番号・非同期状態・表示・keyboard操作をSite機能内で整合する。既存予定の`operationResultId`・日付field欠損、既存archive・取極め・下流snapshotのremote shapeはSITE-09のDev反映前preflightで確認し、競合があれば有効化・applyせず別承認へ止める。Dev・remote・実dataにはSITE-09の別承認まで接続しない。
