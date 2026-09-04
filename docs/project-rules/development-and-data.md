# Development and data rules

- 状態: Active
- 役割: application設計、Firestore、data contract、検証範囲に関するAirGuardV2固有規則
- 入口: [project rules index](../../governance/project-rules.md)

## 実装原則

- 利用者が仕様、影響、rollback、検証条件を理解して明示承認したcheckpoint内で実装する。PowerShellとUTF-8を標準とし、既存の設計、命名、責務分割を先に確認する。
- Firestore CRUDを新設・改修する場合、`AirItemManager`と`AirArrayManager`を永続化・draft・dialog・validation・表示同期を一体で担う既定componentとして使用しない。既存箇所は一括置換せず、operation固有editor、UI非依存application処理、永続化へ機能単位で移行する。
- Firestore外のlocal state編集、または既存のwhole-document replacementが対象operationの正しい契約であると確認できる場合は、manager利用の可否を個別に判断する。
- document共通の必須・型・長さ・相関はFireModel/Class schema、operation固有の入力・追加必須条件は共有operation contractを正本とする。最新の購読値へ変更fieldを重ねたcandidateを検証し、実際に変更したoperation所有fieldと監査metadataだけを保存する。
- real-time listenerのlive modelを入力draftとして直接変更しない。独立draftを使い、同じoperation fieldの外部変更時は、再読込または明示再確認後のlast-write-winsのどちらか一つをcontractで定める。
- actor・tenant・field・型・状態をRulesで十分に強制できる単純な可逆更新だけclient部分更新を選べる。複雑なvalidation、server-only情報、厳密なactor、複数resource、外部作用、不可逆性、必須auditがある場合はoperation専用Callableを使う。UI validationだけを保存境界にしない。
- 一つの業務対象は一つのdocumentを既定とする。読取actor、保存・削除・復旧条件、増加量、実測size、独立query、field更新で防げない確認済み競合を説明できる場合だけ分割する。一般的な将来riskだけでlock・ledger・revision・transactionを全documentへ一般化しない。
- Rulesを狭める変更は、対象pathと全reader/writer、環境、利用状態、既知data規模、旧client併存、許容停止時間を確認する。正式release前のbounded Dev maintenanceで完結する場合は長期互換層を既定にせず、production等で必要な場合だけ互換releaseを採用する。詳細は[development workflow](../runbooks/development-workflow.md#firestore-rulesを狭める改修順序)とADR 0031を正とする。

## フェーズごとのテスト範囲の合意

- 着手前に、変更対象、test対象・対象外、操作と期待結果、環境・actor・data、完了条件をcheckpointへ固定する。実装承認から他機能全体の受入れまでを推論しない。
- testは当該phaseの変更と直接必要な回帰へ限定する。関連fieldを読むだけの別機能について、業務全体の受入れを自動追加しない。影響確認と別機能の受入れを区別し、追加が必要なら理由・対象・延期時の影響を提示して合意する。
- 合意済み範囲の再現・修正・再試験は継続し、commandやtest fileごとの再承認を求めない。必須gate、安全境界、既知不具合の修正は省略しない。

## Dev試用中の既存document

- 機能改修では、変更箇所を検証し、承認済みDev releaseの通常作成・編集・保存で得た不具合を対象経路で修正する。未発見不具合をなくす目的だけで全件走査・ID別診断・一括修復・migrationを先行させない。
- 次のいずれかでは影響document・field・機能の状態確認を必須とし、変換が必要ならmigrationも行う。(1) field追加・削除・改名、型・必須・意味・保存構造など実効schemaが変わる。(2) 特定fieldの状態が別機能へ明らかに影響する。(3) 仕様・実装経路・再現結果から確実に必要と判断できる。
- 既存schemaへUI・writer・Rulesを揃えるだけの変更、または既存dataに欠損・桁数超過があることだけを、実効schema変更と自動判定しない。
- 判断は通常の差分と関連reader/writer確認から始め、全件走査を前提にしない。状態確認で変換不要ならmigrationを作らず、通常画面で直せる問題は正規編集で扱う。「念のため」「影響するかもしれない」だけを(3)の根拠にしない。
- 認証・認可・tenant、機密情報、data loss、不可逆な外部作用、Dev release・実data変更の承認は維持する。Prodへ自動適用しない。詳細はADR 0043と各migration/release runbookを正とする。

## 優先順位とroadmap

- 認証・認可・tenant分離の既知Critical問題を優先し、現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを持つ最小segmentへ分ける。
- roadmapは独立して完了できる一つの利用者価値またはdata correctionを単位とし、設計・実装・local検証・必要なmigration・Dev反映・Dev受入れを原則100%とする。未承認・未実施のDev受入れを完了扱いしない。
