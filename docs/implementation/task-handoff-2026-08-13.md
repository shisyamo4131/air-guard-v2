# 2026-08-13 PM交代引継ぎ記録

- 状態: PM交代時のrepository restart基準
- 日付: 2026-08-13
- 記録前基準: branch `codex/local-test-harness`、commit `8c00232adf49f6717b096c9c9375c28b66412b37`、worktree clean
- 公式進捗: 10%

この記録はtask再開用の状態記録であり、確認済み仕様の正本ではない。2026-08-12の予定source本文静的レビューは完了したが、特定した問題の修正、回帰test、runtime・local環境・browser・remote・実data検証、利用者受入れは完了していない。

## 交代状態

- 旧PM: `019ff0e0-36c3-7d11-9548-6fb42398e51e`（host `local`）。本記録のcommitとcallback成功後にarchive可能。
- 新PM: `019ff8bc-c35c-7d31-b8d3-717dbddfe7c2`（host `local`）。
- 旧worker: `019ff0de-93cf-7743-a5c6-9cc53b05d260`。交代成功後にarchive済みで、未統合変更はない。
- 新worker: `019ff8b9-5ff4-7031-a28b-48d76faba442`（host `local`）。新PMからcheckpointを受けるまで待機する。
- 2026-08-13の交代はworkerを先に、PMを後に実施した。このcheckpointではdurableなガバナンス・運用規則を変更しない。この順序の明文化不足は、instruction-chain処理を伴う別のガバナンス文書訂正として後日扱う。

## 基準時点の検証証拠

- `npm run test:local`: 4/4 pass。
- 利用者用`./saved-data`の指紋、Codex専用領域の容量、seed上書き防止guard: pass。
- project docs validator、managed governance validator: pass。
- `npm audit`: 43件（low 4、moderate 10、high 23、critical 6）。自動修正は実施していない。

`codex/local-test-harness`の承認済み成果はcommit済みだが、`main`へmergeしていない。`main`へのmergeは利用者の別の明示承認を必要とする。push、deploy、data migration、実data操作、外部service変更も承認されていない。

## 承認済みの作業方針

- 追加機能は延期し、先に本当に必要な仕様判断を明確にして、既存の欠陥・問題を小さな単位で順に直す。優先順位はPMが選ぶ。
- 実装・修正前に、なぜ必要か、何を変えるか、どう直すかを説明し、利用者の明示承認を得る。現行実装が既存仕様またはADRに反する場合も、承認なしに変更しない。
- 安全に隔離できる非UIのlocal testはCodexが完了させる。Codexで実施できない確認だけを利用者へ依頼し、PMが利用者報告を受入れ可能と判断してからcommitする。
- remote deployed code、Firebase実data、build artifactは検証しない。browser検証は、必要な画面幅別responsive確認を除いて通常は利用者が行う。
- Firebase Emulator環境は「local環境」と呼ぶ。現在利用中の外部境界は郵便番号検索、Firebase基盤、FCM、geocodingである。Stripeは学習・将来の有料利用向けに導入済みだが現在未使用である。
- `main` merge、push、deploy、migration、実dataまたは外部serviceへの作用は、それぞれ対象操作ごとの明示承認なしに行わない。

## 未解決の優先順

1. Criticalな認証・認可・tenant問題を、隔離したlocal/contract testと修正単位へ分ける。
2. locked OperationResult、Billing・勤怠・履歴・rounding・notificationの整合性を扱う。
3. backup/restore scope、RPO/RTO、operator判断を確定する。
4. 共通UIのdisable、single-flight、draft、latest-wins、date-time、accessibility契約を整理する。
5. 破壊的な自動修正をせず依存関係脆弱性を調査する。

利用者から「次の作業は？」と聞かれた場合、最初に`codex/local-test-harness`がcommit済みだが`main`未mergeであることを開示し、統合済み基準として扱う前に別のmain merge承認を求める。その後、業務用語で最大3問の最初の判断batchとして、actor・permission境界、招待本人確認、lock後・請求後の訂正権限を提案する。並行してraw FCM token logのredactionなど判断に依存しない小さな修正案を準備するが、承認前に実装しない。

## 次回task交代時の一時的な採用方針

- 状態: 利用者承認済みの試験計画。現在は未適用であり、現行permission、`.codex/config.toml`、Git運用をこの記録変更では変えない。
- 現状: user-levelの`default_permissions = ":workspace"`とproject-levelの`sandbox_mode = "workspace-write"`が併存する。sandbox内では検証用Nodeの起動が拒否された実績があり、`.git`はread-onlyのためGit mutationに権限昇格が必要である。
- 試験する推奨構成: user-level設定と他projectを変更せず、AirGuardV2のproject専用permission profileへ統一する。Nodeの必要最小限のread/execute経路を許可し、`.git`のsandbox内read-only保護は維持し、承認済みGit mutationは失敗を挟まず最初から限定的な権限昇格で実行する。global rule、`.git`の通常write許可、`danger-full-access`は採用しない。

### 適用と交代

1. 次回task交代時は、新規割当を止めて安全なcheckpoint、基準commit、clean worktree、復元対象設定を記録する。
2. 交代前に推奨構成と必要なproject-owned permission・運用文書を更新し、TOML、project docs、managed governance、差分、rollback手順を検証してcommitする。
3. project-wide permissionのinstruction-chain変更として、履歴をforkせずPMと影響workerを新しいtaskへ交代する。旧taskは新taskのrepository restart、permission、callback経路、変更なし確認が成功するまでarchiveしない。

### 交代後の受入れ条件

- Sandbox: AirGuardV2の許可されたworkspace fileを通常どおり読取り・編集でき、workspace外、secret、remote、network、実dataへの境界を広げない。
- Node: `scripts/check-project-docs.ps1`内のNode製TOML validatorがsandbox内で`Access is denied`を起こさず完了する。
- Git: read-only Git確認がsandbox内で成功し、明示承認済みのstage・commitは最初の試行から限定的な権限昇格で成功する一方、`.git`はsandbox内の通常write対象にならない。
- Scope: user-level Codex設定と他projectの設定・挙動を変更していないことを確認する。
- Validation: project docs validator、managed governance validator、TOML検証、`git diff --check`、exact diff、branch・HEAD・worktreeを確認する。application、Emulator、browser、remote、external、実data testはこのpermission受入れに含めない。

全条件を満たす場合だけ、推奨構成をAirGuardV2専用設定として採用し、試験状態を採用済みへ更新する。一つでもsandbox・Git・Nodeの必要な利用を妨げる場合は一時的な採用方針を棄却し、失敗証拠、影響、暫定運用、復元対象を記録する。棄却後は同じtask内で設定を継ぎ足さず、その後の安全なtask交代時に試験直前のproject設定と関連運用文書へ戻し、同じ交代・検証手順で復元を確認する。

## 再開時の正確な読書集合

1. `AGENTS.md`
2. `governance/project-rules.md`
3. `docs/README.md`
4. `docs/operations.md`の「Git統合」「プロジェクト管理タスクループ」「Codexセッションのライフサイクル」
5. `docs/roadmaps/airguard-v2.md`
6. `docs/implementation/review-reconciliation-2026-08-12.md`
7. `docs/decisions/0011-roadmap-and-codex-session-lifecycle.md`
8. `docs/decisions/0014-codex-dedicated-local-test-data.md`
9. この`docs/implementation/task-handoff-2026-08-13.md`

この記録にはsecret、credential、private production data、Codex session本文を含めない。
