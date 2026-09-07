# Customer Dev反映・受入れ計画

- 状態: Customer今回フェーズ終了。結果・限定修正は[閉鎖記録](../verification/customer-01e-dev-test.md#利用者承認によるフェーズ閉鎖)を参照 / 請求試験は後続フェーズへ移管
- checkpoint: `CUSTOMER-01D-DEV-TEST-001`
- 更新日: 2026-09-03
- 正本: [仕様](../specification.md)、[既存Dev documentの3条件](../project-rules/development-and-data.md#dev試用中の既存document)、[Dev runbook](../runbooks/dev-deployment.md)
- 利用者指示: local準備後にDevテスト開始を承認。利用停止は不要。検証用dataの作成と終了時の削除、利用者指定の既存取引先の編集を承認した。

## 対象と停止位置

今回の範囲は固定commitのDev生成、Rules・Hosting反映、Customerの通常Dev作成・基本情報・支払条件の保存、作成した検証用dataの終了時削除、指定既存取引先の試験変更の復元とする。利用者は試験中に、今回のフェーズをCustomer管理の改修に限定し、請求期日・請求書PDFの受入れは稼働実績管理の改修後の請求書発行機能確認へ移すと指示した。System maintenanceと他利用者の保存停止は行わず、実dataのmigration・一括repairは含めない。

反映案は`air-guard-v2-dev` / Firestore `(default)`の`firestore.rules`とHosting `dist/`。設定根拠は[firebase.json](../../firebase.json)と[Dev runbook](../runbooks/dev-deployment.md)。Functions、Indexes、Storage、Realtime Database、packageの更新は不要である。

local生成物で発見したService WorkerのFirebase設定未注入もHostingへ含める。独立したService Worker buildへ設定変換pluginを渡す修正で、既存の通知処理や権限要求を追加しない。通知送信試験は本計画へ含めない。

比較元は[直前releaseの記録](../verification/stripe-05-dev-release.md)にある`c3b29c59903928159f0d1c6f2ee3852b6ad7b46c`。初回反映前のremote Rulesと本文一致を確認した。Rules差分はCustomerのactor・operation・field境界、delete/archive拒否、fallback除外であり、Dev試験で見つけた座標比較の2行修正も反映済み。ローカルmigration scriptの差分はdeployにも実行にも含めない。revisionと実行結果は[CUSTOMER-01D実行記録](../verification/customer-01d-dev-test.md)を参照する。

## Data impact

次の判断は記録済みreleaseからのlocal差分と関連経路に基づく。現在、data変換を必要とする具体的な根拠は確定していない。既存の[保存形式検査](../verification/customer-01b-dev-compatibility.md)は未修復の証拠として保持し、全件再診断・ID別一覧・予防修復toolは追加しない。

| 条件 | 確認結果と必要な対処 |
|---|---|
| 1. Schemaの明らかな変更 | Schemaとroot/Functionsのpackage・lockは比較元から不変で、field追加・削除・改名・意味変更はない。ただしRulesのlocation形・formattedAddress長・tokenMapサイズ等の保存条件は強化される。実効的な保存条件も確認対象に含め、既存検査でこれらの形式を確認済みとする。該当理由は0だったため、この条件だけを根拠とする変換は計画しない。既存任意文字列の不適合が解消したとは扱わない |
| 2. 他機能への明確な影響 | 該当。Customer更新は関連Siteの`customer`へ同期される。`cutoffDate`は新規Agreementの初期値、`paymentMonth/paymentDate`は新規Billingの支払期日、名称・住所はPDFへ流れる。対象fieldと直接参照経路を確認する。Site同期と新規Agreement初期値は今回確認済み。請求機能全体の受入れは利用者指示で後続の請求書発行フェーズへ移す |
| 3. その他確実に必要 | 該当。既知の形式不適合と変更fieldだけの保存により、未編集fieldが原因の拒否が起こり得る。問題の存在は既存検査で確認済み。通常Dev保存で失敗した場合はそのID・field・操作を確認し、必要な修正を確定する。原因未特定のまま一括補完しない |

下流の根拠は`functions/modules/dependentSync.js`のCustomerからSiteへの同期、`components/Agreements/Manager/index.vue`の新規Agreement初期化、`functions/modules/billings/utils.js`の新規Billing支払期日、`composables/pdf/useBillingPdf.js`のPDF生成。これらのconsumer自体は今回変更していない。参照経路の確認と各機能の受入れを区別し、今回未実施の請求書発行確認を成功と扱わない。

新規Billingの期日だけが初期化され、Customer変更による既存Billing期日の再計算はない。一方、関連Siteの同期はACTIVE限定ではなく、PDFは固定snapshotではない。Dev試験の更新対象を承認するときは、関連Siteへの自動同期と、過去Billingを再表示したときの名称・住所への影響も含める。

通常の更新は変更したoperation fieldと監査metadataだけを保存する。modelが欠損をdefaultで補って表示できても、未編集fieldの補完がFirestoreへ保存されるとは限らない。更新後のdocument全体がRulesを満たさなければ保存が拒否される。実際に失敗したID・field・操作を絞り、通常画面で修正可能か、処理の修正が必要かを判断する。

## 切替と復旧

旧clientは全体保存・client時刻を使うため、新Rulesとの書込み互換性を前提にできない。利用者は停止不要と明示したため、今回はmaintenanceなしでRules、Hostingを続けて反映し、検証Chromeを再読込する。旧tabからの保存拒否があり得ることを残存条件とし、旧Rulesへの自動復帰で権限を再拡大しない。

承認後の順序は次のとおり。

1. 固定source commit、clean、artifact identityを確認し、対象Devの現在のRules/Hosting revisionと復旧候補をread-onlyで照合する。記録済み比較元と違う場合は差分を再評価する。
2. 利用停止・maintenanceなしの今回指示を適用する。data migrationを伴わないため、migration用の全件scan・dry-run・snapshotは追加しない。
3. installed Firebase CLIで`deploy --project air-guard-v2-dev --only firestore:rules --non-interactive`を実行し、Rules反映を確認する。
4. 同じ承認済みartifactを`deploy --project air-guard-v2-dev --only hosting --non-interactive`で反映する。配信revision、index・Service Worker・参照asset、cache headerを確認する。
5. 検証Chromeを新しい画面へ再読込して以下の通常操作と主要拒否経路を確認する。

CLIの存在・version・認証・trust・対象projectの照合と、commandごとのexit status記録はDev runbookに従い実施した。接続・反映結果は実行記録に固定する。

deploy自体は既存Customerを変更しないため、data復元は不要。Hostingだけを旧版へ戻すと旧writerが新Rulesに拒否される。Rulesも旧版へ戻すとCustomerの書込み・削除権限が再拡大するため、自動rollbackせず、停止中の修正releaseを優先する。旧Rulesへの復帰が必要な場合は対象revision・権限再拡大・clientとの整合を明示して承認する。新規test dataや通常操作の結果を推測削除・一括復元しない。

## Devで試す操作

新規Customerは検証用と明示した合成名称を使い、住所検索には個人住所を使わず検証住所（東京都新宿区西新宿2丁目8番1号）を使う。関連確認に必要な合成Site等も今回作成したIDだけを追跡し、終了時に依存関係を確認して削除する。既存取引先は利用者指定対象だけを扱い、原則remarksの可逆編集と復元に限定する。既存取引先・既存関連dataは削除しない。

| 操作 | 期待結果・確認範囲 |
|---|---|
| 新規作成 | 承認された検証用Customerを1件作成し、一覧・詳細へ反映される |
| 基本情報 | 名称・住所・任意fieldを編集して保存し、再表示と検索を確認する。住所検索失敗時も保存を継続する既存仕様を維持 |
| 支払条件 | 締め・支払月・支払日を編集し、保存・再表示を確認する。請求期日の利用経路はcode上で確認し、請求書発行の受入れは後続フェーズとする |
| 関連機能 | 関連Siteへの同期と新規Agreementの初期締め日は確認済み。請求期日・PDFの受入れは利用者指示で稼働実績管理改修後の請求書発行機能確認へ移管。既存Agreementや過去Billingの一括再計算はしない |
| 既存Customer | 実際に編集する対象で保存を試す。不適合が再現した場合だけID・field・修正内容を限定して記録し、その操作を修正する |
| 閲覧専用actor | 一覧・詳細のreadを維持し、作成・編集・delete・archiveの入口を出さない |
| Rules拒否 | 追加検証の承認により、今回の実Dev直接拒否probeは省略する。権限不足update・他社get/listの不足境界はlocalで補い、実Devの直接拒否は未確認として残す。理由と担当は下記参照 |

既存local陰性testの全件をremoteで反復しない。拒否probeは正規tokenと存在必須precondition等を使い、承認されていない実会社・実dataを使わない。旧clientの更新拒否は想定済みの切替条件として扱い、形式不適合による通常保存の失敗とは分ける。

住所入力を伴う作成・編集は、既存Callable経由でGoogle Mapsへの住所送信を行う。次のbounded Dev承認に、この外部住所検索と使用する検証住所を含める。`functions/modules/utils/geocoding.js`は成功時の座標、検索失敗時の住所・応答をFunctions logへ記録するため、raw logを取得・転記せず、必要な状態・件数だけを確認する。

## 追加検証のすり合わせ案

- 状態: 合意範囲の検証終了。後の限定修正と閉鎖は上記実行記録を参照（2026-09-03）
- review checkpoint: `CUSTOMER-01E-TEST-SCOPE-REVIEW-001`

利用者の依頼によりreviewerがCustomerの実装・Rules・既存test・実行記録をread-onlyで評価した。会社管理者の成功済みDev操作を再利用し、追加Dev確認を2種類、localの不足2境界へ絞る案を利用者が承認した。利用者はさらに、PMがDevを、利用者作成の「Local環境テスト」タスクがlocalを担当し、PMが両結果をここへ統合報告するよう指示した。NG事項の修正は実施せず、再現条件・期待値・実測・未実施を記録する。必要なテスト追加は検証準備として許可し、製品code・Rules・設定変更は行わない。

local担当はtask `01a0650c-501d-7bf0-8569-d3a87f798750`、PMはcurrent handoffのcoordinatorとする。双方同じprimary repositoryを使用し、local担当の所有fileは`test/local/codex-local-harness.test.mjs`だけ、PMは計画・実行記録・handoff・索引を管理する。local担当はDev・Chrome・Git変更・追加subagentを使用しない。変更なしcallbackを確認した後に実行割当し、終了後は自分のprocessと試験dataを片付け、結果とexit statusを一度通知して待機する。

| 環境・対象 | 期待結果 | actor・data・準備 |
|---|---|---|
| Dev: 閲覧専用ユーザー | Customer一覧・詳細を閲覧でき、作成・基本情報編集・支払条件編集・削除・archiveの入口が表示されない | 会社管理者ではない、有効・登録完了済みの`accountant`等。通常のサインインと同社の検証用Customerを使う。画面非表示はserver拒否の証拠としない |
| Dev: 編集可能な非管理者 | Customerの備考だけを保存し、再読込後も反映され、元に戻せる | 会社管理者・super userではない、有効・登録完了済みの`manager`。関連Siteを持たない検証用Customerを使い、住所・支払条件は変更しない |
| local: 権限不足の更新拒否 | 正しい形式の既存Customerに対する、閲覧専用actorの更新が拒否される | 隔離Emulatorの合成actor・data。既存testは権限不足actorのcreate拒否が中心で、Customerのupdate拒否を直接補う |
| local: 他社の読取り拒否 | 自社Customerの取得・一覧は成功し、他社Customerの取得・一覧は拒否される | 隔離Emulatorの合成2社・actor・data。未認証や対象不存在による失敗と区別する |

local coverageの根拠は[test/local/codex-local-harness.test.mjs](../../test/local/codex-local-harness.test.mjs)のCustomer専用test。既存113件の成功を、上の2境界を直接確認済みという意味へ拡張しない。

Devの2種類には該当するaccountが必要となる。利用者が用意できる通常ログインを優先し、専用accountの作成・権限設定が必要なら準備範囲をすり合わせる。既存の実利用者の権限を試験の都合で変更しない。試験dataの保持は下記account台帳の利用者指示に従う。過去に削除済みの試験dataは再利用可能とは扱わない。

会社管理者による作成・基本情報・支払条件、指定既存Customerの備考復元、Site同期・Agreement初期値は[CUSTOMER-01D実行記録](../verification/customer-01d-dev-test.md)を再利用する。全role・全不正入力のDev反復、請求書・稼働実績管理の受入れ、既存dataの全件診断は今回の追加案へ含めない。

実Devでの権限不足更新・他社取得/一覧・delete/archiveの直接拒否probeは追加案へ含めず、未確認として残す。reviewした範囲には直ちに使えるCustomer用Dev拒否helperがなく、通常tokenの安全な取得経路や合成会社を含む新しい準備が必要となるためである。localの拒否testと反映済みRulesの本文照合を再利用するが、実Devの直接拒否確認と同一視しない。共通のremote拒否toolが必要かは、後続のマスタ改修で具体的な必要性が生じた際に判断する。

今回の検証作業の終了条件は、選択したDev2種類とlocal2境界についてOK・NG・環境等による未実施を証拠付きで報告し、試験変更の復元・作成dataの削除結果を含めてPMが集約すること。NGを修正して成功するまで続行しない。必要な関連回帰と実Devの直接拒否が未確認であることも記録する。検証作業の終了とCustomer機能の受入れ完了を区別する。Customer後もマスタデータ管理の改修を先行し、次のマスタ・順序・テスト範囲は別途すり合わせる。

## Dev検証用アカウント台帳

2026-09-03の追加指示: 今回使用したアカウントに紐づく会社と、その配下のデータは今後もDev環境のテストに使用するため保持する。テスト用に作成したデータも終了時の自動削除対象にしない。従来の終了時削除指示は、この対象について本指示に置き換える。既に削除したデータを自動で再作成する指示ではない。会社IDはこの指示だけから推定せず、次回操作時に実対象を照合する。

2026-09-03の利用者指示に基づく記録。アカウント作成・権限設定・Chromeでの切替は利用者が行い、作成完了の連絡を受けたら実際のメールアドレスと準備状況を更新する。以下の「存在」は利用者申告であり、今回remoteのUser/Authを再照会して確認したものではない。パスワード・tokenは記録しない。

| 区分 | メールアドレス | 状態・用途 |
|---|---|---|
| 一般ユーザー | `sevenstar.1226+ag2-normal@gmail.com` | 存在は利用者申告。メール表記は利用者が訂正・確定済み。直前の試験では利用者が経理権限を付与したと申告しており、現在の役割を「役割なし」とは扱わない |
| 会社管理者 | `sevenstar.1226+ag2@gmail.com` | 存在は利用者申告。検証用Customerの準備等に使用する既存管理者。super userの有無はこの申告だけでは確定しない |
| 経理専用（`accountant`） | `sevenstar.1226+ag2-accountant@gmail.com` | 利用者からセットアップ完了・切替完了の連絡あり。Dev結果は下記実行記録を参照。Customer一覧/詳細の閲覧と作成/編集入口の非表示を確認する用途 |
| 編集担当専用（`manager`） | `sevenstar.1226+ag2-manager@gmail.com` | 利用者が初回の権限設定漏れを修正し、再確認済み。Dev結果は下記実行記録を参照。Customer備考の保存・再表示・復元を確認する用途 |

専用2アカウントについて、同じ検証対象会社に所属、それぞれ`accountant`のみ・`manager`のみ、会社管理者・super userではなく本登録・メール確認済みの有効状態、という作成条件を依頼し、利用者からセットアップ完了の連絡を受けた。remote設定の独立照合はまだ行っていない。試験対象Customerを両方が同じ会社で参照できるよう準備する。今後の別フェーズで必要な役割は、その時点で追加を依頼する。

利用者は権限別account整備後にDev検証の再開を指示した。停止前は一般accountへの経理権限付与の申告後に一覧到達・作成入口非表示を確認したが、一覧表示0件で詳細閲覧は未確認だった。専用accountによる再開後の結果は[Dev権限別実行記録](../verification/customer-01e-dev-test.md)へ固定し、旧accountの結果で代用しない。NG事項の修正は行わない。

## 残る確認と停止条件

- Devの現在revision、operator権限、切替時の利用者・旧client状態はremote工程で確認する。
- `tokenMap`と位置情報の意味上の正しさをRulesだけでは完全に検証できない。専用writerの派生値生成を維持し、server生成化は[Customer実装の後続課題](customer-master.md#将来要対応)へ残す。
- artifactのsource/config/hash不一致、意図しないservice差分、他社アクセス許可、権限不足actorのwrite成功、対象外data変更、Rules/Hostingの反映失敗時は停止する。
- 終了・再有効化・archive/restore、code一意化、請求snapshot等の後続機能は今回の受入れへ拡張しない。

製品要件・data contract・進捗値は変更しない。今回の反映・保存不具合修正・Dev試験・cleanupは[CUSTOMER-01D実行記録](../verification/customer-01d-dev-test.md)、準備は[local実行証拠](../verification/customer-01c-local-preparation.md)、現在の再開位置は[current handoff](current-coordinator-handoff.md)を参照する。
