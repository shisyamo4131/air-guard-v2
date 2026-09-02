# 0034 承認済み境界でのCodex実装と利用者最終UI受入れ

- 日付: 2026-08-30
- 状態: Accepted
- 一部置換: local UI受入れの一律必須部分は[0042](0042-risk-based-local-ui-acceptance.md)を現在の判断とする。その他の承認済み実装境界と役割分担は継続する。
- 関連仕様: 開発ガバナンスと進捗管理、仕様変更規則
- 関連判断: [0007](0007-project-scoped-specialist-agents.md)、[0015](0015-user-led-implementation-and-codex-assurance.md)、[0021](0021-codex-in-app-browser-ui-testing.md)、[0032](0032-required-specialist-subagent-routing.md)
- 一部置換: [0015](0015-user-led-implementation-and-codex-assurance.md)の標準実装者、利用者実装後のreview順序、file-by-file確認の既定。小segment、rollback、read-only role、外部作用の別承認は継承する。

## 背景

ADR 0015は2026-08-14にapplication codeの標準実装者を利用者へ変更した。既存設計からの乖離と長時間の統合失敗を避けるための安全な反転だったが、その後のUser Write Boundaryでは、利用者が仕様とsegmentを承認し、Codexがapplication、Functions、Rules、test、Emulator、Codex専用UI smokeを実装・検証し、利用者が実際の画面を最終確認する運用が繰り返し成立した。

一方、現役文書は利用者実装を既定としたままで、Codex実装をcheckpoint固有の補助実装として扱っている。UWB固有の1 fileずつの確認規則も標準運用と混同され得る。実績に合う責任分担へ統一しつつ、承認済み境界を越える無制限な自律変更、外部作用、利用者による最終UI受入れの省略を防ぐ必要がある。

## 決定

- 利用者が仕様、影響、rollback、検証条件を理解して明示承認したcheckpointまたはfeature boundary内では、Codexの`developer`をapplication実装の標準担当とする。承認は隣接機能、未承認仕様、別repository、外部作用へ拡張しない。
- application code、必要なFunctions・Firebase Rules・関連設定の書込みは`developer`へ集中する。coordinatorは変更契約、checkpoint分割、agent routing、diff review、document、roadmap、ADR、local Git統合、完了判定を担当する。
- `tester`はcoordinatorが明示した承認済みtest scopeでunit・domain・integration・Rules・Emulator等のtest fileを編集・実行できる。個々のtest fileごとの利用者承認は要求せず、application codeは変更しない。
- explorer、researcher、reviewer、security reviewer、UI testerはread-onlyを維持する。必要な独立scopeではADR 0032に従い適切なroleを使用する。task turnover中はsubagentを使用しない。
- UIまたは利用者操作へ影響するfeatureは、Codexの自動検証と必要なCodex専用in-app UI smokeが成功した時点を「実装・自動検証完了／利用者受入れ待ち」とする。利用者が別途承認された実際の利用環境で最終UI acceptanceを行うまで、featureの最終受入れ、release完了、roadmap完了とは扱わない。
- application implementation fileを利用者が1 fileずつ確認する手順は、checkpointが明示した場合だけ適用する。通常は承認済みsegment内でCodexが連続実装・検証し、segment単位で変更挙動、security境界、test結果、残存risk、rollback、利用者確認項目を提示する。
- push、`main` merge、deploy、Dev・Prod、remote/data、network、Schemas・Admin SDK・関連repository、package公開、migration、外部service変更は既存の別承認境界を維持する。承認済みapplication checkpointから推論して許可しない。

## 理由

承認済みsegmentの実装と自動検証をCodexへ一貫して持たせることで、設計、実装、陰性test、独立review、文書同期の責任経路を明確にできる。利用者はfile-by-file handoffではなく、実際の利用環境における操作感、表示、業務適合性の最終判断へ集中できる。

承認済みboundary、developerへの書込み集中、tester・reviewerの分離、coordinator-owned Git、利用者最終UI acceptanceを組み合わせることで、ADR 0015が避けた無限定な大量実装と自己完結の誤った完了主張を防ぐ。

## 代替案

- 利用者を標準実装者のまま維持する案: 現在の実績と希望する責任分担に一致せず、各checkpointで補助実装承認を繰り返すため採用しない。
- Codexへrepository全体の自律変更を許可する案: 仕様、scope、外部作用、rollbackの承認境界を失うため採用しない。
- Codex UI smokeだけで最終受入れとする案: 実際の利用環境、業務上の操作感、表示差、利用者判断を代替できないため採用しない。
- 全fileを常に利用者が確認する案: UWB-10でsegment単位の受入れが成立した実績があり、標準化すると作業を不必要に直列化するため採用しない。

## 影響

- 利用者: checkpointの仕様・影響・rollback・検証条件を承認し、UIへ影響するfeatureは実際の利用環境で最終UI acceptanceを行う。通常はapplication fileを1件ずつ確認しない。
- Codex: 承認済み境界内のapplication、Functions、Rules、自動test、必要なin-app UI smokeを担当し、利用者受入れ前を最終完了と報告しない。
- task: standard implementer、developer/tester/UI tester、coordinator責任を変えるinstruction-chain変更である。反映・検証・commit後、affected active taskを完全新規taskへ交代する。
- product/data: 本判断自体はapplication、Rules、Firebase設定、package、Dev/Prod、remote/dataを変更しない。既存の承認済みproduct contractと進捗を維持する。
- progress: governance変更だけではproduct roadmapを加点しない。

## 移行

project rules、仕様、開発・coordination・UI runbook、開始prompt、developer・tester・UI tester定義、ADR 0015・0032、document map、current snapshot、関連roadmap、changelogを同期する。project rulesから生成`AGENTS.md`を再作成し、project documentation validator、managed governance validator、renderer `-Check`、rule inventory、`git diff --check`を独立して実行する。application testとUI smokeはgovernance-only変更では実行しない。

検証済みcommit後、利用者承認済みturnoverとしてPM（AirGuardV2）-12をforkせず完全新規taskで作成する。direct repository、governance、permissions、no-change callback、最初のfile限定activation commit、callback/assignment retargetを確認できるまでPM-11がownershipを維持する。Codexはformer taskをarchive/deleteしない。

## Rollback

問題があればhistory rewriteを使わず、安全なrevertまたはcorrective commitでADR 0015の利用者主導境界へ戻す。turnover後のrollbackもinstruction-chain変更として新しいtask turnoverを行う。replacement activationが失敗した場合はPM-11をactiveのまま保ち、重複assignmentを出さない。

## 検証

- 現役のproject rules、仕様、runbook、開始prompt、agent定義に利用者標準実装者または利用者実装後handoffが残っていないこと。
- 過去ADR、changelog、roadmap履歴、UWB実績は歴史的事実として保持し、現在適用するADR 0034への参照を持つこと。
- developerだけがapplication write、testerだけが委譲test writeを持ち、explorer・researcher・reviewer・security reviewer・UI testerがread-onlyであること。
- Codex UI smokeと利用者最終UI acceptance、実装完了とrelease/roadmap完了が区別されていること。
- push、main merge、deploy、Dev/Prod、remote/data、network、関連repository等の別承認境界が維持されること。
- managed governance、TOML、document link/index、ADR status、roadmap arithmetic、diff、staged/committed fileをmechanical validatorで確認すること。

## 再検討条件

Codex実装の品質、所要時間、既存設計との整合、self-review、rollback、UI受入れ待ちの滞留に具体的な問題が確認された場合、利用者が実装責任の変更を希望した場合、agent権限またはUI検証機能が変わった場合、または承認済みsegmentの境界が実運用で曖昧になった場合。
