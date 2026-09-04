# 変更履歴

このファイルは、利用者、仕様、セキュリティ、運用に見える変更を記録します。詳細な判断理由は `docs/decisions/` に記録します。

## Unreleased

- Outsourcerを特定の協力会社masterとし、配置では同じOutsourcerを複数明細として登録できる現行方式を維持する。過去に試行して廃止したOutsourcer＋人数の集約方式と、外注警備員個人masterは今回採用しない。OUT-01で会社管理者またはstrict `manager`だけに作成・編集を許可し、正式なarchive policyが決まるまでclient deleteとarchive writeを停止した。OUT-02ではexact 11 field、型・長さ・system metadata、部分更新、名称変更時の検索token再生成、独立draftと同一field競合拒否を専用UI/writerとRulesへ実装した。OUT-03ではstatusをCustomerと同じ説明用フラグに限定し、一覧・検索・Autocomplete・配置・稼働実績の選択へ影響させないようACTIVE query条件を除去した。最終domain 934/934、local Emulator 147/147（OUT-02）、専用local UI build、文書検証を完了し、実装commitは`995488a5`（OUT-02は`31d11b15`、OUT-01は`82e22179`）。[ロードマップ](docs/roadmaps/outsourcer.md)を参照。Dev・remote・実dataは未変更である。

- 2026-09-04の反省会を受け、35,757 bytesだった`governance/project-rules.md`を常時境界と必読routingだけの小型indexへ変更し、project固有規則をcoordination/Git、development/data、environment/approval、documentation/verificationの4 segmentへ分けた。既存project coordinationへcheckpoint transition、既存local UI runbookへbuild前`UI-READY`を追加し、CAS-02の履歴と現行rollback、仕様と適用状態を分離した。新しい汎用手順書・verification gate・registryは追加せず、managed common governance、生成AGENTS、references、verification policy、製品code、data、environmentは変更していない。[判断](docs/decisions/0049-project-rule-routing-and-checkpoint-closeout.md)を参照。

- Customer archive safetyのCAS-04として、Customer詳細へwrite actor限定のアーカイブ確認を追加した。取引先コード・名称・注意事項・理由を表示し、処理開始前からのsingle-flight、参照拒否と安全なerror表示、成功後一覧遷移、通常restore入口不在を実装した。domain 913/913、local Emulator 142/142、専用build、write/read-only actor・参照拒否・高速double-click・成功archiveのlocal UI受入れ、独立review、commit `8db79a2e`を確認した。local未deployで、CAS-05のDev/remote反映・利用者受入れは未実施・別承認。[検証証拠](docs/verification/customer-archive-local-acceptance.md)を参照。

- Customer archive safetyのCAS-03として、`Customers_archive`のclient非公開、same-ID Customer再作成拒否、Site・OperationResult・Billingの新規Customer参照barrierをFirestore Rulesへ追加し、Billingのserver create/moveもCustomer確認と同じtransactionへ統合した。Siteは同じ会社の存在する別Customerへ変更可能な確定仕様を維持する。独立reviewでnested Billing path、transaction retry時の成功log、move競合testの偽陽性を補正し、最終domain 889/889、local Emulator 142/142、security再監査5/5、commits `8e6eb1d5`・`c99b8169`を確認した。local未deployで、CAS-03時点ではCAS-04 UIとDev/remote受入れが未着手だった。

- Siteの取引先は同じ会社に存在する別Customerへ変更可能と確定し、現行sourceと2026-08-11の回答履歴に仕様を一致させた。既存OperationResult・BillingのcustomerIdは履歴snapshotとして自動変更せず、一度設定したcustomerIdを未設定へ戻す操作も提供しない。既存実績への再適用は請求影響と監査を伴う別操作として将来判断する。現行application挙動とdataは変更せず、migrationは不要。

- Customer archive safetyのCAS-02について、別`Developer` taskを使うSpark試験はcontext window不足とSpark固有usage limitのため実装前に中止した。その後は通常の`developer`、`tester`、`security_reviewer`、`reviewer`サブエージェント運用へ切り替え、current Authとtransaction内actor/3参照確認、exact version 1 archive、same-operation retry、安全なresponse/logを持つ専用Callableとdomain/Emulator testをlocal実装した。最終`domain-full` 873/873、`local-emulator-suite` 123/123、独立review、local commit `74d0eb4d`、反省会を完了し、CAS-02を25点加点して全体進捗を45%とした。Spark利用案は棄却し、CAS-03/04は通常サブエージェント分割で開始した。CAS-03/04のlocal実装・検証・review・Git統合は承認済みだが、Dev/Prod、remote/data、deployは未着手・別承認であり、CAS-02差分単独はdeployしない。[実行契約と反省会記録](docs/implementation/customer-archive-cas02-developer-trial.md)を参照。

- 上下番確定の最初の操作で不明なerrorを示すSnackbarが再観測された事実をFUT-0027へ追記した。同じ時間帯のFCM登録403、thumbnail取得404、deprecated warningは因果未確認として分離し、次回改修で発生源と最終状態を追跡する。製品codeとDev環境は変更していない。

- 配置管理の表示順行削除について、観測と[提案0%の専用ロードマップ](docs/roadmaps/arrangement-row-removal-ux.md)を追加した。行pending、同一`siteOrder`のsingle-flight、live反映待機、失敗・timeout後の明示retryは未承認の詳細案であり、実装checkpointで別途確認する。Site/Schedule削除、schema、Rules、migration、generic UI全体は対象外で、実装・test・Dev反映は未着手。

- 設計・調査・review・development・testの独立scopeでは専門subagentを原則使用し、相互非依存workstreamは非重複ownershipと個別callbackを固定して原則並列に進めるproject ruleを確定した。coordinatorは報告の照合・矛盾解消・統合を主務とし、critical identifier、承認・scope、最終差分・検証exit status・Git統合・完了判断を自身で確認する。利用者Chromeやdesktop app、Dev・Prod・remote UI、外部account・session・stateの操作はcoordinator直轄とし、Codex専用loopback local UIは`ui_tester`へ委譲できる。[判断](docs/decisions/0047-subagent-parallel-coordinator-external-ui.md)を参照。権限、network、外部write、remote/data、deploy境界は変更していない。

- Customerの誤登録・重複archiveについて、専用Callable、一transaction内のSites・OperationResults・Billings参照確認、参照writerのactive Customer存在guard、same-ID archive tombstone、versioned audit envelope、client非公開、generic delete/restore非利用を設計として確定した。[判断](docs/decisions/0046-customer-archive-reference-barrier.md)と[roadmap](docs/roadmaps/customer-archive-safety.md)を参照。application、Functions、Rules、test、Dev/remote dataは未変更。

- 共通governanceを3.0.0へ移行し、すべてのtaskを同じrepository読取り順で起動する手順へ統一した。交代専用activation・最初のfile限定commit・governance変更による強制交代を廃止し、製品再開案内、文書route、検証policyとcheckerを整合した。[判断](docs/decisions/0045-governance-3-normal-startup.md)と[移行記録](docs/migrations/2026-09-03-governance-3.0.0.md)を参照。

- 現在地の報告にGitのlocal・remote両方の状態を含め、remote追跡refとlive確認を区別するproject ruleを追加した。未確認時の明示と既存承認境界を維持する。[確認手順](docs/runbooks/project-coordination.md#git現在状態の報告)を参照。

- Customerの取引状態を状況表示フラグとして基本情報から編集できるようにし、一覧に契約中・契約終了・全件の切替と状態列を追加した。作成はACTIVEを維持し、状態だけの変更では支払・住所情報を保存し直さない。旧ACTIVE限定選択方針を撤回し、基本編集の失敗後再読込と非同期準備後の再確認も補正した。[判断](docs/decisions/0044-customer-status-as-descriptive-flag.md)と[検証・適用状況](docs/roadmaps/customer-status.md)を参照。Dev反映・受入れは別工程。

- Customer検証で発見したブラウザ直接郵便番号通信に対し、Codex専用client buildだけで検索utilityを無通信に置換する補正を追加した。手入力・通常利用・通常Dev・関連package・保存形式は維持する。置換成功receiptと専用設定の固定をbuild/serveへ追加し、未隔離の専用診断launcherは起動前に停止する。[運用契約](docs/runbooks/local-ui-testing.md#専用uiの郵便番号隔離)と[検証・適用状況](docs/verification/customer-02-status-local.md)を参照。

- CustomerのDev・local分担検証を完了し、文書検証fixtureのリンク先コピー不足を修正して今回フェーズを閉鎖した。[確認範囲と結果](docs/verification/customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)を参照。Devテスト用会社と配下dataは利用者指示により今後も保持する。

- マスタデータ管理の改修を先行する利用者指示に合わせ、Customer直後に稼働実績管理へ移るroadmapの順序を訂正した。Customerの追加検証はreviewerの評価をもとに利用者と範囲を合意してから実行する。

- フェーズ着手前に変更・テストの対象と対象外、環境・data、期待結果・完了条件を利用者と合意し、他機能の受入れへ広げる前にも確認するproject ruleを明記した。今回の請求機能確認は稼働実績管理改修後へ移管した。
- CustomerのDev試験で座標付き作成・更新の失敗を再現し、Rulesの緯度・経度取得を正しいmethod呼出しへ修正した。Emulator113件・domain817件成功、Devの通常保存・既存備考復元・関連Site同期を確認。検証用Customer・Site・0円Billingは削除済み。詳細は[実行記録](docs/verification/customer-01d-dev-test.md)。

- Dev配信準備で見つかったService WorkerのFirebase設定未注入を修正し、独立buildと開発時の両方で公開設定を反映する。

- [ADR 0043](docs/decisions/0043-dev-trial-existing-document-handling.md)を採用した。機能改修時の既存Dev documentは全件診断・一括修復を標準前提にせず、通常操作で発見した不具合を修正する。Schemaの明らかな変更、field状態の他機能への明確な影響、その他具体的に必要と確認された場合は状態確認と必要なmigrationを必須とする。

- Customerの26保存項目をwriterと共有するread-only互換性検査toolを追加した。生のFirestore型・欠損・相関・取得完了を検査し、値やIDを出さず件数と固定理由だけを報告する。[Dev実行手順と停止条件](docs/runbooks/dev-deployment.md#customer保存形式のread-only事前検査)を用意し、Dev接続・反映は別承認のままとした。

- Customerの作成・基本情報更新・支払条件更新を専用処理へ移し、同一会社・有効な本登録User・承認済みrole、操作別fieldを画面とRulesで揃えた。active deleteとarchive CUDは拒否し、廃止予定の汎用manager経路をCustomerから除去した。自動検証と合成会社管理者によるCodex専用local UI受入れを完了し、詳細を[immutable receipt](docs/verification/customer-01a-local-acceptance.md)へ集約した。Dev、Prod、remote data、pushは変更していない。

- [ADR 0042](docs/decisions/0042-risk-based-local-ui-acceptance.md)を採用し、Codex専用local UI受入れはgenerated serverを標準、Nuxt開発サーバーを途中確認・診断用とした。条件を満たす既存画面・既存操作の内部改修は利用者local受入れを重ねず、新規性・利用者判断・実環境差がある範囲だけ利用者確認を残す。Dev・Prod・remote data・正式運用開始の別受入れは維持する。

- STRIPE-05/06のDev migration・利用者acceptanceを完了し、詳細を[immutable receipt](docs/verification/stripe-05-dev-release.md)へ集約した。あわせて[ADR 0041](docs/decisions/0041-single-source-documentation-and-final-validation.md)を採用し、変化する事実の単一正本、リンク中心の索引、再利用手順と実行証拠の分離、最終状態に対する一度のcompletion gate、記録後は失効したgateだけを再実行するproject-wide運用へ変更した。Dev接続・deploy・migrationは既存runbookを使用し、新しい小規模migration高速経路は追加していない。

- STRIPE-04の利用者用Emulator migrationを完了した。既存`./saved-data`を変更しないimport-only rehearsalと、同一baselineからのimport＋export-on-exit確定実行で、Company 1件の`stripeCustomerId`・`subscription`だけを削除した。各実行後の`StripeData`は0件、再dry-runはcleanで、会社設定・稼働予定管理・配置管理の正常表示とapp error 0件を確認した。確定保存後のsnapshotもimport-onlyで再読込みし、削除対象0件を確認した。利用者承認により別backupと確定後のpre-migration data rollbackを要求せず、無関係なCompany編集も受入れ条件から外した。migrationによるCompanyの他field・他業務dataへのwriteはなく、Dev/Prod・外部Stripe・pushは変更していない。roadmapは50%から70%へ更新した。

- STRIPE-03のlocal migration準備として、exact project `demo-air-guard-v2-codex`・Firestore Emulator `127.0.0.1:18080`だけで動くrehearsalをcommit `d5afe96927bf74809b9c3632f968905eff809975`へ固定した。既存Company rootの`stripeCustomerId`・`subscription`と既知形状の直接`StripeData`だけを対象に、値を出さないdry-run、exclusive backup、内容digest、事前状態再確認、all-or-zero apply、post-check、clean rerun、exact preimage rollback、競合・未知形状・入れ子dataの停止を合成dataで検証した。対象16/16、全domain 747/747、隔離Emulator 108/108、文書・差分確認、独立review・security reviewを成功させ、roadmapを35%から50%へ更新した。利用者local data、Dev/Prod、remote data、外部Stripe、deploy、pushは実施していない。

- STRIPE-02のlocal実装として、AirGuardV2 root/Functionsを公開Schemas exact `3.0.0-dev.1`へ揃え、checkout画面・route、legacy subscription readerとCompanyStore導出、未公開Stripe Functions、Stripe依存packageを削除した。`StripeData`は未認証・一般・会社管理者・SuperUserを含む全actorについて、直接・別tenant・入れ子・一覧取得をすべて拒否する。変更前後のpackage照合、全domain 731/731、隔離Emulator 107/107、独立review、security review、commit `509fabbe77124b7bfe03b8b50c39ab9b6b488426`のcleanな同一HEADでのlocal UI buildを成功させ、STRIPE-02を完了した。外部Stripe、既存Company/StripeDataのmigration、Dev/Prod、deploy、pushは実施していない。

- common governance 1.5.0反映後の`GOV15-AIRGUARD-POSTBENCH-EXEC-001`保存済み実測36件を再実行・推測せず記録した。全command exit 0、target 16/16、full domain 727/727、前後92-path/hash一致を確認した。operational root runはdocumentation 4→2、application 7→5、governance 6→5となり、warm-median合計は順に-36.2831%、-16.5809%、+19.0757%だった。governanceはnegative fixtureを8→12へ増やしpolicy/routing/inclusion検出を強化したため、時間増加をfailureとは扱わない。application、Functions、Rules、build、Emulator、Dev/Prod、network、remote/data、package、Schemas consumer、STRIPE-02は変更・実行していない。

- common governance 1.5.0とproject-owned verification policyを採用し、documentation、UI、application、data contract、governance、releaseの影響classごとにiteration・targeted・completion・release-only gateを選ぶ運用へ移行した。managed governanceに内包されるrendererの重複を除き、後続編集による証拠失効、unknown fallback、omission記録、marker-bounded operations summaryをvalidatorとnegative fixtureで検証する。application、Functions、Rules、build、Emulator、Dev・Prod、network、remote/data、Schemas consumer、STRIPE-02は変更していない。

- Managed common governanceを1.4.1へ同期し、package・repository・Git・environment・deploy・dataのcritical identifierを当該turnの正本または実targetへ結び付けた。Schemas consumer更新にはsource tag、release evidence、root/Functions manifest・lockのname、version、resolved、integrityを変更前後に機械照合するpreflightを追加し、誤ったpackage名ではstate change前に停止する。product code、dependency、Functions、Rules、Dev・remote/dataは変更しない。

- STRIPE-01を完了した。利用者確認によりStripe関連物は未同期scaffoldで、Stripe側Customer・契約・Webhook等を考慮・操作しないと確定した。ADR 0038でAirGuard内のcheckout、reader/writer、未公開Functions、Rules、schema/package、Company root legacy field、`StripeData`の撤去範囲、4 Companyの値非出力migration、backup・rollback・停止条件を固定し、Company legacy Stripe情報削除roadmapを0%から10%へ更新した。product code、Rules、package、data、Dev、networkは未変更である。

- SuperUser兼会社管理者が自社の稼働予定・配置管理の表示順を変更できるよう、画面と専用Callableのactor判定を限定的に変更した。会社管理者でないSuperUserは対象role presetを持っていても拒否し、他tenant、temporary、disabled、SuperUser claimの欠損・型不正も画面・serverの両方でfail closedとする。対象16件、全domain 727件、隔離Emulator 107件、security review GOを確認し、release commit `0f09ec4ff907bf337ceab0c0e296b413a084182b`からDevへ`updateCompanyArrangement`を先、同一の182-file Hosting artifactを後にmaintenance・migrationなしで反映した。Functionは東京・Node.js 22・gcfv2・ACTIVE、public invoker維持、Dev origin CORS 204、更新後ERROR 0件だった。Hostingはindex・Service Worker・参照asset 26件が生成物と一致し、cache headerも正常だった。Codexは兼任accountのChromeで両画面の表示順入口・dialog・未変更時保存無効を確認し、利用者はDevで両画面の並べ替え保存・再読込を最終確認した。既知のFcmTokens permission errorとChrome message channel errorは別事象として区別した。Rules、remote claim、Company data、Prodは変更しておらず、表示順対応の最終UI acceptanceまで完了した。
- `DEV-COMPANY-PARTIAL-UPDATE-RELEASE-001`を完了した。DevのPITR 7日保持を確認し、release baseline `af29d26e94ae11b3ea09dce109587d6ecc466081`からCompany専用Callable 4件、同一の静的生成物、Firestore Rulesをmaintenanceなし・migrationなしで選択deployした。4件は東京・Node.js 22・ACTIVE・browser CORS成功、Hostingは生成物一致、Rulesはcompile/release成功だった。途中でHosting cache headerの適用順不良を検出し、`firebase.json`だけをcommit `8b4e20945bf40f23e2de316170cf0f0c12ac40fe`で補正して再deployし、画面本体とService Workerはno-cache、version付きassetはimmutableを実応答で確認した。利用者はDev会社管理者で時刻間隔を15分→20分→15分へ保存して問題なしと確認し、Codexは新規一般Userの新しいChrome tabで管理者menu・会社設定入口非表示、直接URL拒否、app error 0件を確認した。CPU-06を完了し、Company部分更新roadmapを85%から100%へ更新した。
- Company振込先の利用者最終UI acceptanceを完了した。会社管理者Chromeで5項目の保存、明示clear、元の値への復元、二画面でのdirty競合と最新値再読込をCodexが通常操作で確認し、利用者は実請求PDFに口座情報が正常に出力されることを確認した。一般ユーザーChromeでは管理者メニューと会社設定入口が表示されず、`/settings/company`の直接指定もダッシュボードへ戻され、切り分け用の新規タブでconsole error 0件だった。先行済みの自動testと長値render testを合わせてCPU-03を完了し、Company部分更新roadmapを65%から85%へ更新した。製品code、Dev・remote/data・deployは変更していない。
- Company全体を丸ごと保存していた未使用の`CompanyManager`と`useSiteOrderManager`を削除し、Company rootへのclient create/update/deleteをFirestore Rulesで全面拒否した。同じ会社の有効な本登録Userによるreadと、基本情報・振込先・通常設定・表示順を変更する4つの専用Callableは維持する。client sourceをASTで検査する回帰testを追加し、全domain 726件、隔離Codex Emulator 107件、一般review GO、security review 5/5が成功した。Codex in-app UI smokeは起動templateでNuxt `ECONNRESET`となったが、その後、利用者承認の会社管理者Chromeで会社設定・稼働予定管理・配置管理を再読込し、3つの会社設定editorと2つの表示順dialogが開閉でき、未変更時の表示順保存が無効で、console error 0件であることをCodexが確認した。データ保存は行わずCPU-05のlocal受入れを完了した。Dev・remote/data・deployは行っていない。
- 表示順の二画面競合について、利用者が開いていた同じ会社管理者Chrome 2画面をCodexが通常操作して再確認した。未保存変更がない画面は他画面の保存結果を自動反映し、その後の編集を最新順から開始する。未保存変更がある画面は自身の順を維持し、外部更新警告を表示して保存を無効化する。利用者はこの区別と、終了済み現場も並べ替えに表示されることを実際の利用環境で確認して受け入れ、CPU-04の最終UI acceptanceを完了した。確認で変更した表示順は元へ戻した。
- DEVの上下番確定でOperationResult作成後に予期しないerror Snackbarが表示された未解決事象を、既存FUT-0027へ追加した。ArrangementNotificationのLEAVED更新を一仮説として、OperationResult・SiteOperationSchedule・全通知の実行順、await、部分成功、再実行、Snackbar発生元、FcmTokens 403との因果分離を次回改修時の調査・検証条件にした。SecurityReports 404とChrome message channel errorも同時観測として区別し、原因とは断定しない。共有logのFCM token等の機密値は記録していない。
- 表示順編集では、現場が終了済みでも将来の突発的な稼働予定に備えて並べ替え対象へ残し、現場documentが存在しない削除済み参照だけを非表示にするよう補正した。取得失敗時は編集中の並びを保持して保存を止める。専用15件と全domain 722件が成功し、利用者の最終UI確認も完了した。
- Company設定から利用されていない会社デフォルト取極めの編集入口を撤去した。Site固有取極めと保存済みCompany値は維持する。配置管理と稼働予定の表示順は、会社管理者または対象fieldの既知role権限を持つ利用者だけが専用Callableで更新できる。Company全体保存をやめ、保存前のlive値非変更、編集中の外部更新停止、自己保存reflection除外、保存中の並べ替え・削除等の無効化、削除済みSite参照の除外、protected 3 fieldのclient直接write拒否を追加した。専用14件、全domain 721件、専用Emulator 106件、security review 4/5が成功した。Codex in-app UI smokeは起動templateから製品画面へ遷移せず対象操作前に停止し、利用者の実際の環境での最終UI acceptance待ちである。Dev・remote/data・deploy・migrationは行っていない。
- 利用者が実際の利用環境でCompany通常設定を確認し、会社管理者の4項目表示と1項目だけの保存、保存中の全入力・操作無効、自己保存時の外部更新警告非表示、真正な外部更新時の再読込、非管理者・super-userの編集拒否を受け入れた。通常設定operationの最終UI acceptanceは完了した。CPU-03は振込先の残る利用者最終確認が未完了のため30%に据え置く。
- Company通常設定の`minuteInterval`、`roundSetting`、`firstDayOfWeek`、`attendanceManagementMode`を、Company全体保存から専用editorと`updateCompanyOperations` Callableへ移した。会社管理者だけが、実際に変えたfieldを最新Companyへ重ねて保存できる。古いCompanyで勤怠方式が欠損・null・空文字でも、他fieldの更新時は検証上だけ暦日基準として扱い、補完writeやdata migrationは行わない。Rulesは4 fieldと将来用canonical fieldのclient直接変更を拒否する。対象19件、全domain 707件、専用Emulator 104件が成功し、Codex in-app UIで15分→20分の保存中に全入力・選択・取消・保存・閉じるが無効となること、完了後の表示反映、自己保存警告なし、15分への復元、console error 0件を確認した。Company documentは分割せず、Dev・remote・実data・deployも変更していない。利用者の実際の利用環境での最終UI acceptanceは未完了である。
- Company基本情報と振込先の保存中に、入力欄・選択欄・削除・取消・保存・最新値の再読込をすべて操作不可にした。処理側でも保存中の再読込を拒否し、会社基本情報も入力検査の開始前から二重送信を拒否する。live listenerが返す自分自身の保存結果は外部更新警告にせず、本当に別画面で変わった場合だけ保存を止めて最新値の再読込を求める。会社情報12件、振込先19件、全domain 688件が成功した。Codex専用UI smokeは起動templateから製品画面へ遷移せずNuxtの`ECONNRESET`で対象操作前に停止したが、利用者が実際の環境で保存中の操作不可と自己保存時の警告非表示を確認し、この補正を受け入れた。
- Company振込先を専用の編集画面と`updateCompanyBilling`へ移した。会社管理者だけが編集でき、銀行名・支店名・口座種別・口座番号・口座名義は5項目を全部登録するか全部削除する。編集中に別画面の更新を検知した場合は保存せず、最新値の再読込を求める。直接書込みをRulesで拒否し、完全で有効な振込先だけを口座名義込みで請求書PDFへ載せる。全domain 676件、専用Emulator 102件、Codex in-app UIで管理者の表示・5項目入力・保存反映を確認した。Dev・remote・実data・deployは変更せず、利用者の実際の利用環境での最終UI acceptanceは未完了である。
- 承認済みcheckpointまたはfeature boundary内ではCodex developerをapplication実装の標準担当とし、Codexが必要なFunctions・Rules、unit・domain・integration・Emulator test、必要なin-app UI smokeまで担当する運用へ変更した。利用者は実際の利用環境で最終UI acceptanceを担当し、未了のUI featureをrelease・roadmap完了としない。file-by-file確認はcheckpointが明示した場合だけとし、push、main merge、deploy、Dev/Prod、remote/data、network、Schemas/Admin SDK等の別承認境界は維持する。
- Company振込先を専用`updateCompanyBilling` Callableへ移す契約を承認した。同社の有効な本登録User readは維持し、変更は非super-user会社管理者だけに限定する。5 field all-null/all-complete、明示clear、最新Companyとの合成validation、changed-only update、client直接write拒否、外部変更時の再読込、完全な口座名義込み帳票をADR 0033へ確定した。
- task交代中を除き、独立して分割できる調査・code探索・review・test・利用者承認済み補助実装等に適切なsubagentを使用するproject-wide運用へ変更した。Checkpoint固有の禁止は当該Checkpointのterminal callbackとcoordinator reviewまでに限定し、後続作業へ持ち越さない。task交代、no-change確認、ownership activation、retarget、replacement taskの最初のfile限定commitはcoordinator自身が実施する。
- 利用者local確認で見つかったCompany基本情報cardのtitle消失と、dialogのtoolbar/actionsまでscrollする構造を修正した。dialogをVuetifyの`scrollable`が想定する`form > card > card-text`構造へ揃え、本文だけをscroll対象にした。編集中の外部更新時は曖昧な「自分の入力を優先する」を削除し、保存を停止して「最新値を読み直す」だけを提供する。
- Company基本情報の編集を`AirItemManager`経由のCompany全体保存から独立editorと`updateCompanyProfile` Callableへ移した。会社名・住所・連絡先・invoice番号のうち利用者が実際に変えたfieldだけを、最新Companyと再検証して保存し、`updatedAt`はserver timestamp、`uid`は実行者を記録する。編集中のlive更新は入力を黙って上書きせず、現在draftを破棄する最新値の再読込を要求する。会社管理者以外の編集controlを隠し、Rulesは対象profile fieldのclient直接変更を拒否する一方、未移行のCompany operationは対象外fieldだけを更新できる。全domain 659件、隔離Emulator 99件が成功し、Dev・remote・実dataは変更していない。
- Firestore CRUDの新規・改修画面では`AirItemManager`・`AirArrayManager`へdraft、dialog、validation、永続化、表示同期を一括委譲せず、operation固有editorとapplication処理へ段階移行する方針を採用した。FireModel/Class schemaをdocument共通validationの正本として維持し、operation contractを加え、最新live documentへ変更fieldを重ねて検証したうえで実際に変わったfieldと更新metadataだけを保存する。編集中のlistener更新はdraftを黙って置換せず通知・再読込・再確認を提供する。最初の対象をCompany基本情報とする独立roadmapを開始した。
- ADR 0031で廃止した旧CCB実装をreview可能な4 commitへ分けてcorrective rollbackした。AirGuardV2のruntime compatible reader、8-target migration planner/Emulator、SettingAudits restore planner、pre-containment Rulesと専用testを除去し、Company Rulesは独立security改善であるclient create/delete拒否とUWB境界を保持した旧CCB直前blobへ戻した。Schemas exact `2.4.2-dev.167`の公開artifactとconsumer pin、Admin SDKのfail-closed guardは独立保持し、packageのunpublish、Dev/remote/data操作、deployは行っていない。既存Rules source contract 2件と隔離Codex Emulator 97件は成功し、利用者saved-data不変を確認した。次は新CCBの最初の実装としてCompany whole-document replacementをoperation別exact field updateへ置換し、その後にSTRIPE-01へ接続する。
- Company Configuration BoundaryをADR 0031でrestartした。一つの業務対象を一つのdocumentに保つこと、operation別exact field update、real-time listener、通常編集のlast-write-winsを既定とし、読取actor・lifecycle・増加量・具体的size・独立query・実測競合で説明できる場合だけ分割する。強い競合制御は権限、停止、削除、金銭、外部作用、複数resource、復旧困難な損失へ限定する。旧8 document、PrivateSettings、SettingAudits、LEGACY/STAGED/ACTIVE互換運用、全設定revision/auditを置換し、旧Company roadmap 10%をhistoricalへ移した。Stripe/subscription/entitlement/employeeLimitは現段階の構造と正式運用範囲から外し、legacy Stripe情報削除をlocal migrationからDev反映・受入れまで完結する0%の独立roadmapとして開始した。application、Rules、package、migration、Dev/Prod、network、remote/dataは本変更では未変更であり、旧CCB成果物はexact rollback inventory後のcorrective commitで整理する。
- ADR 0030のcoordinator handoff効率化をPM-09からPM-10への利用者承認済み交代baselineで発効した。current bounded snapshotを再開正本とし、最小source、compact callback、staged/committed blob一致、重複validator省略を有効化する。direct repository、完全新規task、no-change callback、最初のfile限定commit、former taskの利用者削除境界は維持する。
- 次回の利用者承認済みcoordinator交代で発効するhandoff効率化手順をADR 0030、準備runbook、bounded current snapshotとして追加した。完全新規task、direct repository、no-change callback、権限、最初のreal file-scoped commitを維持し、最小restart source、compact callback、staged/committed blob一致によって全文再読・長文再掲・commit後validator重複を除く。現在のPM-09、active task lifecycle、application、Rules、data、network、deployは変更せず、次回activation baselineまでは未発効である。
- Firestore Rulesの既存許可を狭める改修について、現行Rules下で将来境界へ準拠するClient/Server CRUDを先行し、現行・候補Rules両回帰、既存機能継続、旧writer 0件の確認後にRulesを閉じるproject-wideガバナンスとADR 0029を追加した。新規pathはdocument作成前にdenyを確立する。CCBではAirVuetify3の`updateProperties`がlocal draft更新でFirestore patchではないこと、Company cloneがnon-enumerable runtime stateを失うことを反映した。先行CallableはLEGACYでscope別expected-value付きroot partial update、STAGEDで通常write/signup拒否、ACTIVEでSettings＋必要auditへ切り替え、dual-writeしない。pre-containment Rules候補をdeploy readinessとしない順序へ訂正した。application、Rules、test、deploy、remote/dataは変更していない。
- CCB-02のpre-containment Firestore Rulesをlocal実装し、`Settings`、`PrivateSettings`、`SettingAudits`をgeneric Company fallbackから除外して全client actorの直接read/writeを再帰的に拒否した。legacy Company rootは現行更新を維持しつつ、`status/schemaVersion/configurationState/createdBy/updatedBy`の追加・変更・削除と既存`createdAt`の変更・削除を拒否し、CCB v1 activation済みrootのclient updateを全面停止する。静的契約4件、専用Firestore Emulator 8件、既存Firestore Rules回帰37件で、全CRUD、list/collection-group、nested/orphan、一般User・会社管理者・super-user・他tenant・未認証、legacy patch互換とpartial reserved rootでのwhole-document replacement拒否を確認した。Rules deploy、Dev/Prod、remote/data操作は未実施である。
- Admin SDKのlegacy logical backupへformat v1と`INCOMPLETE` coverage metadataを追加し、16 collectionの固定legacy scope、verified v1での`PrivateSettings: EXCLUDED`、PrivateSettings/SettingAudits restoreとCCB backup/restoreの`UNAVAILABLE`を一覧表示する。旧・欠損・矛盾metadataはPrivateSettings含有を推測せず`UNVERIFIED`とする。local保存は厳密なPID/UUID lock・generation ID・temp publishを使う一覧用`.metadata` sidecarを作成し、途中失敗時はsidecar無しへ倒す。active lockを拒否し、owner死亡済みorphanだけを新規UUIDの隔離pathへ限定回収する。`backup list`はbackup payloadを開かない。scope定数drift、未知coverage claim、CCB collection混入、同時save、不正lock ownerをfail closedで拒否する18件のlocal testを追加した。既存backup payload、実Storage、remote/dataは未読・未変更である。
- CCB-02の`SettingAudits`専用restore契約について、Schemas exact `2.4.2-dev.167`で監査schemaを検査するlocal-only pure plannerと合成fixture・20件のdomain testを追加した。同一project/database/company/schema/document ID、manifest/artifact digest、manifest全IDの同一snapshot present/absent観測、strict Firestore wire形式、raw canonical round-tripを必須とし、既存同値はskip、観測欠落・異値・不正・非canonical・scope不一致は全体write 0、候補操作は`currentDocument.exists=false`付きcreateだけとする。会社ID、audit ID、actor、値はsummaryへ出力しない。artifactの真正性・保存・暗号化/IAM/保持、apply、復旧演習、remote/実data経路は未実装で、operational restoreは利用不可のままである。
- CCB-02のpure migration planner、Firestore REST Valueのtype-tagged canonical digest、合成fixture、34件のdomain回帰testに加え、Codex専用合成Emulatorのtarget guard、公開REST reader、tenant単位create-only transaction、fresh post-checkを追加した。Schemas exact `2.4.2-dev.167`のlegacy mappingを使用し、8 targetのcreate-only、complete exactの再実行、partial・不一致・unknown・invalid・ambiguous・orphan・edition未確認での全体write 0を検証する。digestはmanifestだけでなくproject、database、edition/rules receipt、schema contract、全root/target/audit/unexpected snapshotへ結び、UTF-8 byte順で正規化する。専用Emulatorでは2 tenantのdry-run 16 create、apply、root不変、audit 0、update/delete 0、再dry-run全件equivalent、利用者saved-dataと専用seed不変を確認した。Dev/Prod、利用者用Emulator、資格情報、remote/実data経路は提供しない。
- CCB-02のcanonical parity、PrivateSettings backup、SettingAudits restore境界を承認・文書化した。Company設定stagingは異常1件で全tenant write 0、8 target create-only、partial set自動修復禁止、fresh digest再開とする。PrivateSettingsは既存logical backupから除外してmanaged Firestore backup/PITRを当面の復旧基盤とし、監査履歴は同一company/schema/IDのcreate-only、同値skip、異値拒否、update/delete/clear禁止とする。application、Rules、remote data、operational restoreは未実装である。
- Managed common governanceを1.4.0へ同期し、`容量チェック`等の4表現を現在task IDの永続session JSONL実測へ明示routeした。task handoff 300 MiBとCodex全体10 GiB参考警告、最新session推測禁止、標準出力、scan不完全・0件・複数件・失敗時の停止契約、回帰testを追加した。application、deploy、remote/data操作は変更しない。
- AirGuardV2 appとFunctionsを公開Schemas exact `2.4.2-dev.167`へ揃え、Company compatible readerを追加した。両marker成立前はlegacy rootを維持し、成立後はroot projectionと6 Settingsを厳密検証する。欠損・invalidはmaintenance側へfail closedとし、Active/error時の旧root全体更新をFirestore呼出し前に拒否する。新Settings write、Rules、migration、deploy、remote data操作は未実施である。
- repository projectを持たない`air-guard-v2-admin-sdk`をcoordinatorが直接更新し、Schemasをexact `2.4.2-dev.167`へpinした。CCB root marker、新3 collection、CCB backup payloadを検出した旧backup/snapshot/diff/restore、Company delete、legacy maintenanceをAuth・Firestore・storage write前にfail closedとし、検査不能も停止する。Node 22/24専用17件と既存9件は成功した。PrivateSettings backup、SettingAudits restore、CCB tenant削除・provider maintenanceの本実装、push、deploy、data操作は未実施である。
- Dev既存Userのemail・Employee予約backfillに向けて、予約migrationへ利用者用EmulatorとDevのtarget guardを追加した。Devはservice account identity、Emulator不使用、maintenance・backup確認、dry-run digestを必須とし、missing予約のcreateだけを許可する。既存予約、User、Employee、Authenticationのupdate・deleteは行わない。

### Added

- `AirGuardV2Schemas`のガバナンス内に残った旧7-script診断記述を修正し、新coordinatorで変更なし再開を確認した後、commit `bb23909`をtag `v2.4.2-dev.167`としてTrusted Publishingした。GitHub ActionsのNode 22/24 testとrelease guard、registry metadata、LF clean treeとの84-file byte比較、fresh exact install、CCB 27 export・root非公開・peer importはすべて成功した。Windows事前packとのdigest差はCRLF checkoutとnpm 10、CI公開物はLF checkoutとnpm 11という再現環境差で、source/runtime/API差は0だった。AirGuardV2/Admin SDKへのconsumer導入・deploy・data操作は未実施である。
- 別project `AirGuardV2Schemas`のS3 release readiness commit `78bb1f4`をreview受入れした。package/lockを`2.4.2-dev.167`へ揃え、全10 test fileのfail-closed inventory、tag/version/export/package-content/public-import guard、Node 22/24 test後だけNode 24でTrusted Publishingするworkflowを確認した。coordinator再検証でも`npm test`と`RELEASE_TAG=v2.4.2-dev.167 npm run check:release`は各exit 0だった。`.167`のtag・push・workflow・npm公開・consumer導入・deployは未実施である。
- 別project `AirGuardV2Schemas`のCCB S1/S2をreviewし、pure `./company-configuration`契約commit `ebfc173`とlegacy互換補正commit `53fb53d`を受入れた。空口座の旧`accountType=普通`を全nullへ写す例外と、activation期間の既知legacy framework/computed field 6件をcorrective commitで補い、CCB 11件・既存role preset 6件・public self-importを再確認した。package version、S3 release guard、publish、consumer install、deploy、data migrationは未実施である。
- CCB-02の移行境界として、migration actorを承認済みDev service accountの非email匿名IDへ固定し、既にmaintenance中で旧dataから内部理由・範囲を決定できないtenantは推測せず停止する方針を採用した。Dev 4 tenantは利用者会社1、試用中の別会社1、承認済み合成test 2と確認し、4件すべてを将来のmigration対象に含める。SchemasのS1文書とS2純粋package契約・testのlocal実装を別project taskへ承認したが、version、公開、consumer導入、deploy、data applyは未承認である。
- CCB-02のSchemas契約を別project所有として既存task `PM（Schemas）-02`へ正式移管し、Dev 4 tenantの承認済みread-only用途分類を実施した。識別情報を出力せず、承認済み合成test 2件、要確認2件、manifest digestを記録した。remote write、migration、deployは0であり、残る2件の用途と全4件のmigration対象性は未確定である。
- CCB-02の追加read-only調査として、schemas packageのadditive CCB exportとrelease gate、Admin SDKの新path・backup/restore/delete/maintenance対応、AirGuardV2の値を出さないcanonical parity digestとcreate-only staging契約案を記録した。schemas/Admin SDK変更、package version/tag/push/publish/install、application・Rules・migration実装、Dev remote read/data操作は未実施である。cross-repository local変更、staging actor/maintenance mapping、PrivateSettings backup、audit restore、tenant delete、Dev tenant分類を独立した利用者承認待ちへ分離した。
- CCB-02のrepository静的調査として、Companyのclient・Functions/Admin SDK・Firestore Rules/fixture・関連packageを再照合し、新Settingsを現行generic Rules下で作れないこと、旧whole-document writerが未知server fieldを失うこと、Admin SDK backup catalogとschemas versionの不整合を記録した。推奨するoperation別Callable、exact schema共通規則、create-only backfill、schema activation、compatible rollbackは利用者確認前の候補であり、application・Rules・Dev dataは変更していない。
- CCB（Company Configuration Boundary）の承認済み仕様として、Company rootを最小tenant anchorへ縮小し、profile、billing、operations、arrangement、entitlement、maintenanceを責務別documentへ分割する計画を追加した。actor、validation、revision/audit、issuer・round snapshot、attendanceSummaryMode、ACTIVE/SUSPENDED/CLOSED、Stripe延期をADR 0025と専用roadmapへ記録した。application実装とdata migrationは未実施である。
- maintenanceをCompany固有でなくproject-wideの運用境界とし、通常client/Callable/scheduled・trigger処理の最小gate、bounded quiet period、log、連続dry-run digest、整合snapshot、post-checkを組み合わせるrunbookとADR 0026を追加した。maintenanceは排他lockではなく、product gateは未実装である。
- Company設定のclient、server、Rules/security、下流依存を再調査し、全体保存競合、field ownership、請求・丸め・勤怠・取極め・表示順・maintenance・Stripe・tenant修復を手戻りの少ない順序で改修する専用ロードマップを追加した。
- Dev deployをUWB固有手順から分離したproject共通runbookを追加し、release固定、Firebase CLIとgcloudの独立trust・token refresh確認、fail-fast診断、remote変更前build、release種別ごとのmaintenance・backup・rollback、証拠契約を正本化した。
- Codex専用local UI testをインアプリブラウザの標準経路とし、Emulator ready、Nuxt/Vite warm-up、2巡のbounded module probe後に初回navigationする手順を追加した。cold restart 3回と合成accountのsign-inからdashboard到達を確認し、利用者Chromeは補助経路へ変更した。session喪失時の一時credentialはrunning Auth Emulator内の合成accountだけに限定し、平文観測禁止、即時再mask、saved-data指紋不変、Emulator停止による失効を必須とした。
- Windows PC移行について、repository・Git外local data・Codex portable stateの停止時backup、Windows native/WSL境界、再認証、変更なしrestore checkpoint、旧PC保持条件を含む手順を追加した。
- 利用者用`./saved-data`と通常local環境を変更せず、loopback限定demo project、合成Auth/Firestore seed、読込専用export、容量・指紋ガードを使うCodex専用localテスト基盤を追加した。
- 共通managed governance 1.0.0とAirGuardV2所有の`governance/project-rules.md`を分離し、lock、renderer、managed validator、生成`AGENTS.md`を再構築する方針を追加した。
- 作業目的別の文書案内、正式運用準備ロードマップ、証拠に基づく加重進捗管理を追加した。
- Codexのイベント駆動チェックポイント、300 MiBでのセッション引継ぎ、再起動後のコールバック検証手順を追加した。
- 文書リンク、索引、ADR状態、ロードマップ計算、TOMLを確認するローカルガバナンス検証を追加した。
- ガバナンス設定を再現可能に検証するため、TOMLパーサーを開発依存関係として明示した。
- 配置管理の作業員タグへ、配置人数に含まれない OJT 配置を識別できる表示を追加した。
- 配置管理の日付ヘッダーへ日別の稼働数・配置人数・過不足を、固定フッターへ仮配置・配置済・確認済・上番済・下番済・要確認の件数を表示する機能を追加した。
- 配置管理で従業員の同日の日勤・夜勤、および夜勤から翌日の日勤への連勤を判定し、関係する双方の配置タグへ理由付きの警告アイコンを表示する機能を追加した。
- プロジェクト管理文書一式を追加した。
- 現行仕様の正本、ADR、運用手順、将来タスク用プロンプト、一般技術知識の記録先を追加した。
- 主エージェント、リサーチャー、コーダー、テスターによるマルチエージェント体制を追加した。
- 外部作用を排除したFirebase Emulator環境で、Codexが単体・結合テストを行う手順と制約を追加した。
- `.codex/agents/` に実装、テスト、コード調査、外部文書調査、独立レビュー、UI検証、セキュリティレビューのプロジェクト専用エージェントを追加した。

### Changed

- CCB exact schema v1として、文字数をUnicode Extended Grapheme Cluster単位へ固定し、結合文字で表した`が`も1文字と数えること、`minuteInterval`を5分単位の`5/10/15/20/25/30`だけにすることを承認した。Company root、Settings、PrivateSettings、audit、Callableのfield allowlist、型、長さ、enum、相関、default、maskをADR 0025のnormative schemaとし、仕様・互換性調査・roadmap・確認台帳を整合させた。pre-containmentではlegacy `updatedAt`をcutoverまで許容し、activation期間のrootはreserved field必須かつ既知legacy extras一時許容とする。application・Rules・package・Dev dataは変更していない。
- Firebase CLI再認証後のCCB-02 Dev read-only preflightで、Firestore Standard/Native、Company root 4件の同一shape、schema/activation未設定、旧勤怠enum分布、unknown field 0、CCB target document 0をfield名・型・集計件数・digestだけで確認した。deploy済みFunctions 36件は全ACTIVEでCCB Callableは未deploy、operator toolはschemas `2.4.2-dev.162`と新path未対応のままである。application・Rules・package・Dev dataは変更していない。
- CCB-02の技術契約として、Company設定のprofile、billing、operations、arrangementを専用Callableから更新し、client Settings CUDを拒否する方針を確定した。`schemaVersion=1`と専用activation marker、旧勤怠enum mapping、complete create-only staging、pre-containment Rules、全旧whole-document writer 0件後のactivation、Settings対応releaseへのrollbackを仕様・ADR・roadmapへ反映した。Dev read-only確認はFirebase CLI credential失効でdatabase API到達前に停止し、Firestore document readとdata writeは行っていない。
- Company設定の改修コードを`CCB`へ確定した。`attendanceManagementMode`は将来`attendanceSummaryMode`の`LABOR_STANDARD`/`OPERATION_COUNT`へ置換し、両projectionを常時生成したまま表示・navigationだけを切り替える。Stripe本体とemployeeLimit実強制は全機能改修後の正式release直前へ延期した。
- Company既定取極めとCompany geocodingを廃止対象へ確定した。既存fieldはこの文書変更では削除せず、backup・dry-run・rollbackを固定した別migrationまで保持する。将来のSite既定取極めはCustomer側で設計する。
- Firestore Rulesの段階的縮小として、Company root documentのclient作成・削除を禁止し、初期作成をCloud Functions/Admin SDK専用とした。同一tenantの既存更新は互換性のため維持し、残るwrite境界はCUDを一律Functions化せず機能単位で見直す方針とした。Codex専用Emulator suite 97件で、同社read/update、client create/delete拒否、他社拒否、Functionsによる初期Company作成を確認した。
- UWBの認証済みDev受入れとして、一般Userのrole別menu・管理者route拒否・role未設定への復元、会社管理者用lifecycle履歴のremote空結果、本登録User削除確認の取消とUser残存を確認した。第2のCodex専用合成会社を正規signupし、そのID tokenによるbackend assertionで自社User read 200、別会社pathのread・list・存在必須precondition付きupdate/delete 403、mutation 0を確認した。UWBのDev受入れは完了し、Rules全体縮小、App Check・rate limit、継続監視を正式運用準備の別残件として維持する。
- 専用合成会社の認証済みDev受入れで、管理者・一般Userの正規signup、roleless route拒否、2 tabのstale role拒否、User/Auth無効化・サインイン拒否・再有効化・復帰を確認した。`disableuser`/`enableuser`だけCloud Run public invokerが欠落しbrowser preflightが403となる問題をDev限定の明示承認済みIAM付与で修復し、全v2 Callableのpublic invokerとbrowser-origin CORS preflightをdeploy後に確認するgateを追加した。
- `docs/operations.md`を共通hubへ縮小し、通常開発、local Emulator、local UI、data migration、package release、project coordination、Windows PC migrationをtask-routed runbookへlossless分割した。各旧sectionを一度だけ移動し、Dev deployを含む作業が無関係な運用本文を読み込まない構成へ変更した。
- Dev deploy taskを83KB超の総合operations文書ではなく専用runbookへ直接routeし、確認済みinstalled Firebase CLIをrelease中に固定する方針、Dev Firestore PITR 7日保持、正式運用準備の残件をDev deploy blockerにしない境界へ既存記述を整合した。未検証のWindows CA exportやpersistent gcloud CA設定は標準手順に採用せず、実測済みのprocess-scoped Python truststore経路だけを記録した。
- DEV-UWB-RELEASE-001でSystem maintenance、Firestore PITRと整合snapshot、Rules・全Functions、create-only予約migration、client/Hostingを一体でDevへ導入した。廃止済み`checkEmailAvailabilityGlobal`をremoteから削除し、予約migration後のclean、Functions全件ACTIVE、scheduled reconciler、Hosting配信artifact一致、maintenance解除後のtop・sign-in画面を確認した。認証済み実accountによるrole・tenant・disabled・stale/lifecycle受入れは残作業として分離した。
- 2026年5月から潜在していたPWA `injectManifest`設定とService Workerの不整合を修正し、precachingを無効のまま必須挿入点を維持するsource-contract testを追加した。Dev maintenance releaseは固定commitの静的生成をmaintenance・snapshot・server deployより前のpreflight gateとし、build blockerをremote変更前に検出する。
- Devを正式運用準備の完了前でも積極的にdeploy・検証する非本番試行環境として明確化した。対象commit、service、data影響、backup、rollback、停止条件、受入れを一つのbounded release checkpointで承認し、UWB全体をSystem maintenance、整合snapshot、全server境界、予約migration、client/Hosting、解除の順で導入する再利用可能な手順を追加した。

- UWB-07に残っていたcurrent Auth disabled、仮User連携、同emailの別tenant再登録・Auth-only raceを専用Emulatorの陰性testで固定し、既存のphase failure・reconcile・通知privacy・20/21件cursor paging証拠とChrome履歴空状態を再照合した。実page移動のためだけに21件の退職・削除を作らず、data行・前後pageは自動test、実route・loading・empty・button状態はChromeで分離検証し、UWB-01〜10のlocal完了を確定した。
- UWB-10のlocal確定を、利用者による全file・全行確認ではなく、変更挙動、security境界、独立した自動検証、Chrome受入れ、残存risk、rollbackの確認に基づく受入れへ整理した。
- UWB-10の多重実行対策を認証・認可へ直接影響する操作に限定した。role更新は編集前`expectedRoles`、有効・無効変更は`expectedDisabled`をtransaction内現在値と照合し、対象Userのlifecycle lock中は両操作を拒否する。競合は安全な`aborted`応答とし、全document共通のrevision・lock・operation ledgerは採用せず、通知設定・本人プロフィール・通常CRUD・他collection・Schemas packageへ展開しない。
- UWB-10のlocal Chrome受入れで、非管理者Userの無効化・再有効化、2画面のrole先行保存、古いrole保存の安全な拒否、最終的な有効・role未設定への復元を確認した。
- UWB-09として、公開Schemas `2.4.2-dev.166`のrole preset catalogをルートアプリとCloud Functionsへexact同一artifactで導入し、重複local catalogを削除した。strict client/Functions判定はpackageのprototype-safe membershipを使い、一般clientの直接permission互換とconsumer側write→read規則を維持した。利用者はUser管理とEmployee詳細のrole表示・選択肢、および権限別User管理controlの最小UI smokeを確認した。
- 利用者のログイン済みChromeで、管理者menuからUWB-07の「退職・アカウント削除履歴」へ通常操作で到達し、loading、空状態、無効な前後buttonを確認した。対象環境に履歴dataがないため21件の退職・削除は作らず、data行のexact projectionと前後page移動は自動test・Emulatorで検証した。利用者はUWB-08の`firestore.rules`について、User client write拒否、Employee lifecycle field・delete拒否、lifecycle ledger/event/lock/head直接access拒否を確認し、UWB-08を完了した。
- UWB-07の会社管理者専用履歴readerを、`listLifecycleOperations` Callable、`/settings/lifecycle-history`の専用page、20件固定cursor、全stateの`processing|retrying|completed`表示、exact最小projectionとして実装した。会社はserver identityから導出し、返却直前にcurrent Authとactor Userを再検証する。super-user・manager・human-resource・直接permissionを拒否し、全Timestamp・cursorを厳格検査する。Firestore client直読deny、検索・filter・export・total count・永続cacheなしを維持した。対象70件、全domain 635件、専用Emulator 92件は成功し、追加indexは不要だった。
- UWB-07の`LifecycleOperations`は現段階で固定保存期限を設けず、自動削除しない契約へ確定した。削除を前提とするlegal hold、terminal後UID縮小、purgeは、data量・法令・社内規程・privacy・費用・運用上の必要性から見直しが必要と判断した時点の将来検討へ移した。履歴一覧はFirestore client readを開放せず、有効な本登録会社管理者だけが専用Callableの最小projectionで閲覧する境界を維持する。
- UWB-07の利用者local UI受入れとして、正規UIで作成・本登録したEmployee連携Userを伴う退職、Auth/User物理削除、誤退職訂正、User/Auth非復元、Employee在職復帰と、単独本登録User削除・Employee-only経路を確認した。Employee lifecycle componentを単一element rootへ修正して継承属性warningを除去し、Chrome拡張接続後はデバッグ表示による座標変化を3秒待ってから最新画面で対象を再取得する手順を追加した。serverが拒否するsuper-userについては退職・訂正・単独User削除のclient controlもfail closedで非表示へ揃えた。sign-out listenerは既存の共通認証課題FUT-0005へ分離し、UWB-07はretention contractを未完了として残した。
- UWB-07/08のlocal自動検証readyとして、Employee退職、単独本登録User削除、誤退職訂正、訂正用最小context、5分間隔reconcilerを専用Callable・server-only ledgerへ接続し、reconcilerの`LifecycleOperations.state` collection-group indexを追加した。Employee詳細とUser管理はclient policy・共通operation stateからCallableだけを呼び、旧Employee物理削除UIを除去した。Users client write、Employee lifecycle fieldとdelete、ledger/event/lock/head、legacy `admin_users`をRulesで閉じ、FcmTokens exact create・update拒否、通知送信前のactive User・lifecycle lock再検証、token・payload・email等のlog除去を実装した。全domain単体609件と専用Emulator 88件は成功し、利用者local UI受入れ、Rules確認、履歴reader・保持契約は未完了である。
- WindowsのCodex専用local UI検証では、既知のsandbox read制限によるNuxt起動失敗を繰り返さないよう、Firebase EmulatorとNuxt test serverを最初から承認済みのworkspace sandbox外前景processとして起動する手順へ統一した。demo project、loopback、合成data、外部作用denyの範囲では合成credentialの通常sign-inごとに再承認を求めず、credentialをrepository・応答・logへ残さない。
- UWB-07第3A core checkpointとして、Employee-only退職をoperation・event・一時lock・head・Employee更新とともに単一Firestore transactionで完了し、本登録User連携退職をEmployee予約pointer・一意User・email予約の再検証、Auth disable・identity再照合・物理削除、User・両予約finalize、FCM cleanupへ接続した。仮User、予約欠損なのにUserが残る状態、会社管理者・super-user、不一致Authをoperation開始前に拒否し、cleanup失敗後はcore削除を戻さず同一operationで再開する。Callable、error mapper、public export、Emulator、UWB-07B/C、Rules、UIは未実装である。
- UWB-07第2checkpointとして、server-onlyの`LifecycleOperations`、append-only event、User/Employee lock、Employee lifecycle headのexact schema・path・request fingerprintとFirestore transaction storeを追加した。本登録User削除の共通phase engineはaccess revoke、Auth disable、durable delete intent、Auth再照合・削除、Firestore finalize、FCM cleanupを順に進め、Auth/FCM外部作用をtransaction callback外へ限定する。同じoperationの再開、異なるfingerprint・active lock・phase飛越しの拒否、cleanup完了後だけのlock解放、各phaseとfailure記録自体の失敗注入を単体testで固定した。A/B/C use-case、実Auth/FCM gateway、reconciler、Callable、Rules、UIは未実装である。
- UWB-07第1checkpointとして、`employees:terminate`をclient/serverのstrict `human-resource` role presetへ追加し、managerと直接permission文字列には付与しない境界を実装した。Employee退職、単独本登録User削除、誤退職訂正のexact input、実行者、対象状態を副作用なしで検証するFunctions policyを追加し、会社管理者override、本人退職拒否、単独Userの管理者・super-user・Employee連携拒否、誤退職訂正の会社管理者限定を単体testで固定した。operation基盤、use-case、Callable、Rules、UIは未実装のままである。
- UWB-07をEmployee退職、会社管理者専用の単独本登録User削除、会社管理者専用の誤退職訂正へ再構成した。`employees:terminate`、User archive不採用、操作単位の統合`LifecycleOperations`、本登録Auth削除intent・冪等reconcile、旧User/Auth非復元、current Auth再照合、UWB-08との同一Rules release gateを確定した。仮User連携は既存仮登録削除後のEmployee-only退職へ限定し、作成元を証明できないsignup途中Authをemailから推定削除しない。disabled UserへのFCM通知、token Rules・log、同email signup競合をrelease blockerまたはrepair対象へ加えた。将来日退職と実際の再雇用、legacy退職者repairを分離し、ledger reader・保持期間・legal hold・terminal後識別子縮小の確定までは自動purgeとProd公開を行わない。
- UWB-06として、共通managerの`submit()`へ`isLoading`再入guardを追加し、共通managerを通らないUser有効化・無効化、管理者移譲、本人プロフィール保存をapplication共通operation stateへ接続した。全documentへの汎用single-flightは採用せず、多重実行riskとserver側追加対策の要否をUWB全工程の後段へ移した。全35 routeを共有`accessPolicy` catalogへ移行し、12のpathなしgroupをアクセス可能な子から導出する。routeとnavigationは同じevaluatorを使い、legacy field併記、未知・複製policy、不正なUser管理contextをfail closedとする。User管理は会社管理者または既知preset由来`users:write`へ限定し、super-userには従来の直接route許可と揃えて会社設定menuだけを表示する。全domain単体test 521件、専用Emulator suite 79件、利用者UI受入れが成功し、UWB-06を完了した。
- UWB-05として、本人の`displayName`・`tagSize`、管理対象Userの通知3フラグ、他の非管理者Userのroleを3つの専用Callableへ分離した。各操作はexact field allowlist、型・既知preset、同一tenantの有効な実行者、会社管理者またはstrict preset由来`users:write`をserverで検証し、自己role変更と会社管理者targetを拒否する。User一覧と本人設定からFireModel full document updateを除去し、全domain単体test 490件、専用Emulator suite 79件、利用者によるapplication file・動作受入れを完了した。
- `functions/modules/auth`のpolicy・permission定義を`policies/`、Callable error mapperを`mappers/`へ移し、公開export名と挙動を変えずに責務別の配置へ整理した。利用者のUWB-04確認通過後、全domain単体test 468件と専用Emulator suite 74件で回帰がないことを確認し、UWB-04を完了した。
- managed common governanceを1.3.0へ同期し、必須検証ごとの結果・exit statusを独立して扱い、後続commandの成功で先行失敗を隠さない完了証拠契約を適用した。
- managed governance validatorを必須の明示`-ProjectPath`付き正規commandで実行し、Windows user configstoreを参照するFirebase CLIベースのCodex専用Emulator suiteを既存のdemo隔離・承認境界内で最初からworkspace sandbox外で実行するプロジェクト運用へ変更した。

- User管理permissionを、仮登録Userの作成・削除を行う`users:provision`と、role・通知等を管理する`users:write`へ分離した。managerへ両方、human-resourceへ`users:provision`だけを明示付与し、provision-only actorの作成時rolesは空配列に限定した。非空rolesはclient transport前とCallableのpreflight・transaction内で拒否する。
- AirGuardV2の全Codex taskを利用者repositoryへの直接接続に限定し、Codex専用worktreeの作成・使用を禁止した。task交代時の旧task archiveは利用者だけが行い、Codexは交代検証結果の報告後に待機する運用へ変更した。
- Codex専用demo環境の`.codex-test`配下と通常の専用test sessionにある合成dataについて、作成・変更・削除、予約migration、candidate acceptance・promotionを操作ごとの利用者承認なしに行える境界へ更新した。利用者用`./saved-data`、Dev、Prod、remote service、実data、および上位のCodex・Browser安全確認は対象外のまま維持する。
- UWB-04として、全Userのcanonical email予約とEmployee予約をserver-onlyの一意性正本にし、単独／Employee連携の仮登録作成、仮登録削除、本登録変換、初期会社管理者作成、未認証事前確認を同じtransaction lifecycleへ統一した。User一覧とEmployee詳細の直接Firestore作成を専用Callableへ置換し、会社管理者またはstrict preset由来`users:write`をclient送信直前とserverで検証する。旧`checkEmailAvailabilityGlobal`は製品caller 0を確認してpublic APIから除外した。全domain単体test 462件が成功した。Codex専用Emulator以外を拒否するdry-run既定migration toolを追加したが、saved-data・Dev・Prodへのapplyは未実施である。
- UWB-04のCodex専用受入れとして、予約migration dry-runのclean、専用Emulator suite 74件、単独／Employee連携仮登録Userの正規UI作成・削除を確認した。Employee連携では既知role、User・email予約・Employee予約、Authentication不存在を作成後に確認し、削除後はUser・両予約・Authentication不存在とEmployee残存を確認した。
- 本登録Userの単なる操作権限剥奪は無効化、Employee退職時は旧accountが別tenantでの同じメールアドレスの再利用を妨げないようAuthentication accountとUser documentを物理削除し、EmployeeとのUser紐付けだけを解除する契約をUWB-07として追加した。`Users_archive`、UID参照、削除条件、監査・復旧、部分失敗reconcileは具体例による実装前の確認事項とした。
- UWB-03の仮登録User削除を、製品UIで正規作成した単独UserとEmployee連携Userで再検証し、取消、処理中、成功、競合時の安全な失敗、Authentication不変を確認した。正規管理者signupで作成した合成管理者1件をCodex専用saved-dataへ昇格し、通常再起動とdashboard復帰も確認した。
- CodexのUI受入れでは、架空のテスト値であっても対象業務dataをbackendへ直接注入せず、製品の可視UIと正規application処理経路で作成してから同じUI経路で操作し、backendは結果確認だけに使う契約を追加した。
- Codex専用local UI testについて、保存済み合成Auth accountを起動ごとに再作成せずimportして使う契約、Emulator→Nuxt→インアプリブラウザの起動順序、一回限定reload、dashboard到達、終了時port確認を運用手順へ記録した。Nuxt dev serverは専用dotenvのexact allowlistと外部作用拒否を検証するwrapper経由へ変更した。Browser visibilityは再試験時に有効化できず、background UI成功と利用者目視未達を分離して記録した。
- Firebase CLIをWindowsユーザーのglobal npm領域でlatest運用し、Codex専用Emulator・seed・export scriptから`npx --offline` cache依存を除去した。CLI更新で回帰した場合は直前の確認済みversionへ戻す運用を追加した。
- Codex専用generated UI serverを、専用build commandが記録したdemo project、外部作用拒否、専用dotenv SHA-256、clean source HEADのidentityと現在状態が一致する場合だけ起動するfail-closed方式へ変更した。実buildは引き続き実行ごとの明示承認を必要とする。
- Codex専用UI candidateを、backend verifier合格時のdirectory SHA-256とclean source HEADへ結び付け、専用Emulator・server portがすべて停止し、acceptance receiptが現在状態と一致する場合だけsaved-dataへ昇格できるようにした。
- Codex専用UI backend verifierへ会社名カナの形式・長さ・保存値一致と、claim company ID・Auth UIDの単一Firestore path segment検査およびURL encodeを追加した。
- Codex専用UI backend verifierのtransport契約を、Auth EmulatorへのPOST 1回とFirestore EmulatorへのbodyなしGET 2回へ分離し、それぞれが相手のportへ到達しない単体testを追加した。
- Codexのbrowser UI検証を、可視・有効なcontrolへの実利用者相当のpointer・keyboard操作だけに限定した。`fill`、DOM・event・handler・client APIの直接操作、force・disabled回避を禁止し、read-only観測、非UI setup、backend assertionをUI操作証拠から分離した。旧基準のUI証拠は履歴として保持するが、新基準で再検証する。
- Codex専用local UIの最小経路を実装し、専用Functionsとloopback server、PWA・通知のfail-closed、メール確認済み・company claim付き合成account、Codex管理ブラウザでのdashboard到達、process・runtime cleanupを検証した。Nortonが`IDP.Generic`として検出したPowerShell child helperはrevertし、独立した前景processへ置き換えた。
- Codex専用local testを、専用Emulator、隔離済みFunctions、local server、合成Authentication account・data、Codex管理ブラウザまでCodexが起動・操作・終了し、利用者のChrome起動やsign-inを通常の前提にしない方針へ拡張した。約1000件でEmulatorが停止した利用者経験をlocal riskとして記録し、多数documentは段階投入する。
- ドメイン上の操作可否をclientで事前検証する機能は、UI非依存の純粋policy、これを適用して操作可否・拒否理由・実行処理を提供するapplication composable、結果を表示するcomponentへ責務を分離する共通原則を採用した。client判定はUX補助とし、server最終認可を維持する。
- Userを単独UserとEmployee連携Userへ分類し、会社管理者に依存しない仮登録管理permissionとして`users:write`を採用した。`manager`と`human-resource`へ付与し、単独・Employee連携の作成入口を分離して、本人Employee情報のread境界は別ゲートで扱う方針を確定した。
- 初期会社管理者signup用`checkEmailAvailability`をemailだけのAuth・全User重複事前確認へ変更し、client指定`isAdmin`によるpolicy選択を廃止した。一般User signupは当該Callableを使用せず、事前登録確認とAuth作成時のemail一意性へ責務を分離した。
- 一般Userの未認証事前登録確認をboolean応答だけに縮小し、会社ID・表示名・role・仮User IDの公開を廃止した。複数仮登録は先頭を採用せず拒否し、signup画面も汎用表示へ変更した。
- `auth-v2.js`に残っていた全Callableを`functions/apis`へ分離し、有効化・無効化は共通request処理と2つの公開Callableを1ファイルへ集約した。Authentication削除triggerは`functions/triggers/auth.js`へ移し、公開Function名と既存挙動を維持した。
- signup用`checkEmailAvailability`を`functions/apis`の単体ファイルへ分離し、Cloud Functionsの公開名と既存挙動を維持したままAPI index経由のexportへ整理した。
- 公開Callableの`checkEmailAvailabilityGlobal`、`rebuildAllHistories`、`rebuildSecurityReportIndexes`を`functions/apis`の単体ファイルへ分離し、API indexを公開export一覧へ限定した。再構築で共有する認可処理は内部moduleとして維持し、Cloud Functionsの公開名は変更していない。
- スーパーユーザーの恒久的な全会社Firestore client accessを廃止する方針と、将来は明示的な手続きを経た一時的な他社support accessを提供する未実装構想を記録した。
- application codeの標準実装者を利用者へ変更し、Codexを設計、仕様整理、security・差分review、test計画・許可済み検証、document、local Git管理へ集中させた。Codex developerは明示された補助実装、testerのtest code編集は明示されたtest scopeに限定した。
- 認証・認可・tenant分離の改善を最優先とし、一括置換ではなく、現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを説明できる最小segmentごとに進める運用へ変更した。
- local Emulatorはtest用1社、Devは利用者の会社と協力会社の2社が試用するremote環境として、一般公開の有無にかかわらずtenant境界を必須とする環境条件を記録した。
- `OperationResult.isLocked`を請求確定や全体凍結ではなく管制側編集保護と定義し、`operation-results:write`と`operation-billings:write`の権限境界、理由入力・追加承認・新規履歴collectionを要求しない方針を仕様、ADR、実装調査、マニュアル、ロードマップへ反映した。
- 2026-08-12までの静的source reviewをFUT/CONF、coverage、正式運用準備roadmapへ再照合し、主repoのdeep-reviewed件数を310/531から519/531へ更新してB/Cを0とした。公式進捗は無部分加点規則により10%へ据え置いた。
- 認証・認可、請求・派生同期、共通UI、Admin backup/restoreの問題と要判断事項を、既存canonical groupと新規FUT-0177〜FUT-0183へ整理した。
- AirGuardV2固有の文書・ADR・roadmap・TOML検査を`check-project-docs.ps1`へ改名し、managed validatorと所有・ファイル名を分離した。
- Codexの起動経路を生成`AGENTS.md`、`governance/project-rules.md`、task-routedな`docs/README.md`の順へ変更した。
- 実装・修正・改修を機能単位ブランチで行い、利用者の動作確認と明示承認後にだけマージコミットで `main` へ統合する運用を採用した。
- 関連5リポジトリは事前承認なく読み取り可能とし、各役割と、変更時の影響確認・個別承認境界を明確化した。
- Codex専門タスクは差分と検証を報告し、コーディネーターが受入れたファイルだけをコミット・統合する運用へ明確化した。
- 新しい作業では `docs/README.md` から必要最小限の正本文書を選ぶ読取順序へ更新した。
- 配置管理の作業員タグで OJT 表示を資格者アイコンと作業員名の間へ配置し、表示幅が不足する場合は状態表示を維持したまま作業員名だけを省略表示するよう変更した。
- 配置管理では、配置予定と配置通知が共有する OJT などの業務プロパティについて配置通知を優先し、日別配置人数と現場稼働予定カードの過不足を同じ実効 OJT 状態で判定するよう変更した。
- 配置管理の現行画面責務と作業員タグの表示仕様、および連勤の定義と未決事項を現行仕様へ追記した。
- 配置管理の連勤判定を従業員だけに限定し、表示期間の前後1日を判定用に取得して、連勤関係を構成する双方の配置タグへ警告アイコンと理由ツールチップを表示する仕様を確定した。
- 管制業務マニュアル索引の配置管理リンクを、既存の配置管理説明へ修正した。
- 既存の Codex 作業指示を、承認制の仕様変更フローと文書同期ルールを含む `AGENTS.md` へ統合した。
- `README.md` を Nuxt 初期テンプレートから AirGuardV2 の案内へ更新した。
- 作業指示ごとに文書と実装を照合し、相違は変更前に確認し、実装から判明した未記載仕様を文書へ反映する運用を追加した。
- 影響範囲の大きい隣接リポジトリを、明示的な対象指定と影響確認なしに変更しない規則を追加した。
- 修正済みの `deploy:dev` を開発環境向けデプロイ手順へ反映した。
- CodexのインアプリブラウザからAuth Emulatorへ接続できない現在の制約と、認証済み画面の検証に必要な条件を運用文書へ追加した。
- Chrome拡張による検証では、拡張機能を有効にしたプロファイルでChromeを事前起動する必要があることを明記した。
- Chrome拡張による操作でもAuth Emulatorへの接続が遮断され、サインイン操作を自動化できない現在の制約を運用文書へ反映した。
- Codexの認証後UIテストについて、ユーザーがEmulator、ローカルサーバー、Chrome、サインイン済み画面を準備し、Codexが既存タブを引き継ぐ運用を採用した。
- 既存のリサーチャー・コーダー・テスター体制を、役割と書込み権限を分離した基本5エージェントと任意2エージェントへ具体化した。

### Fixed

- Firebase Emulator切替flagの文字列`"false"`をtruthyとして扱い、Dev clientが誤ってEmulator接続を選ぶ問題を修正した。booleanと文字列の`true`/`false`だけを厳格に解釈し、その他の値は起動時に拒否する。
- 一般User signupの確定buttonが通常のform submitでpage reloadを起こし、account作成を中断する問題を修正した。Employee連携仮登録User作成では、`users:provision`だけを持つactorにgeneric role fieldが残る問題も修正し、human-resource正規UIでemailだけの作成・削除を再受入れした。
- 初期会社管理者のCompany/User作成をメール確認後へ移し、同じbrowserでは確認待ちから再開できるようにした。管理者表示名は値を切り捨てず、6文字超過をfield errorとして表示して作成を抑止する。
- 一般Userのメール確認後画面で認証Callable composableの明示importがなく、クリーンなclientで本登録を開始できない問題を修正した。
- メール確認済みでも会社claim未設定の一般Userをglobal middlewareがdashboardへ早期転送し、本登録Callableを実行できない問題を修正した。
- 管制業務マニュアルの上下番確定処理リンクが存在しない文書を参照していた問題を修正した。
- 上下番確認画面で確定処理中のダイアログが表示されず、処理対象の現場稼働予定を再選択できる問題を修正した。

### Removed

### Security

- 会社所属済みの認証必須Callable向けに、ID tokenと現在のAuthentication UserのUID・email・email確認・company claim・`isSuperUser`・有効状態をAPI固有処理より先に照合する共通identity gateと安全なerror mappingを追加した。`disableUser`、`enableUser`、`changeAdminUser`、`checkEmailAvailabilityGlobal`、再構築2 APIへ適用し、重複した実行者Auth検査を除去した。匿名事前確認と所属確立前bootstrapは専用境界を維持する。
- Authentication Userと会社Userの整合性検査で`isSuperUser`を必須boolean claimとして扱い、欠損・型不正を拒否するようにした。管理SDKの権限解除はclaimを削除せず`false`を保存し、Emulator・Devの全所属アカウントをdry-run、apply、再dry-runの順で検証した。
- 初期会社管理者作成を、メール確認済みで有効な未所属Authに限定した。ID tokenと現在AuthのUID・email・claimを照合し、別の既存User/Company所属を拒否する。claims設定失敗後は同じUIDの整合した初期管理者状態だけを再利用し、Company重複作成を防ぐ。
- 管理者signupの匿名email事前確認で、callerが`isAdmin`を偽装して弱い一般User分岐を選べないようにした。事前確認は認可ではなく、作成との競合、Auth-only部分状態、email列挙、App Check・rate limitは残存riskとして継続する。
- 全会社Userのメールアドレス重複確認Callableを、確認済みメール、正常な会社claim、現在の有効なAuthentication User、同社の有効な本登録会社管理者がすべて整合する場合だけ許可した。`isSuperUser`だけでは許可せず、拒否経路と全会社重複検出を専用loopback Emulatorで検証した。
- スーパーユーザー向けの履歴・警備日報インデックス再構築Callableを、ID token、現在のAuthentication User、同社の有効な本登録User、要求会社がすべて整合する場合だけ許可した。Auth無効・User無効・他社指定を含む拒否経路と両再構築の正常経路を専用loopback Emulatorで検証した。
- StorageのSecurityReportsを、確認済みメール、正常な会社claim、同一tenant path、対応する有効な本登録Userがすべて整合する場合だけ許可するよう変更した。専用loopback Emulatorでupload、list、metadata、download URL、byte download、deleteと不正identity・他tenant拒否を検証した。
- FirestoreのCompanies配下を、確認済みメール、正常な会社claim、同一tenant path、対応する有効な本登録Userがすべて整合する場合だけ許可するよう変更した。恒久的なsuper-user全会社bypassを廃止し、SecurityReportIndexesとStripeDataの個別操作制約を汎用ルールで迂回できないようにした。専用loopback Emulator 32件で検証した。
- 一般User本登録について、確認済みAuthenticationメールに完全一致する一意の仮登録だけを選択し、会社ID・仮User IDをクライアント入力として信頼しないpolicy、use-case、安全なCallable error mappingを既存Callableへ接続した。clientはAuthentication account作成と確認メール送信で一度停止し、メール確認後に更新したID tokenで本登録してからsessionを初期化する。
- Auth accountが有効でも、確認済みメール、正常な会社claim、tenant path、対応する有効な本登録Userの整合が確認できなければFirestore、Storage、Callableを拒否する方針を確定した。この認可整合性は次の最優先改修であり、実装・Rules test完了まで一般User本登録client接続はdeploy不可とする。
- 仮登録UserのFirestore削除では、対応するglobal Authentication Userを削除しないようUser削除triggerを変更した。本登録済み状態を明示的に確認できる場合だけAuth削除へ進む。
- 会社管理者移譲Callableを、認証済みactor自身が同社の唯一の有効な本登録管理者である場合だけ実行できるtransactionへ変更した。移譲元・移譲先のUser/Auth UID・company・登録・管理者・disabled状態を検証し、管理者0人・複数人、別人による移譲、内部識別子を含むerror応答を拒否する。
- User有効化・無効化Callableを、認証済みactorの会社内transactionへ変更した。有効な本登録会社管理者だけが同社別の本登録非管理者Userを操作でき、自己操作、会社・UID・Auth claim不一致、仮登録、管理者targetを更新前に拒否する。
- User更新triggerのAuth同期を独立モジュールへ分離し、Auth更新前にFirestore path・User document・Auth UID・Auth company claimの整合性を検証するよう変更した。会社不一致、claim欠損、UID不一致、登録状態不正ではAuthを更新しない。
- invitation本人確認前のaccount setup、global Auth target、管理Callable、同一tenant Rules、SecurityReport Storage、`admin_users`、FcmToken、Admin operator境界の静的調査結果をsecurity backlogへ反映した。
- 秘密情報、個人情報、本番データ、外部操作に関する文書化・承認境界を明文化した。
