# 0047 専門subagentの原則利用・並列実行とcoordinator直轄操作

- 日付: 2026-09-04
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0005 マルチエージェント体制](0005-multi-agent-and-emulator-testing.md)、[0032 専門subagent routing](0032-required-specialist-subagent-routing.md)、[0042 risk-based local UI受入れ](0042-risk-based-local-ui-acceptance.md)、[0045 Governance 3と通常startup](0045-governance-3-normal-startup.md)

## 背景と変更前

現行ruleは、独立した非重複scopeと専門結果が必要な場合のsubagent利用、application writerの`developer`集中、coordinatorによる結果統合を定めていた。一方、相互に依存しない複数workstreamを原則並列にする条件、coordinatorが報告統合を主務としつつ自ら確認する最終責任、利用者Chrome等の外部操作をcoordinator直轄にする境界は明示されていなかった。`ui_tester`設定はCodex専用local UIに加えて利用者準備済みChromeも委譲対象としており、利用者が承認した直轄方針と一致しなかった。

## 決定

- 利用者向けprimary taskをcoordinatorとし、別のcoordinator subagentを作らない。
- task交代作成を除き、設計・調査・code探索・review・development・testに実作業があり、独立した非重複scopeと専門結果が必要な場合、原則として該当subagentへ委譲する。単一の小作業を形式的に分割せず、不要なroleを起動しない。
- 同一checkpoint内で相互に依存しない複数workstreamは、同じ確認済みbaseline、重複しないownership、個別のcompletion contract・callback先、利用可能な実行枠を固定し、原則として同時に割り当てる。依存関係、ownership重複、承認境界、利用可能枠不足がある場合は直列化し、全結果を統合する前に次checkpointへ進まない。
- coordinatorは専門taskの報告を収集・照合し、矛盾を解消して差分、検証、正本文書、利用者報告へ統合することを主務とする。critical identifier、approval・scope、最終diff・worktree、必須検証のexit status、Git統合、completion claimはcoordinator自身が確認する。
- 利用者のChrome・profile・session、desktop app、Dev・Prod・remote UI、外部account・session・stateを扱う操作は、必要な承認後もcoordinatorが直接行い、subagentへ委譲しない。
- Codex専用demo project、loopback、合成data、in-app browserに限定したlocal UIは外部操作に含めず、`ui_tester`へ委譲できる。公式情報のread-only Web調査と承認済みlocal CLI・Emulator検証もcoordinator直轄操作には含めない。
- この担当規則はnetwork、外部write、remote/data、deploy、実account、外部serviceへの新しい権限を付与しない。既存の承認、安全、role別write、callback、Git統合境界を維持する。

## 理由

独立した専門作業を並列化して待ち時間を減らしながら、ownershipとcallbackを固定して重複調査・競合書込みを防ぐためである。coordinatorが報告の統合と最終確認を担うことで、委譲結果を未確認のまま仕様、Git、完了判断へ昇格させない。利用者またはremote環境のUI・sessionを扱う操作をprimary taskへ集約し、外部状態に対する責任と承認経路を一つに保つ。

## 代替案

- すべてをcoordinatorが直列実行する案: 独立reviewと並列作業の利点が得られないため採用しない。
- すべての作業で複数subagentを必須にする案: 小作業の形式分割と不要な調整を生むため採用しない。
- 利用者Chromeやremote UIも`ui_tester`へ委譲する案: 外部account・session・stateの責任経路が分散するため採用しない。
- Codex専用local UIもcoordinatorだけが行う案: demo project、loopback、合成data、in-app browserへ隔離した既存のread-only専門roleを活用できないため採用しない。

## 影響と互換性

- 利用者: 通常の依頼方法は変わらず、独立作業は必要に応じて並列化され、統合結果をcoordinatorが報告する。
- role: `ui_tester`はCodex専用local UIだけを担当し、利用者Chrome等はapproval-boundaryとしてcoordinatorへ返す。他のroleとapplication writer集中は維持する。
- 実装・data: application、Functions、Firebase Rules、data schema、migration、Dev・Prod・remote状態を変更しない。
- security・外部作用: 既存のnetwork、外部write、remote/data、deploy、実account・外部service承認を維持する。担当変更を操作許可として扱わない。
- task lifecycle・Git: no-change callback、一度だけのterminal callback、coordinator-owned Git統合、通常startupを維持する。governance変更だけでtask交代を強制しない。

## 移行

project rules、現行仕様の開発ガバナンス、project coordination・development・local UI runbook、`ui_tester`設定、文書索引、CHANGELOGを一つの変更として同期する。既存の利用者Chromeによる受入れ記録は当時の実行事実として保持し、将来の担当だけをcoordinator直轄へ変更する。

## Rollback

問題時は新規の外部UI操作を停止し、coordinator直轄をfail-closedの安全な既定として維持する。history rewriteは行わず、本変更のowned filesだけをcorrective commitで修正する。利用者Chrome等をsubagentへ委譲できる旧routingへの復帰はmaterial changeとして、影響、承認境界、検証を提示し、利用者の別の明示承認を得た場合だけ行う。製品code、data、environmentのrollbackやmigrationは不要であり、既存の承認・外部作用境界を緩和しない。

## 検証

- project rules、仕様、runbook、`ui_tester`設定で、subagentの原則利用、独立workstreamの並列条件、coordinatorの統合・本人確認責務が一致すること。
- 利用者Chrome等の外部操作がcoordinator直轄で、Codex専用loopback local UIだけが`ui_tester`委譲可能であること。
- 担当規則からnetwork、外部write、remote/data、deploy権限を推論できないこと。
- project documentation checkerが`ui_tester`のoperative instructionにあるASCII marker `UI_SCOPE_POLICY`、`EXTERNAL_UI_POLICY`、`EXTERNAL_UI_RETURN`を使い、Codex専用local allowlist、利用者Chrome・profile・session、desktop app、Dev・Prod・remote UI、外部account・session・stateの操作禁止、coordinatorへのapproval-boundary返却を検査すること。
- 有効なTOMLのまま`EXTERNAL_UI_POLICY`をcoordinator-only/subagent-denyからdelegated/subagent-allowへ変異させたnegative fixtureをproject documentation checkerが拒否すること。これは`ui_tester`の外部UI denyを担保するfixtureであり、他role、外部service実挙動、browser tool自体の権限までは検証しない。
- project documentation、TOML、managed governance、negative fixture、task容量回帰、差分形式のcomprehensive completion gatesが成功すること。

## 再検討条件

Codexのsubagent・concurrency・callback・browser ownershipの仕組みが変わった場合、並列化が依存順序やownership競合を反復して生む場合、または外部UI操作を安全に分離できる新しい承認・監査経路が確立した場合。
