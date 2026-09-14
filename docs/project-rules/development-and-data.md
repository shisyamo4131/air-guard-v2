# Development and data rules

- 状態: Active
- 役割: application設計、Firestore、data contract、検証範囲に関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 実装原則

- 利用者が仕様、影響、rollback、検証条件を理解して明示承認したcheckpoint内で実装する。PowerShellとUTF-8を標準とし、既存の設計、命名、責務分割を先に確認する。
- 暫定設定、互換層、workaroundを導入する場合は、原因、対象、正しい恒久境界、撤去条件、撤去phase、検証、rollbackを同じcheckpointで定義する。暫定対策の導入だけを設計完了とせず、原因除去後の撤去までを完了条件へ含める。設計reviewでは目的を満たす経路だけでなく、暫定物が残存して将来の不正な依存や回帰を隠さないことまで確認し、片側だけを満たす実装を承認しない。
- primary Windows worktreeでapplication code、test、project-owned文書を作成・編集するときは、既存fileの文字encoding・BOM有無・改行codeを事前確認して維持する。新規text fileは、対象toolや隣接fileに意図的なLF等の別契約がなければ、UTF-8・BOMなし・CRLFを既定とする。編集後は対象fileがmixed EOLでないことを確認する。Git index内のLF正規化は変更せず、binary、生成物、外部由来file、LFを必要とするscriptへこのworktree既定を一律適用しない。
- testがsource fileをraw textとして読む場合は、改行を比較前に正規化するか構文として解析し、LFまたはCRLF固定の空行・行末へ依存しない。通常の製品処理や構文解析へ不要な改行変換を追加しない。
- Manager構成、入力component、activator・保存経路、dialog幅と例外は[現行仕様のPageとcomponentの構成](../specification.md#pageとcomponentの構成)、document単位の同時更新・保存時検証・listener・例外・Prod公開後の未確定案は[Firestoreドキュメントの同時更新](../specification.md#firestoreドキュメントの同時更新)を詳細の正本とし、実装・review前に対象節を読む。本規則へ詳細仕様を複写しない。
- 未移行の既存Managerは各機能checkpointで仕様の入力契約へ揃え、一括改修しない。仕様が認める例外を使用する場合は、確認済み理由、影響、検証条件を当該checkpointへ示す。
- document構成・機微情報の必須分割と個別分割条件は[現行仕様](../specification.md#firestoreドキュメントの構成)を読む。既存documentに同居する情報を移す場合は、対象data、全reader/writer、互換性、migration、rollback、Rules cutover、Dev受入れを別checkpointで承認・検証する。規則採用だけで自動移行しない。
- 既存のfield限定writer、専用editor、競合拒否、Manager除去をこのruleの採用だけで一括変更しない。[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)の機能順に、通常更新か例外か、document全体のserialization、server管理・派生field、Rules、listener、旧client、rollback、testを確認して段階移行する。
- Rulesを狭める変更は[development workflow](../runbooks/development-workflow.md#firestore-rulesを狭める改修順序)で対象とcutover方式を確定する。

## 通常業務のtenant信頼境界と例外

- 通常業務のactor・tenant境界、Rulesと保存時validationの責務、例外operation、client／Callableの選択は[現行仕様のテナントと認証](../specification.md#テナントと認証)を詳細の正本とする。実装・review前に対象operationを通常業務か例外かへ分類する。
- マスタdataのarchive・復旧・物理削除は、通常CRUDから分離したCallableとserver認可を維持する。transaction dataにはarchive処理を設けず、製品が提供するtransaction documentの物理削除はCallableを使用せず、Domain Manager／FireModel／ClientAdapterのclient削除へ接続する。削除後に必要な関連document・Storage・集計・履歴等との連携はFirestore Triggerが所有し、clientの削除成功をTrigger完了の保証へ読み替えない。既存Callableとclient delete拒否Rulesは、対象transaction checkpointでcaller・Trigger・失敗時運用・rollback・testを確認して段階的に撤去する。
- 既存のrole制限、Callable、Rulesをこのruleの採用だけで一括撤去しない。[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)に従い、Customer、Site、Employee、Outsourcer、その他transaction系の順で、対象operation、例外該当性、reader/writer、data、Rules、rollback、test、Dev受入れを小checkpointごとに確定して段階移行する。

## Component階層、表示data、従属参照

- page/root/childと`useFetch`の構成は[Pageとcomponentの構成](../specification.md#pageとcomponentの構成)、listener・cache・従属CRU・削除時検査・取得失敗表示は[表示dataと従属参照](../specification.md#表示dataと従属参照)を読む。対象画面のdata flowと確認済み例外を[segment contract](../runbooks/development-workflow.md#必要十分なdata設計)へ記録してreviewする。

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
