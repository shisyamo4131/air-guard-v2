# 0015 利用者主導実装とCodexによる設計・検証・文書・Git管理

- 日付: 2026-08-14
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理、セキュリティと機密情報
- 関連判断: [0005](0005-multi-agent-and-emulator-testing.md)、[0007](0007-project-scoped-specialist-agents.md)、[0011](0011-roadmap-and-codex-session-lifecycle.md)、[0012](0012-feature-branch-acceptance-and-related-repositories.md)、[0013](0013-managed-governance-reconstruction.md)
- 置換する判断: [0007](0007-project-scoped-specialist-agents.md)の標準実装者と書込み役割。専門roleのread-only境界と必要時だけ使用する原則は継承する。

## 背景

AirGuardV2は利用者が実装し、Codexが既存実装を読み取って仕様、調査、roadmap、運用文書を整備した。認証・認可・tenant分離を含むCritical問題が確認され、Codexによる改善を試みたが、既存設計からの乖離、長時間作業、通信障害等により試行運用前の安全な完了へ至らず、改善差分はrollbackされた。現在の既知問題を認識したうえで、既存設計の理解を保ちながら小さな改修を積み重ねる必要がある。

local Emulator環境はtest用1社、Dev環境は利用者の会社と協力会社の2社が試用している。一般公開はしていないが、Devはremoteかつ複数会社のdataを持つため、認証問題の解消を最優先とする。

## 決定

- application codeの標準実装者を利用者とする。
- Codex coordinatorは設計、仕様整理、脅威・失敗経路分析、差分review、test計画・許可済み検証、document、roadmap、ADR、local Gitを管理する。
- Codexの`developer`は、利用者が対象を明示した補助実装だけに使用する。
- `tester`は明示されたtest scopeでtest codeを編集できる。application codeは変更しない。
- explorer、researcher、reviewer、UI tester、security reviewerはread-onlyを維持する。
- project専用agentと同時実行上限4は維持するが、必要な補助roleだけを使用し、標準の作業loopにdeveloperを含めない。
- 認証・認可・tenant分離の改善は一括置換せず、利用者が仕様を理解でき、独立review・test・rollbackできる最小segmentを1件ずつ扱う。
- 各segmentでは実装前に現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを整理する。利用者の実装後にCodexが差分reviewと許可済み検証を行い、確定結果を正本文書へ同期する。
- branch境界は作業単位ごとに利用者と相談する。Codexは合意済み範囲のlocal branch・stage・commitを管理できるが、利用者の未コミットapplication codeを独自判断で変更・破棄・commitしない。
- `main` merge、push、deploy、migration、remote data操作、外部service変更は引き続き個別の明示承認を必要とする。

## 理由

既存実装の意図と互換性を最も把握している利用者へ実装責任を戻し、Codexを大量実装ではなく、説明可能な設計、独立review、失敗経路検証、正本維持へ集中させるため。単一の大規模変更より、小さなsegmentごとの理解、test、rollback境界を優先する。

## 代替案

- Codex developerを標準実装者として継続する案: 既存設計からの乖離と長時間の統合失敗が再発するriskがあるため採用しない。
- Codexを文書更新だけに限定する案: security review、test設計、差分review、Git管理の有用性を失うため採用しない。
- 認証を一括再設計する案: 変更範囲、理解、回帰、rollbackが大きすぎるため現段階では採用しない。

## 影響

- 利用者: application codeを原則実装し、segmentの仕様理解と対象環境での最終確認を行う。
- Codex: application codeを既定では編集せず、設計、review、検証、document、local Gitを担当する。
- task: coordinator責務とdeveloper roleを変更するinstruction-chain変更である。検証・commit後、利用者の明示承認を得てaffected taskを新規taskへ交代する。
- 製品・data: この判断自体はapplication、Functions、Rules、Firebase設定、実dataを変更しない。
- 進捗: ガバナンス変更だけでは正式運用準備roadmapを加点しない。

## 移行

専用branchでproject rules、仕様、operations、開始prompt、agent設定、ADR、変更履歴、古いhandoff指示を同期し、project-owned validatorとmanaged governance validatorを実行する。local commit後、新taskがrepositoryから役割と承認境界を復元し、変更なしcallbackを返したことを確認してから旧taskをarchiveする。交代完了までは新規application作業を開始しない。

## 再検討条件

利用者がCodexへ標準実装責任を戻す場合、補助実装の範囲が恒常化した場合、test編集権限を変更する場合、または役割分担が認証改善の速度・品質を阻害すると確認された場合。
