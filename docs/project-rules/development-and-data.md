# Development and data rules

- 状態: Active
- 役割: application設計、Firestore、data contract、検証範囲に関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 実装原則

- 利用者が仕様、影響、rollback、検証条件を理解して明示承認したcheckpoint内で実装する。PowerShellとUTF-8を標準とし、既存の設計、命名、責務分割を先に確認する。
- 暫定設定、互換層、workaroundを導入する場合は、原因、対象、正しい恒久境界、撤去条件、撤去phase、検証、rollbackを同じcheckpointで定義する。暫定対策の導入だけを設計完了とせず、原因除去後の撤去までを完了条件へ含める。設計reviewでは目的を満たす経路だけでなく、暫定物が残存して将来の不正な依存や回帰を隠さないことまで確認し、片側だけを満たす実装を承認しない。
- primary Windows worktreeでapplication code、test、project-owned文書を作成・編集するときは、既存fileの文字encoding・BOM有無・改行codeを事前確認して維持する。新規text fileは、対象toolや隣接fileに意図的なLF等の別契約がなければ、UTF-8・BOMなし・CRLFを既定とする。編集後は対象fileがmixed EOLでないことを確認する。Git index内のLF正規化は変更せず、binary、生成物、外部由来file、LFを必要とするscriptへこのworktree既定を一律適用しない。
- testがsource fileをraw textとして読む場合は、改行を比較前に正規化するか構文として解析し、LFまたはCRLF固定の空行・行末へ依存しない。通常の製品処理や構文解析へ不要な改行変換を追加しない。
- Prod公開前のDev試用期間における通常の可逆なFirestore更新は、document単位のlast-write-winsを既定とする。複数actorが同じdocumentを更新した場合、利用者またはclientの時刻ではなく、Firestoreへのcommitが後に成立したoperationの整合済みdocument全体を正とする。異なるtop-level fieldだけを変更した場合も、先にcommitされたdocumentの値を自動mergeしない。Company documentとUser documentは認証・tenant管理の基点であるためこの既定から除外し、利用者が別途変更するまで現行のfield別writer、actor条件、validation、競合制御を維持する。
- `AirItemManager`と`AirArrayManager`は、対象document全体を編集・検証・保存する通常CRUDへ積極的に使用できる。managerを一律に排除せず、既存のinput、dialog、validation、error、loading、表示同期を再利用する。ただし、UI componentだけを認証・認可・tenant・Rules・server validationの境界にせず、例外operationまたはmanagerの契約で表現できない操作へ無理に使用しない。
- document共通の必須・型・長さ・相関はFireModel/Class schema、operation固有の追加条件は必要な場合だけ共有operation contractを正本とする。通常更新では保存対象となるdocument全体を検証し、`updatedAt`・`updatedBy`等のserver管理fieldと当該operationに必要な派生fieldはclient入力を信頼せず正規の保存境界で確定する。
- 更新完了後はFirestore listenerから受信した最新documentを画面上の正本とする。通常更新では同時更新を理由に保存を拒否せず、競合通知、draft破棄、最新値の再読込、明示再確認を要求しない。保存自体の失敗、認可拒否、validation拒否、結果不明は同時更新による正常な上書きと区別して扱う。
- Prod公開後にtop-level field単位のlast-write-winsへ変更する案は未確定とし、Prod公開だけで自動適用しない。別の仕様変更で採用した場合は、editorとwriterが利用者の変更したtop-level fieldだけを送信し、変更していないfieldを保存対象に含めない。server管理fieldと必要な派生fieldは追加更新できる。異なるtop-level fieldのcommitは併存し、同じfieldは後commitのfield全体を正とする。arrayとmapは内容全体を一つのtop-level fieldとして扱い、要素またはkey単位ではmergeしない。
- actor・tenant・field・型・状態をRulesで十分に強制できる単純な可逆更新だけclient部分更新を選べる。複雑なvalidation、server-only情報、厳密なactor、複数resource、外部作用、不可逆性、必須auditがある場合はoperation専用Callableを使う。UI validationだけを保存境界にしない。
- 一つの管理対象について、通常の業務情報は意味のある一まとまりを一つのdocumentにすることを既定とする。ただし、従業員のマイナンバー、取引先・自社の口座情報、CompanyのStripe契約情報等の機微な個人情報・機密情報は、通常の本体documentから別documentへ分割する。この例示に含まれない情報も、漏えい時の影響、必要なread/write actor、保持・削除条件、外部provider ownershipから同等と判断できる場合は同じ境界を適用する。
- 機微・機密性による必須分割とは別に、Firestore Rulesの式数・重複・例外を減らして認可を明確にできる、保存・削除・復旧条件が異なる、継続的に増加する、現実的なdocument size超過経路がある、独立queryが必要、またはfield限定updateで防げない確認済み競合がある場合はdocument分割を個別に検討する。分割案はRules、reader/writer、整合性、query/index、migration、運用・保守負担を比較し、総開発・保守コストを抑えられることを示す。一般的な将来riskやUI・writerの責務名だけでは分割しない。
- 新しい機微・機密情報は分割先のpath、schema、actor、Rules、server処理、保持・削除、log・export・snapshot、testを確定し、本体へ保存しない。既存documentに同居する情報は未解消の実装差として扱い、対象data、全reader/writer、互換性、migration、rollback、Rules cutover、Dev受入れを別checkpointで承認・検証してから移す。このproject ruleの採用だけで既存dataを自動移行しない。
- 通常の可逆な業務操作では、同時更新を防ぐためのexpected value、revision、transaction、lock、ledger、競合拒否を既定にしない。短時間の連続操作、listener到着順、二重送信による外部作用等は同じ問題とみなさず、保存中UIやerror処理は対象operationの実害に応じて定める。
- Stripe、請求確定、archive・復旧・物理削除、順序が重要な状態遷移にはdocument単位last-write-winsを適用せず、それぞれのoperation固有のtransaction、precondition、idempotency、再試行・照合、監査を維持または別途定める。Authentication、Company、User、role、permission、tenant所属、機微・機密情報、通知等の既存high-risk operationも、確認済みの固有競合制御をこの原則だけで撤去しない。
- 既存のfield限定writer、専用editor、競合拒否、Manager除去をこのruleの採用だけで一括変更しない。[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)の機能順に、通常更新か例外か、document全体のserialization、server管理・派生field、Rules、listener、旧client、rollback、testを確認して段階移行する。
- Rulesを狭める変更は、対象pathと全reader/writer、環境、利用状態、既知data規模、旧client併存、許容停止時間を確認する。正式release前のbounded Dev maintenanceで完結する場合は長期互換層を既定にせず、production等で必要な場合だけ互換releaseを採用する。詳細は[development workflow](../runbooks/development-workflow.md#firestore-rulesを狭める改修順序)とADR 0031を正とする。

## 通常業務のtenant信頼境界と例外

- roleによる通常業務上の差異は、原則として画面、navigation、案内、初期表示等のUXに限定する。同一tenantに所属する有効な認証済み本登録Userは、tenant内の通常業務dataについて同じserver権限でread・create・updateその他の提供済み通常操作を行えるものとして信頼する。通常業務のRules・Callableでrole名、role preset、permission文字列、会社管理者・super-user等の区分をallow条件にしない。
- 通常業務dataのFirestore Rulesは、少なくともAuthentication、確認済みemail、User documentの存在とUID一致、本登録、非disabled、正常なtenant claim、User所属tenantとpath tenantの一致を検証する。strict field allowlist、型・長さ・必須、tenant・document identity等の不変field、同一tenant参照、許可された状態遷移、上限、masterのclient物理delete拒否等、対象operationに必要なdata破壊防止条件はrole廃止後も維持する。client UXだけをこれらの代替にしない。
- 次は通常業務のtenant信頼境界の例外とし、role、permission、actor、target、最新状態等の必要なserver側認可を適用し、必要に応じて専用Callableを使用する。(1) Firebase Authentication account、Company document、User document、role、permission、tenant所属の作成・変更・削除その他の現行提供操作、(2) マイナンバー、口座情報等の機微な個人情報・機密情報、(3) archive、復旧、master dataの物理削除、(4) Stripeによる契約、課金、決済、返金。CompanyとUserは認証・tenant管理の基点としてdocument全体を例外にし、現行の厳密なactor・field・validation・競合制御を維持する。機微情報を別documentへ分割する規則は取り消さない。例外のclient表示・disabled・route制御はUXであり、認可境界にしない。
- 通常業務でも、複数documentのatomicity、server timestamp・秘密値、信頼できる派生値、外部作用、冪等性、再開・reconcile等の技術要件によりCallableを使用できる。ただし、その技術要件だけから通常業務へrole制限を戻さない。Rulesでtenant境界とdata不変条件を十分に強制できる単純な操作はclient実装を選択できる。
- 既存のrole制限、Callable、Rulesをこのruleの採用だけで一括撤去しない。[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)に従い、Customer、Site、Employee、Outsourcer、その他transaction系の順で、対象operation、例外該当性、reader/writer、data、Rules、rollback、test、Dev受入れを小checkpointごとに確定して段階移行する。

## Component階層、表示data、従属参照

- 認証済み業務pageは、原則として画面全体を制御する一つのroot componentを直接配置し、そのroot componentが一つ以上の機能単位の子componentを構成する。pageはroute parameter、page metadata、layout、画面rootの接続へ責務を絞り、業務機能をpageへ集積しない。単純な認証・案内・error page等でこの階層が価値を持たない場合は、機能checkpointで例外理由を示せる。
- 従属先document IDから名称等を解決する場合は、`composables/fetch/useFetch.js`を共通入口として使用する。pageで`useFetch(componentName, true)`を一度呼び、画面配下専用のfetch composable群をprovideする。子側は`useFetch(componentName)`を呼んでinjectされた同じinstanceとcacheを使用する。子側のfallback生成は独立利用の互換経路であり、通常page階層がoriginの設置忘れに依存しない。
- 画面の主対象として表示する変更可能なFirestore documentはreal-time listenerから受信した現在値を正本とする。one-shot readまたは保存済みsnapshotは、確定済み履歴、帳票、operation検証等の変更追随が不要な目的へ限定し、変更可能な主対象documentの現在値表示を固定し続ける正本にしない。ただし、IDから名称等を補完する従属先情報は`useFetch`の共有cacheを優先でき、同じ画面表示中の全従属先情報へreal-time listener追随を必須にしない。認証・tenant scope変更時のcache分離・破棄は維持する。
- 従属documentのcreate・read・updateでは、従属先documentの存在確認を既定にしない。候補UIから不存在IDを除外することはできるが、認可または参照整合性の保証とは扱わない。金銭確定、identity、archive・復旧、順序依存状態等で既にoperation固有のより厳格な不変条件がある場合は、その確認済み例外を明示して維持できる。
- 従属先documentの物理削除では、削除operationの時点で既知の従属documentを確認し、一件でも存在する、検査に失敗する、または対象が不整合なら削除を中断する。従属側CRUとのlock、tombstone、transactional barrierは既定にせず、検査の直前または同時に従属documentが生じるraceまで保証しない。この残存riskを、強い整合性を保証したとの表示・監査記録へ読み替えない。
- 従属先が不存在または取得不能の場合、画面全体をerrorにせず、本来表示する名称等の箇所を「取得できなかった」旨の表示へ置き換える。別documentの名称を推測せず、取得失敗と値が空である正常状態を区別する。内部error、ID、個人情報を利用者向け表示へ含めない。

## フェーズごとのテスト範囲の合意

- 着手前に、変更対象、test対象・対象外、操作と期待結果、環境・actor・data、完了条件をcheckpointへ固定する。実装承認から他機能全体の受入れまでを推論しない。
- 試験運用中の通常の製品改修は、`直接対象の自動検証 → 必要な場合だけ選択したpre-Dev環境検証 → 固定commitのDev反映・対象範囲のDev受入れ`を標準順序とする。Codex専用Localと利用者環境Localは手戻り抑制のための任意工程であり、[Environment and approval rules](environment-and-approval.md#local-emulatorとlocal-ui)の保証範囲から今回必要な証明事項を直接覆う最小集合を選ぶ。自動検証が十分なら両Localを省略でき、Localを先に完了することをDev release判断の一律条件にしない。製品挙動を変える変更はDev受入れ前に完了扱いせず、文書・governance・testだけの変更やCodex専用local toolだけの変更はDev対象外とする。project rule・verification policy自体の変更、Rules・schema・Functions・認証認可その他の高risk境界、verification policyが別classで要求する必須gate、および承認済みreleaseに必要なgateは先送り・省略しない。改修規模が大きく最小loopを安全に適用できない場合は、範囲と検証方法を別途合意する。
- testは当該phaseの変更と直接必要な回帰へ限定する。関連fieldを読むだけの別機能について、業務全体の受入れを自動追加しない。影響確認と別機能の受入れを区別し、追加が必要なら理由・対象・延期時の影響を提示して合意する。
- 合意済み範囲の再現・修正・再試験は継続し、commandやtest fileごとの再承認を求めない。発見した不足・不具合の修正義務を現在phaseへの追加権限とみなさず、対応時期の延期と修正の省略を区別する。
- 現在の目的を妨げない独立問題だけを後続へ送る。今回の変更による回帰、承認済み必須条件の未達、安全な作業継続を妨げる問題は未完として扱い、必要なら影響作業を停止する。初期調査・設計の見落としを追加要求へすり替えず、条件補正と影響を利用者へ説明する。必須gateと安全境界は省略しない。
- 改修開始時に、追加問題の修正phaseと設計・review時点をroadmapへ置く。対象追加・前倒しは当初目的との関係、追加負担、延期時の影響を提示して合意する。発見時の記録と修正phaseの実行順は[開発workflow](../runbooks/development-workflow.md#試行段階の高速な開発loop)を正とする。

## Dev試用中の既存document

- 機能改修では、変更箇所を検証し、承認済みDev releaseの通常作成・編集・保存で得た不具合を対象経路で修正する。未発見不具合をなくす目的だけで全件走査・ID別診断・一括修復・migrationを先行させない。
- 次のいずれかでは影響document・field・機能の状態確認を必須とし、変換が必要ならmigrationも行う。(1) field追加・削除・改名、型・必須・意味・保存構造など実効schemaが変わる。(2) 特定fieldの状態が別機能へ明らかに影響する。(3) 仕様・実装経路・再現結果から確実に必要と判断できる。
- 既存schemaへUI・writer・Rulesを揃えるだけの変更、または既存dataに欠損・桁数超過があることだけを、実効schema変更と自動判定しない。
- 判断は通常の差分と関連reader/writer確認から始め、全件走査を前提にしない。状態確認で変換不要ならmigrationを作らず、通常画面で直せる問題は正規編集で扱う。「念のため」「影響するかもしれない」だけを(3)の根拠にしない。
- 認証・認可・tenant、機密情報、data loss、不可逆な外部作用、Dev release・実data変更の承認は維持する。Prodへ自動適用しない。詳細はADR 0043と各migration/release runbookを正とする。

## 優先順位とroadmap

- 認証・認可・tenant分離の既知Critical問題を優先し、現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを持つ最小segmentへ分ける。
- roadmapは独立して完了できる一つの利用者価値またはdata correctionを単位とし、設計・実装・選択したpre-Dev検証・必要なmigration・Dev反映・Dev受入れを原則100%とする。選択理由により省略したLocalは未完了項目に数えず、未承認・未実施のDev受入れを製品変更の完了扱いにしない。
