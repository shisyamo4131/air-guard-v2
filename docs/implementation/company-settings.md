# Company（自社情報・会社設定）（実装調査）

> 2026-08-30 CCB restart: ADR 0025/0028/0029の8 document・runtime互換・全設定revision/audit設計はADR 0031により置換された。以下の実装観測は現行codeの事実として保持するが、旧目標設計はhistoricalである。新設計はCompany全体setの廃止、operation別exact field update、real-time listener、根拠のある場合だけの分割・強い競合制御を採用し、Stripe関連情報を現段階の対象から除外する。
>
> 2026-08-30 corrective rollback: runtime compatible reader、8-target migration/restore tooling、pre-containment Rulesと専用testを主repositoryから除去した。現在のapplicationは再びlegacy Company rootを直接読み、Rulesは同社Userのroot updateを許可しつつclient create/deleteを拒否する。Schemas `.167` pinとAdmin SDK guardは保持している。次の変更対象は以下に記録したwhole-document writerである。
>
> 2026-08-30 adopted editor boundary: `AirItemManager`・`AirArrayManager`をFirestore CRUDの既定componentから外し、Companyをoperation固有editorへ段階移行する。Class schemaによるdocument共通validationは維持し、operation contractを加えて最新live Companyへ変更fieldを重ねたcandidateを検証する。入力中のdraftはlistenerから独立させ、保存は実際に変更されたoperation所有fieldと更新metadataだけに限定する。最初の対象はCompany基本情報である。
>
> 2026-08-30 Company profile implementation: 基本情報10 fieldを`CompanyProfileEditor`と`updateCompanyProfile` Callableへ移行した。変更fieldだけを最新Companyへ重ね、Schemas `.167`でclient/serverの両方が検証する。client直接profile変更はRulesで拒否し、振込先・通常設定・取極め・表示順は後続移行まで旧writerを継続する。
>
> 2026-08-31 Company billing acceptance: 振込先5 fieldを同じCompany rootに維持し、同社の有効な本登録User read、非super-user会社管理者だけの専用Callable write、all-null/all-complete相関、変更fieldだけの保存、client直接write拒否、再読込専用競合、明示clear、口座名義込み帳票を実装した。local自動検証とCodex in-app UI smokeに加え、会社管理者での保存・clear・復元・二画面競合、一般ユーザーの画面拒否、実請求PDFの口座情報出力を実際の利用環境で確認し、最終UI acceptanceを完了した。
>
> 2026-08-30 Company operations implementation: 通常設定4 fieldを同じCompany rootに維持し、`CompanyOperationsEditor`と`updateCompanyOperations` Callableへ移行した。legacy保存値は維持して共有canonical parserへ写像し、欠損時は検証上だけ既定値を補う。local自動検証、Codex in-app UI smoke、利用者の実際の利用環境での最終UI acceptanceを完了した。
>
> 2026-08-31 Company arrangement acceptance: Company既定取極めUI/writer撤去と表示順専用更新を実装し、自動検証に加えて、項目1〜14、一般利用者の画面非表示、二画面競合、終了済み現場の表示を利用者が実際の利用環境で確認した。
>
> 2026-08-31 CPU-05 acceptance: 静的caller 0を再確認した旧`CompanyManager`と`useSiteOrderManager`を削除し、Company rootのclient create/update/deleteを全面拒否した。同社Userのreadと4つの専用Callableは維持する。全domain 726件、隔離Emulator 107件、一般review GO、security review 5/5が成功した。Codex in-app UI smokeは起動templateのNuxt `ECONNRESET`で停止したが、利用者承認の会社管理者Chromeで会社設定・稼働予定管理・配置管理、3 editor、2表示順dialog、未変更時の保存無効、キャンセル、console error 0件をCodexが確認し、local受入れを完了した。データ保存は行っていない。

## メタデータ

- 状態: 段階移行中（Company基本情報・振込先・通常設定・表示順と旧Company全体writer除去のlocal受入れ完了、CPU-06 Dev反映待ち）
- 対象セグメント: SPEC-SEG-027、SPEC-DEEP-039a
- 最終確認日: 2026-08-31
- 根拠ファイル: `pages/settings/company.vue`、`components/Company/ProfileEditor.vue`、`components/Company/BillingEditor.vue`、`components/Company/OperationsEditor.vue`、`components/Company/Activator/Base.vue`、`components/Company/Activator/Bank.vue`、`components/Company/Activator/Setting.vue`、`schemas/Company.js`、`composables/application/company/useCompanyProfileUpdate.js`、`composables/application/company/useCompanyBillingUpdate.js`、`composables/application/company/useCompanyOperationsUpdate.js`、`functions/apis/updateCompanyProfile.js`、`functions/apis/updateCompanyBilling.js`、`functions/apis/updateCompanyOperations.js`、`functions/modules/company/updateCompanyProfile.js`、`functions/modules/company/updateCompanyBilling.js`、`functions/modules/company/updateCompanyOperations.js`、`stores/useCompanyStore.js`、`composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js`、`firestore.rules`、`test/domain/company-legacy-writer-removal.test.mjs`

## 入口・権限

- `/settings/company`はpageSettingsで`ADMIN` access policyを参照する。一般pageの互換規則により会社管理者とsuper-userを許可し、navigationも同じpolicyを使用する。
- 画面は基本情報、口座情報、設定情報を専用editor/Callableで編集する。会社既定取極めの編集入口は撤去済みで、Site固有取極めは維持する。
- 基本情報、口座情報、設定情報の編集controlとCallableは、同じtenantの有効な本登録会社管理者だけを許可し、super-userを拒否する。page自体の既存`ADMIN` access policyは変更していない。
- Rulesは同じtenantの有効な本登録UserへCompany readを許可し、Company rootのclient create/update/deleteを全actorへ拒否する。正規の変更は基本情報・振込先・通常設定・表示順の4つの専用Callableまたは承認済みAdmin SDK経路に限定する。Company subcollectionの既存境界はこのcheckpointで変更していない。

## データ契約

Companyはroot collection `Companies/{companyId}`に保存され、`usePrefix=false`、自動採番なし、logical deleteなしである。

| 分類 | fields・default・契約 |
|---|---|
| 会社名 | `companyName` required/最大100、`companyNameKana` required/最大200・カナ数値入力。基本情報operationはSchemas `.167` contractでclient/server同一検証 |
| 住所・連絡 | `zipcode`、`prefCode`、`city`、`address`、`building`、`tel`、`fax`。初期作成時は任意 |
| 適格請求書 | `invoiceNumber`任意、最大13。画面/PDFが先頭に`T`を付ける |
| 振込先 | `bankName`最大100、`branchName`最大100、`accountType`は普通・当座、`accountNumber`最大7、`accountHolder`最大200。5 fieldすべてnullまたは5 fieldすべて有効であることを要求する |
| 既定取極め | `agreementsV2`（AgreementV2配列）。旧`agreements` getter/setterは警告して空配列/無処理 |
| 表示順 | hidden `siteOrder`、`scheduleOrder`（SiteOrder配列） |
| 位置 | hidden `location`。converterがlat/lngから`geopoint`を保存。`fullAddress`、`prefecture`は読み取り専用プロパティ |
| 運用設定 | `minuteInterval` default 15、UI 5〜30を5分単位、`roundSetting` default ROUND、`firstDayOfWeek` default定数先頭、`attendanceManagementMode` default ACTUAL_DATE。legacy勤怠値はACTUAL_DATE→LABOR_STANDARD、OPERATION_DATE→OPERATION_COUNTへ検証時だけ写像する |
| Stripe | hidden `stripeCustomerId`、hidden `subscription`。defaultはid/status/currentPeriodEnd null、employeeLimit 10 |
| maintenance | hidden `maintenanceMode=false`、reason/startAt/startedBy null |

PDFの振込先判定はSchemas `.167`の共有parserを通し、5 fieldすべてが有効な場合だけ印字する。`isCompleteRequiredFields`は会社名・カナ・郵便番号・都道府県・市区町村・住所・電話の全存在を判定する。

## 作成・初期化

1. clientがFirebase Auth管理者accountを作成してverification emailを送る。
2. 認証済み`createAdminAccount`が会社名・カナ・表示名を検証する。
3. Firestore transactionでCompanyを自動doc IDで作成し、同じtransactionで`Companies/{companyId}/Users/{authUid}`をadmin Userとして作成する。
4. transaction後にAuth custom claimsへ`companyId`と`isSuperUser=false`を設定する。
5. login初期化時、claim companyIdをdoc IDとしてCompanyをfetchしlive購読する。

Company/User transactionとclaims設定はatomicではない。claims失敗時のpartial stateはSPEC-SEG-025のFUT-0081に記録済みである。

## 編集・validation

- 基本情報editorは`companyName/companyNameKana/zipcode/prefCode/city/address/building/tel/fax/invoiceNumber`の10 fieldを独立draftで編集する。live Companyをdraftへ直接bindしない。
- 保存時はdraftで変更したfieldだけを抽出し、最新のlive Companyへ重ねて`Company`/Schemas `.167` contractで再検証する。Callableもtransaction内の最新Companyで同じ検証を行い、実際に値が変わるfieldだけを保存する。
- 基本情報の保存にはserver timestampの`updatedAt`と実行者`uid`を加える。住所5 fieldのいずれかが変わった場合は、古い座標を残さないため`location/geopoint`をnullへ戻す。geocode再取得はこのcheckpointでは行わない。
- 編集中に基本情報のlive値が変わった場合、draftを自動置換せず警告して保存を止める。「最新値を読み直す」だけを表示し、押下時に現在draftを破棄して最新Companyから作り直す。曖昧だった「自分の入力を優先する」は利用者local確認を受けて削除した。
- 基本情報dialogの初期DOMは`v-dialog > v-card > v-form > v-card-text/actions`だった。Vuetifyは通常dialogのdirect child `v-card`へ`overflow-y:auto`を設定し、`scrollable`時に本文だけをscrollするselectorは`v-dialog > form > v-card > v-card-text`を前提とする。この親子順序不一致がtoolbarとactionsまでscrollした直接原因である。`v-dialog scrollable > v-form > v-card > toolbar/card-text/actions`へ変更し、`v-card-text`だけをscroll対象にした。
- 利用者はlocal環境で修正版を再確認し、基本情報cardのtitle、dialog本文だけのscroll、外部更新後の再読込専用UIを受け入れた。先に合格した権限と更新metadataを含め、Company基本情報のlocal受入れは完了した。
- 基本情報と口座editorは、入力検査の開始前からsingle-flightを立て、server応答まで入力欄・選択欄・削除・取消・保存・最新値の再読込を操作不可にする。再読込処理自体も保存中は何もしない。自分自身の保存結果がlive listenerから返った場合は外部更新警告を出さず、本当に異なる値が返った場合だけ保存を止める。server失敗中に外部更新された場合は、操作を戻した後も警告と再読込を残す。
- 口座editorは5口座fieldをlive Companyと別のdraftで編集する。5項目全部の登録または明示的な全削除だけを許可し、保存直前まで同じ5 fieldの外部変更を再確認する。競合時は現在入力を保存せず「最新値を読み直す」だけを提供する。
- 通常設定editorは4 fieldを独立draftで編集し、保存開始からserver応答まで全入力・選択・増減・取消・保存・閉じる・最新値の再読込を無効にする。自分の保存reflectionは競合にせず、本当に異なるlive値だけで保存を止める。
- `updateCompanyOperations`はexact `{changes}`の非空subsetだけを受け、transaction内の最新Companyへ重ねて検証する。実際に変わったfieldとserver `updatedAt`・actor `uid`だけを更新し、同値はwrite 0とする。
- 既存Companyの`attendanceManagementMode`が欠損・null・空文字の場合は、別fieldの更新を妨げないよう検証上だけ`LABOR_STANDARD`とするが、勤怠fieldを補完保存しない。未知値は拒否する。変更要求としてはlegacyの既知2値だけを許可する。
- Company既定取極めの編集入口とwhole-document writerは撤去済みで、保存済み`agreementsV2`とSite固有取極めは維持する。
- `siteOrder`と`scheduleOrder`は専用Callableが変更対象fieldとserver管理metadataだけを更新し、Company全体setを行わない。

## 2026-08-31 振込先更新契約（local実装・Codex検証・利用者最終UI acceptance完了）

- readはCompany rootの現行境界を維持し、同社の有効な本登録Userを許可する。writeは同じtenantの有効な本登録会社管理者だけを許可し、super-user、非管理者、temporary、disabledを拒否する。
- `updateCompanyBilling`はidentityからtenant pathを導出し、exact `{changes}`の5 field subsetだけを受ける。現在の`invoiceNumber`は共有billing parserのvalidation contextに使うが、振込先operationで受信・更新しない。
- 最新Companyへchangesを重ね、5 field all-nullまたはall-completeを検証する。legacyの`accountType=普通`だけの空口座は未登録表示へ正規化するが、open/no-op saveで書き戻さない。明示clearは5 fieldすべてnull、partial legacyはcomplete repairまたは全null化だけを許可する。
- transactionは実際に変化した振込先fieldとserver `updatedAt`・actor `uid`だけを更新する。Rulesは振込先5 fieldのclient直接変更を全actorへ拒否し、未移行operationの無関係field互換を維持する。
- editorはlive Companyと独立したdraftを使い、同じ振込先fieldの外部変更で保存を止め、「最新値を読み直す」だけを提供する。完全な5 fieldだけを口座名義込みで請求PDFへ印字し、長い口座名義をrender test対象とする。
- `CCB-COMPANY-BILLING-CODEX-IMPLEMENT-001`でapplication、Functions、Rules、domain/Emulator/PDF testを実装した。振込先・PDF対象17件、全domain 676件、専用Emulator 102件が成功し、Codex in-app UIで管理者の編集入口、5項目、明示clear、架空口座の保存反映を確認した。利用者の会社管理者Chromeでは5項目の保存、明示clear、元値への復元、dirtyな二画面競合と最新値再読込をCodexが通常操作で確認した。利用者は実請求PDFの口座情報出力を確認した。一般ユーザーChromeでは管理者メニューと会社設定入口がなく、直接URLもダッシュボードへ戻され、新規タブでconsole error 0件だった。自動testの長値render検証を合わせ、最終UI acceptanceを完了した。
- `CCB-COMPANY-EDITOR-SAVING-STATE-FIX-001`で基本情報・振込先の保存中制御と自己保存reflection判定を補正した。会社情報12件、振込先19件、全domain 688件が成功した。Codex専用UIは起動templateから製品画面へ移る前にNuxt `ECONNRESET`で停止したが、利用者が実際の環境で保存中の操作不可と自己保存時の警告非表示を確認し、この補正の最終UI acceptanceを完了した。

## 2026-08-30 通常設定更新契約（local実装・Codex検証・利用者最終UI acceptance完了）

- `minuteInterval`、`roundSetting`、`firstDayOfWeek`、`attendanceManagementMode`だけを所有し、Company rootは分割しない。data migrationやfield renameも行わず、legacy保存値を維持する。
- 同じtenantの有効な本登録会社管理者だけが保存でき、super-user、非管理者、temporary、disabledを拒否する。identityからCompany pathを導出し、client入力のtenant IDを受けない。
- Rulesは4 fieldと将来用`attendanceSummaryMode`のclient直接変更を拒否する。profile・billing保護、同社User read、未移行fieldの互換updateを維持する。
- 対象19件、全domain 707件、専用Emulator 104件が成功した。Codex in-app UIでは15分から20分への保存中に全controlが無効になること、完了後の表示反映、自己保存警告なし、15分への復元、console error 0件を確認した。終了後は専用port 0、runtime 0である。
- 利用者は実際の利用環境で、4項目表示、1 fieldだけの保存、保存中全control無効、自己保存警告なし、真正競合の再読込、非管理者・super-user拒否を確認し、通常設定operationを受け入れた。振込先の最終UI acceptanceも完了したため、CPU-03を完了した。

## 2026-08-30 Company既定取極め撤去・表示順更新契約

- Company設定pageからCompany既定`agreementsV2`の編集UIとCompany whole-document writerを撤去した。Site詳細の取極めUI、schema field、保存済みCompany値は維持し、data migrationしない。
- `siteOrder`と`scheduleOrder`は専用`updateCompanyArrangement` Callableへ移行した。会社管理者、または既知preset由来のfield別write permissionを持つ同社の有効な本登録non-super-userだけが保存できる。
- Callableはexact `{field, order}`を受け、対象fieldとserver管理metadataだけをtransaction updateする。同値はwrite 0で、Rulesは`agreementsV2/siteOrder/scheduleOrder`のclient直接変更を全actorへ拒否する。
- editorは独立draft、再読込専用競合、自保存reflection除外、single-flight、保存中の全関連操作停止、失敗時draft維持を実装した。既存Siteは終了済み等の状態でも表示へ残し、missing/deleted Siteだけを表示から除外して明示保存時だけ旧参照を除去する。Site取得失敗時はdraftを維持して保存を止める。
- 専用15件、全domain 722件、Codex専用Emulator 106件、security review 4/5が成功した。Codex in-app UI smokeは起動templateから製品画面へ遷移せず対象操作前に停止した。利用者は実際の利用環境で項目1〜14、一般利用者の対象画面非表示、二画面競合、終了済み現場の表示を確認し、最終UI acceptanceを完了した。
- 詳細なactor、入力、競合、rollbackは[ADR 0035](../decisions/0035-company-display-order-update-boundary.md)、Siteの表示判断は[ADR 0036](../decisions/0036-terminated-site-display-order-visibility.md)を正とする。

## tenant identity

- Company doc IDがtenant IDで、Auth custom claim `companyId`、User.companyId、全subcollection prefixの基準となる。
- Company schema自身にcompanyId fieldはなく、identityはdoc path/docIdで表現する。
- clientはclaim companyIdのCompanyだけを取得・購読する。Rulesもroot Company doc IDとの一致をtenant境界にする。
- doc ID変更・tenant移転・会社統合・分割の実装経路はない。

## 下流参照・変更影響

- 請求書PDFは生成時に`companyStore.company`をlive参照し、会社名、住所、電話、invoiceNumber、振込先を帳票へ載せる。BillingへのCompany snapshotはこの経路で使用しないため、設定変更後の再生成は新しいCompany値になる。
- `roundSetting`は売上・税の端数設定として参照される境界、`attendanceManagementMode`と`firstDayOfWeek`は勤怠表示・定数導出の境界を持つ。
- `siteOrder/scheduleOrder`は配置・予定表示順にlive利用され、専用actionがCompanyをupdateする。
- `maintenanceMode`はSystem全体maintenanceとのORで現在会社のmaintenance判定にlive反映される。
- `subscription`からCompanyStoreの`customerType`を導出し、Stripe checkout画面がstatus/employeeLimit/currentPeriodEndを表示する。Stripe webhookがsubscriptionを更新し、checkout作成がstripeCustomerIdを更新する。
- Arrangement PDFはCompany storeを参照するが、具体的なfield mappingは本セグメントでは追跡していない。

## 停止・削除

- Company固有のstatus、停止、archive、delete guard、restore methodはない。
- 旧CompanyManagerはCPU-05で削除した。clientのCompany root create/delete入口はなく、Rulesもcreate/update/deleteを全面拒否する。
- RulesはCompany rootのclient deleteを拒否する。server/operatorによる停止・decommission・repairとsubcollection保持は未確定であり、root欠損と子data残存の既存・部分失敗状態を検知・修復する契約もない。
- `maintenanceMode`は利用停止ではなくSystemStoreのmaintenance表示判定に使われるhidden fieldで、設定画面から編集できない。
- subscription終了はStripe側同期でsubscription内容をnull/employeeLimit 0へ更新する境界であり、Company削除やtenant停止は行わない。

## Rules・security

- Company rootのclient create/update/deleteはfieldやactorにかかわらず全面拒否する。同じtenantの有効な本登録Userによるreadは維持する。
- 基本情報、振込先、通常設定、表示順は4つの専用Callableがoperation所有fieldと更新metadataだけを検証・更新する。Company既定取極めのUI/writerは廃止済みである。
- hidden `stripeCustomerId/subscription/maintenance*`をclientがroot updateで直接変更する経路も閉じた。ただし同じrootに残るため同社Userのread対象であり、将来の分割・server projection要否は別設計とする。
- Company rootはclient write全面拒否のためRules内field validationを必要としない。Company subcollectionの広い既存write境界は今回の対象外である。
- Company docは多くのsubcollectionと認証claimのanchorであり、通常masterより削除・改変影響が大きい。

## 矛盾・未使用候補

- pageの既存access policyはsuper-userにも画面到達を許可するが、基本情報・振込先・通常設定の編集controlとserver保存は会社管理者だけに限定し、表示順は会社管理者またはfield別既知preset actorに限定する。旧Company全体writerは残っていない。
- `Company.scheduleOrder.add`はimportされていない`ScheduleOrder`をnewしており、呼出し時ReferenceErrorとなる実装である。配列customClassはSiteOrderなので命名不一致でもある。
- hidden server-owned候補fieldと利用者編集fieldは同一documentに残る。client writeは閉じたが、read分離が必要かは具体的な閲覧制約に基づいて後続判断する。
- Company旧`agreements` accessorは常に空/無処理で残存する。

## 2026-08-27 横断再調査

- Company documentは会社プロフィールだけでなく、請求元・口座、丸め・勤怠方式、取極め、Site/Schedule表示順、maintenance、Stripe/subscription、tenant初期化を共有する。確認済みの現在影響は本実装調査、改修順と進捗は[Company設定改修ロードマップ](../roadmaps/company-settings.md)を参照する。
- 請求PDFはlive Company情報を参照し、`roundSetting`はprocess-global設定へ反映されるため、設定変更後の過去帳票・計算結果の再現性を保証できない。
- `attendanceManagementMode`は参照する勤怠data経路を切り替えるが、既存data migration、preview、発効時点は確認できない。`minuteInterval`と`firstDayOfWeek`は主にUI表示・選択肢へ作用する。
- `siteOrder`と`scheduleOrder`は配置・予定画面に利用される。専用write permission、revision、参照切れ修復はない。Company既定`agreementsV2`は設定入口を確認したが、Site取極めへfallbackする実consumerを静的調査で確認できず、manual記述と一致しない。
- maintenanceはclient routeの抑止であり排他lockではない。Admin SDKの`maintenanceStartedAt`等とCompany schemaのfield名にも差がある。
- Stripe moduleは現行Functions entryで公開停止中だが、同じrootにあるsubscription fieldはclient update/read可能である。再有効化前にserver ownership、price/origin allowlist、冪等性、event順序、tenant mapping、Employee上限強制が必要である。
- Firestore Rulesはdocument内のfieldをread時に隠せない。銀行、Stripe、maintenance等の閲覧者を狭める場合、subdocument分割またはserver projectionが必要になる。

## 2026-08-28 承認済みCCB目標（未実装）

以下は2026-08-30に置換された旧目標契約であり、rollback inventoryと判断履歴としてのみ参照する。現在の正本は[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)と[現行仕様](../specification.md#company設定とtenant-lifecycle)である。

- 改修コードを`CCB`とし、rootはserver-controlledの最小tenant anchor、設定は`Settings/profile`、`billing`、`operations`、`arrangement`へ分割する。entitlement/maintenanceはclient-safe `Settings` projectionとserver-only `PrivateSettings`を分け、collection数抑制は制約としない。
- profile/billing/operationsは会社管理者write、profile/billingは同社の有効な本登録User read、arrangementは配置・予定の既存permission actor writeとする。rootとclient-safe `Settings/entitlement`・`Settings/maintenance`はserver/providerだけがwriteし、必要なprojectionを同社Userがreadする。`PrivateSettings/entitlement`・`PrivateSettings/maintenance`はclient read/write不可とする。super-userはCompany設定actorに含めない。
- profile/billing/operationsはrevisionとmasked append-only auditを持つ。auditは会社管理者専用Callableだけで閲覧し、理由を必須にしない。arrangementは履歴なしの現在値・revisionとする。
- 文字数は利用者の見た目と一致するUnicode Extended Grapheme Cluster単位とし、結合文字で表した`が`も1文字と数える。会社名100文字、カナ200文字、invoice 13数字保存、完全入力時だけ有効なbank、signupと請求確定の別必須条件、長値を切り捨てない帳票を採用する。保存時はtrim以外のUnicode正規化を自動適用しない。
- `minuteInterval`は5分単位の`5/10/15/20/25/30`だけを許可する。root、各Settings、PrivateSettings、auditのexact schema v1は[ADR 0025](../decisions/0025-company-configuration-boundary.md#exact-schema-v1)を正本とする。
- `attendanceManagementMode`は`attendanceSummaryMode`の`LABOR_STANDARD`/`OPERATION_COUNT`へ置換し、両projectionを常時生成して表示・navigationだけを切り替える。`roundSetting`はOperationResult作成時、issuer情報は請求確定時にsnapshotする。
- `agreementsV2`とCompany geocodingは廃止予定で、既存fieldの削除は別migrationとする。Site既定取極めはCustomer側の後続設計へ移す。
- lifecycleは`ACTIVE`/`SUSPENDED`/`CLOSED`とし、rootを通常削除しない。Company maintenanceは[project-wide quiet procedure](../runbooks/maintenance-and-data-change.md)へ接続する。
- Stripe本体とemployeeLimit実強制は正式release直前の別改修へ延期し、CCBはserver-owned entitlement隔離だけを行う。

現行application codeと実dataは上記へ未移行である。Dev edition、fixture、全callerの静的・read-only照合、exact schema v1、Schemas `.167`公開は完了した。Admin SDK、AirGuardV2 app、Functionsはexact `.167`へpin済みである。Admin SDKはCCB tenantへの旧backup/restore/delete/maintenanceをwrite前に拒否し、新規legacy backupを固定16 collectionの`INCOMPLETE` v1、PrivateSettings除外、restore未提供として表示する。旧・不正metadataはPrivateSettings含有を`UNVERIFIED`とし、local一覧は分離sidecarだけを読む。client compatible readerはActive marker後のcomplete 6 Settingsを厳密検証して旧root全体更新を拒否する。canonical parityはCodex専用合成Emulatorのcreate-only transactionまで実装済みである。SettingAuditsはlocal-only pure plannerと合成testだけを実装し、同一scope・snapshot・digest・canonical schemaを満たす`exists=false` create候補以外を全体停止する。pre-containment Rulesは新3 collectionをgeneric fallbackから除外して再帰的client denyとし、reserved root fieldとactive rootを保護するlocal prototypeまで実装し、専用Emulator 8件と既存Rules回帰37件で検証した。予約fieldが一部だけ存在する異常rootは、無関係fieldのpatch updateだけを許容し、予約fieldを落とすlegacy whole-document replacementをfail closedで拒否する。artifact真正性・保存・audit apply・復旧演習、Rules remote deploy/receipt、Callable、設定画面、Dev staging/cutoverは未完了である。

## 2026-08-29 AirVuetify3・Company runtime state再調査

- `air-vuetify-v3`の`useItemManager.updateProperties()`は編集中の`internalItem`にある既存top-level propertyをlocalで置き換えるだけである。Firestoreの部分更新、changed-key収集、deep merge、永続化は行わない。
- `AirItemManager`はsubmit時に編集draft全体をcustom `handleUpdate(draft)`へ渡す。handlerがthrowした場合はdialogを閉じず、既存のloading・error・二重submit防止を維持できる。したがってCompanyManagerはmanager UIを再実装せず、application-ownedのscope別handlerへ差し替えられる。
- 当時のCompanyManagerの`item.update(item)`はcloneしたCompany全体をrootへ保存していた。profile editorに`invoiceNumber`が混在し、scope別のatomic save契約と一致しなかった。この経路はoperation別editor移行後、CPU-05で削除済みである。
- AirGuardV2 `schemas/Company.js`のCCB runtime mode/root/settings/errorはnon-enumerableで、base `clone()`が使う`toObject()`の`Object.keys`へ含まれない。編集cloneは`INITIALIZING`へ戻るため、LEGACYの既存更新もguardで失敗し得る。runtime stateを永続fieldにせずcopyするCompany固有cloneと、original/live Company stateを再検査するhandlerが必要である。
- Schemas exact `.167`が追加したのは`./company-configuration`のconstants、strict parser、legacy mapping等であり、旧`Company` classのlegacy propertyではない。`configurationState`はpersistedなActive markerで、legacyはmarker未activeとして判定する。`LEGACY/ACTIVE/INITIALIZING/ERROR`はAirGuardV2側のruntime stateである。
- この再調査により、local pre-containment Rules候補はdeploy可能状態ではないと訂正した。その後、全既存callerをoperation別Client/Server writerへ移し、CPU-05で旧whole-document writer 0件の静的検査とCompany root client CUD全面拒否のlocal回帰を完了した。remote Rules deployは別承認である。
- 先行writerは同じ4 Callableのmarker-aware contractとする。LEGACYは編集開始時のscope別expected value一致時だけlegacy rootをpartial updateし、reserved field・root whole-set・新path writeを0件とする。STAGEDはmaintenance中だけ存在して通常設定write/signupを拒否し、ACTIVEはSettings revisionと必要なauditを同一transactionで扱う。dual-writeは行わない。

## 将来要対応

- FUT-0090〜FUT-0094を`future-actions.md`へ登録した。CCBの確定契約はFUT本文より現行仕様とADR 0025を優先する。

## 要確認事項

- CONF-0074〜CONF-0078は2026-08-28に回答済みである。maintenanceのCONF-0079〜0082も回答済み、StripeのCONF-0083〜0087は正式release直前まで明示保留とした。

## 未確認範囲

### SPEC-DEEP-020 addendum

- CompanyManager only type-checks `doc` as object, delegates update to `item.update(item)`, and relies on AirItemManager for loading/error/dirty/double-submit behavior. The three icon edit activators add no role/loading/disabled guard.
- Active Activators expose distinct included-key lists; hidden Company integration fields are not editor keys but remain in the same broadly writable document. The three legacy `Company/Table/*Info.vue` files have no static caller.
- SettingInfo's weekday display directly dereferences an indexed constant and has no unknown fallback, unlike the active Setting activator. Full component-level evidence is in [Company components deep review](company-components-deep-review.md).

### SPEC-DEEP-039a addendum

- company pluginはCompany変更ごとにVuetifyのprocess-global defaultsとschema `RoundSetting` global modeを直接更新する。`minuteInterval`が0/null/falsyなら全minuteを許し、負数・小数・NaNのfail-closed validationはない。これはpicker候補制御であって保存値・計算丸めの強制ではない。
- user pluginもAuth UserのtagSizeからVuetify global defaultsを更新する。logout/account切替時にdefaultへ明示resetするbranchはなく、次Userがtruthyな既知値を持たない場合は以前のsizeが残り得る。
- `useConstants`はCompany colorDefinitionsをlive computedへ反映するが、空文字colorは`||`でdefaultへ戻す。`DEFAULT_DEFINITIONS`とWEEK_COLORSを参照のまま公開し、callerによるprocess内mutationを防がない。enum allowlistやpersisted value validationは別途必要である。

- 実Company/Stripe/subscriptionデータ、外部geocoding、Rules/Emulator、同時更新の再現。
- Subscription/Stripe/Billing/税計算、PDF layout、maintenance middlewareの内部。
- Company停止・解約・法的保持・tenant移転の現行運用、provider repairのexact手順。
