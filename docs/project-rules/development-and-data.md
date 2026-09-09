# Development and data rules

- 状態: Active
- 役割: application設計、Firestore、data contract、検証範囲に関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 実装原則

- 利用者が仕様、影響、rollback、検証条件を理解して明示承認したcheckpoint内で実装する。PowerShellとUTF-8を標準とし、既存の設計、命名、責務分割を先に確認する。
- 暫定設定、互換層、workaroundを導入する場合は、原因、対象、正しい恒久境界、撤去条件、撤去phase、検証、rollbackを同じcheckpointで定義する。暫定対策の導入だけを設計完了とせず、原因除去後の撤去までを完了条件へ含める。設計reviewでは目的を満たす経路だけでなく、暫定物が残存して将来の不正な依存や回帰を隠さないことまで確認し、片側だけを満たす実装を承認しない。
- primary Windows worktreeでapplication code、test、project-owned文書を作成・編集するときは、既存fileの文字encoding・BOM有無・改行codeを事前確認して維持する。新規text fileは、対象toolや隣接fileに意図的なLF等の別契約がなければ、UTF-8・BOMなし・CRLFを既定とする。編集後は対象fileがmixed EOLでないことを確認する。Git index内のLF正規化は変更せず、binary、生成物、外部由来file、LFを必要とするscriptへこのworktree既定を一律適用しない。
- testがsource fileをraw textとして読む場合は、改行を比較前に正規化するか構文として解析し、LFまたはCRLF固定の空行・行末へ依存しない。通常の製品処理や構文解析へ不要な改行変換を追加しない。
- Firestore CRUDを新設・改修する場合、`AirItemManager`と`AirArrayManager`を永続化・draft・dialog・validation・表示同期を一体で担う既定componentとして使用しない。既存箇所は一括置換せず、operation固有editor、UI非依存application処理、永続化へ機能単位で移行する。
- マスタdata CRUDの改修対象として合意した到達経路では、専用保存処理を接続した後も`AirItemManager`または`AirArrayManager`をdraft・dialog・validation・完了制御のwrapperとして残さない。既存の見た目を維持するために入力・表示componentを再利用する場合も、汎用Managerへ状態管理や成功判定を戻さない。
- Firestore外のlocal state編集、または既存のwhole-document replacementが対象operationの正しい契約であると確認できる場合は、manager利用の可否を個別に判断する。
- document共通の必須・型・長さ・相関はFireModel/Class schema、operation固有の入力・追加必須条件は共有operation contractを正本とする。最新の購読値へ変更fieldを重ねたcandidateを検証し、実際に変更したoperation所有fieldと監査metadataだけを保存する。
- real-time listenerのlive modelを入力draftとして直接変更しない。独立draftを使い、同じoperation fieldの外部変更時は、再読込または明示再確認後のlast-write-winsのどちらか一つをcontractで定める。
- actor・tenant・field・型・状態をRulesで十分に強制できる単純な可逆更新だけclient部分更新を選べる。複雑なvalidation、server-only情報、厳密なactor、複数resource、外部作用、不可逆性、必須auditがある場合はoperation専用Callableを使う。UI validationだけを保存境界にしない。
- 一つの業務対象は一つのdocumentを既定とする。読取actor、保存・削除・復旧条件、増加量、実測size、独立query、field更新で防げない確認済み競合を説明できる場合だけ分割する。一般的な将来riskだけでlock・ledger・revision・transactionを全documentへ一般化しない。
- 試験運用中の通常の可逆な業務操作では、発生頻度と影響が確認されていない同一document競合、短時間の連続操作、listener到着順を事前に完全制御するための共通pending lock、single-flight queue、順序保証、revision、ledgerを既定にしない。利用者操作を直ちにlocalの表示用状態へ反映し、real-time listenerの正本で収束する単純な方式を優先する。競合、保存拒否、表示訂正が実測され業務影響を確認できた場合に、該当operationだけを段階的に補強する。
- 前項の簡素化は、認証・認可・tenant境界、復旧困難な削除やdata loss、金銭確定、通知等の外部作用、結果不明の再送、複数resourceの不変条件を緩和しない。既存機能により厳格な制御がある場合も、この原則だけを理由に一括撤去せず、その機能を改修対象としたcheckpointで実害と保守負担を比較して段階的に合わせる。
- Rulesを狭める変更は、対象pathと全reader/writer、環境、利用状態、既知data規模、旧client併存、許容停止時間を確認する。正式release前のbounded Dev maintenanceで完結する場合は長期互換層を既定にせず、production等で必要な場合だけ互換releaseを採用する。詳細は[development workflow](../runbooks/development-workflow.md#firestore-rulesを狭める改修順序)とADR 0031を正とする。

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
