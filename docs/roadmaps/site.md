# Siteマスター改修ロードマップ

- 状態: Approved plan（計画承認済み・製品実装未承認）
- 目標: Site masterについて、同一tenantの閲覧・書込み権限、保存契約、Customer所属、終了・再有効化、archive、取極め、検索・表示を段階的に整合させる。
- 現在の進捗: 0%
- 部分加点: 行わない。各phaseの完了条件をすべて満たした時点で当該重みを加点する。
- 現在の承認境界: 現状確認と本ロードマップ案の作成まで。製品code、Firestore Rules、Functions、schema、package、data、local UI、Dev・Prod・remoteの変更・実行は、ロードマップ確認後の別承認とする。
- 環境境界: 実装が承認された場合も、SITE-01からSITE-08はCodex専用local仕様・実装・検証を基本とする。SITE-09のDev反映・remote/data確認は、他のマスタ改修とまとめる別承認checkpointで行う。

## 現状確認

### 確認済み事実

- `/sites`、`/sites/[id]`、`/sites/terminated`は`sites:read`で到達する。pageとSite managerは`sites:write`、status、actorをCRUD操作guardとして検査しない。
- 作成、基本情報・Customer・取極めの更新、手動終了、archiveは、Site schemaと共通client adapterを使うFirestore client直接writeである。Site master CRUD専用Callableはない。
- Firestore Rulesは同じtenantの有効な本登録UserにSiteのread/create/update/deleteを許可する。create/customerId変更時の同社Customer存在と、設定済みcustomerIdのunset拒否は強制するが、`sites:write`、operation別field、型・長さ、status遷移、archive形状は強制しない。`Sites_archive`も同じtenant Userにread/writeを許可する。
- Customer未定の仮Siteを作成できる。Customer設定後のunsetは拒否し、同じ会社に存在する別Customerへの変更は許可する。SiteのCustomer変更だけでは既存OperationResult・BillingのcustomerIdを変更しない。
- ACTIVE一覧は全件live購読後にclient filterする。TERMINATED一覧は検索文字列がある場合だけ取得し、空検索は0件である。Site Autocompleteはstatusを限定しない。
- 手動終了はJST当日以降のSiteOperationScheduleがある場合に拒否する。一方、日次自動終了は工期終了から3か月を超えたACTIVE Siteを、将来予定や同時更新のpreconditionなしでTERMINATEDへ変更する。
- generic archiveはSiteOperationSchedules、OperationResults、ArrangementNotificationsの参照をtransaction外で順に確認し、その後のtransactionで`Sites_archive`へ元documentを保存してactiveを削除する。UIからrestoreする経路はないが、共通adapterにはgeneric restoreがある。
- Customer更新triggerは同じcustomerIdを持つSiteの埋込みCustomerを複数batchで更新する。複数batch全体のatomicity、event順序、再収束は保証しない。
- Site detailはSite masterと同じ画面からSiteOperationSchedule、SiteEmployeeHistoryを扱う。稼働予定CRUDの権限・Rules・失敗経路はtransaction系の別課題であり、本ロードマップから実装を広げない。
- 既存自動testはroute access、Customer参照Rules、Customer埋込み同期、Company表示順とSite参照の回帰を含む。Site master固有のoperation別CRUD、`sites:write` actor matrix、field契約、終了・再有効化、archive競合、検索race、通常UIを一体で固定するtestは確認できない。

### 現行のまま維持する部分

- 会社prefix配下の`Sites/{docId}`、Firestore生成document ID、既存のSite fieldとACTIVE/TERMINATED値を、利用者判断なしに変更しない。
- 同社に存在するCustomerへの変更許可、設定済みcustomerIdのunset拒否、既存OperationResult・BillingのCustomer snapshot非移管を維持する。
- Customer未定の仮Siteを直ちに廃止しない。正式な作成・解消条件は既存dataとの互換性を確認してSITE-03で固定する。
- Companyの表示順では、documentが存在するSiteをstatusにかかわらず残し、不存在参照だけを次回の明示保存で除去するADR 0036の契約を維持する。
- Site内`agreementsV2`と、既存OperationResultへ適用済みのCustomer・AgreementをSite master変更だけで自動更新しない契約を維持する。

### 未確認・未決事項

- CONF-0049は回答済み。通常終了は`TERMINATED`としてlive Siteを保持し、誤登録・重複だけを全参照確認と並行writer barrierを備えた専用Callableでarchiveできる。generic delete／restoreと物理deleteは使用せず、通常restoreは提供しない。[ADR 0051](../decisions/0051-site-mistaken-registration-archive-boundary.md)を正とする。
- CONF-0050は回答済み。予定はlive Site、OperationResultは作成時snapshot、確定請求書はBilling revision snapshotを使い、既存実績・確定請求をSite master変更で更新しない。[ADR 0052](../decisions/0052-site-downstream-snapshot-timing.md)を正とする。
- CONF-0051からCONF-0053: 取極めの編集権限、数値範囲、適用済み取極めの訂正・削除・履歴。
- CONF-0135: 自動終了の猶予、将来予定、競合、通知、監査、再有効化との優先。
- 既存Site・archiveの件数とshape、仮Site・stale埋込みCustomerの状態、実利用actor、旧client併存、必要index、Dev/remote適用状態は未確認である。
- 導入済みschema packageの変更が必要かは未確定である。必要になった場合は関連repository、version、release、consumer導入を別承認とする。

### transaction系の既知課題として分離する事項

- Site detailから`sites:read`だけでSiteOperationSchedule CRUDへ到達でき、SiteOperationSchedules Rulesも同一tenant Userへ広いwriteを許す。
- Site名をlive取得するBilling PDFは、master変更後の再生成表示が変わり得る。Customer・Agreement・Site表示情報のsnapshot時点はADR 0052で確定したが、OperationResult・Billing・帳票へのsnapshot実装はtransaction側の別checkpointである。
- Site archiveの参照候補にはBilling、SiteEmployeeHistory等があるが、現行hasMany catalogには含まれない。ADR 0051により、誤登録archiveに必要な全参照inventoryとlive Site存在barrierだけはSITE-05の承認対象に含める。Company表示順はADR 0036の不存在参照除去契約を維持する。archive barrier以外のtransaction writer変更は本ロードマップで実装せず別checkpointへ分離する。
- 配置・通知・稼働実績・勤怠・請求・帳票のFirestore writer、rollback/refetch、同時実行、Rules、schema、APIは本ロードマップで変更しない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 内容と完了条件 |
|---|---:|---:|---|---|
| SITE-01 基準線・未決事項 | 10 | 0 | In progress | CONF-0049・0050は回答済み。0051〜0053、0135について、現行規則、変更案、影響、互換性、migration、rollback、検証を示して利用者判断を得る。全項目について仕様、ADR、manual、実装記録が採用判断と一致した時点で完了する。 |
| SITE-02 認証・書込み境界 | 15 | 0 | Not started | readは同一tenant境界を維持し、create/update/Customer・Agreement変更/終了/再有効化/archiveを会社管理者またはstrict role preset由来の`sites:write`へ限定する。直接permission、未知role、non-admin super-user、temporary/disabled/他tenantをfail closedにし、UI・送信直前policy・Rulesまたは専用Callableを一致させる。 |
| SITE-03 CRUD・保存data契約 | 15 | 0 | Not started | operation別の所有field、共通必須・型・長さ、server metadata、token・location等の派生field、Customer参照・埋込みCustomer、仮Site解消を固定する。live modelと独立draftを分け、同一field競合、変更なし、失敗後再試行を検証する。 |
| SITE-04 終了・再有効化・自動終了 | 15 | 0 | Not started | TERMINATEDのread-only、新規選択境界、理由付き再有効化、手動・自動終了の条件、将来予定、競合、監査、再試行を採用仕様へ揃える。既存予定等を暗黙に変更しない。 |
| SITE-05 archive安全性 | 15 | 0 | Not started | ADR 0051に従い、誤登録・重複だけを対象とする専用`archiveSite`、reason/audit/idempotency、全参照catalogの同一transaction確認、全参照writerのlive Site存在barrier、generic delete／restore非到達、通常restore不在を実装する。全barrierが揃うまでarchiveを有効化しない。archive barrier以外のtransaction変更と緊急restoreは別承認へ分離する。 |
| SITE-06 取極め契約 | 10 | 0 | Not started | `sites:write`との関係、入力範囲、重複、適用済み取極めの訂正・削除、OperationResult snapshot、Billing影響を確定し、Site documentの変更fieldだけを安全に保存する。 |
| SITE-07 一覧・検索・UI整合 | 10 | 0 | Not started | ACTIVE/TERMINATED/仮Siteの表示、検索・pagination、Autocompleteのstatus境界、作成wizard validation、郵便番号反映、非同期race、loading/error/not-found、工期表示、keyboard操作、manualを整合する。 |
| SITE-08 Codex専用local統合確認 | 5 | 0 | Not started | 対象test、全domain、Firestore Emulator、専用local UI build・通常操作、権限陰性、保存data、独立review、cleanup、文書・Git統合を完了する。transaction系は互換確認だけとする。 |
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
- local UI: write actorとread-only actor、作成・編集・終了・再有効化、検索、失敗後入力保持、二重送信、reload。具体的な省略・代替は各checkpointで合意する。
- implementation時のchange classは最終差分に応じて`ui-css-layout`、`application-logic`、`data-contract-schema-migration`のunionを選ぶ。Dev/Prod generate・deploy・remote/data操作はSITE-09等の別承認がない限り実行しない。

## 次の承認点

本ロードマップのphase分割、重み、未決事項の順序、transaction系の分離は利用者確認済みである。SITE-01を開始し、CONF-0049・CONF-0050を確定した。次はCONF-0051〜CONF-0053の取極め契約を一つの依存グループとして判断する。製品実装は承認済みcheckpointより前に開始しない。
