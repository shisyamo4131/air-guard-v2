# EMP-06 local実施記録

- 日付: 2026-09-07
- checkpoint: EMP-06 一覧・検索・User画面
- 開始baseline: branch `codex/employee-master-roadmap`、HEAD `b0ea75143d0f99218f512d307f205bfc7a46bac8`
- 実装commit: `bd0119561e492727981fdebaa240d794e582e9b3`
- 正本: [Employee仕様](../specification.md#employeeの操作権限と保持)、[ADR 0056](../decisions/0056-employee-role-and-archive-boundary.md)、[Employeeロードマップ](../roadmaps/employee.md)

## 実装・承認境界

在職・退職一覧をEmployee専用購読/sessionへ移し、scope喪失、検索race、取得失敗と再読込を制御した。在職一覧の空検索はACTIVE全件と作成入口、退職一覧の空検索は0件・作成入口なしを維持する。User panelからAirItemManager/AirArrayManager/useBaseManagerを除き、既存の仮User作成・削除だけを独立draftと専用dialogへ接続した。統括退職はstrict preset検証後のexact `manager`を既存の会社管理者・人事に追加し、直接permission、未知role、本人等の拒否を維持した。

見た目の変更は、利用者へ理由と影響を提示して明示承認を得た一覧のprogress/error・再読込表示と、採用済み仕様に必要な統括の退職button表示に限定した。既存card、検索欄、在職一覧だけの追加button、User card/dialog入力、作業員名Chipは変更対象にしていない。今後の見た目変更は理由・変更前後・影響・代替を提示し、事前判断を得る規則をproject rulesへ追加した。

Dev/Prod、remote、実data、Schemas package、Firestore Rules/data shape、migration、archive/purgeは変更していない。通常Employee編集からUser/Authを作成・復元・同期する処理も追加していない。

## Chrome受入れ

利用者が会社管理者でサインイン済みの現在のChrome、`http://localhost:3000`の利用者用Local Emulator環境をcoordinatorが引き継いだ。保存・作成・退職・削除は実行せず、次を通常pointer/keyboard操作で確認した。

- 在職一覧は空検索で全件をフリガナ順に表示し、追加buttonが存在する。
- 既存氏名による検索で1件へ絞り込み、clearで全件へ戻る。
- 退職者一覧は空検索で0件、追加buttonなし。非空検索も安全に0件表示し、clearで初期状態へ戻る。
- Employee詳細に会社管理者向け退職処理が表示される。
- User未登録Employeeで専用User登録dialogを開き、emailと既存6 role選択が表示され、閉じる操作で保存せず復帰する。

reload後の製品logに新しいapplication errorはなかった。Chrome拡張由来とみられる既存message-channel errorは別に残る。サインインactorが会社管理者のため、統括だけのbutton表示はbrowserでは未確認であり、client policy単体と公開CallableのEmulator統合で確認した。取得失敗表示は実環境を故意に切断せず、session/source testとbuildで確認した。

## 自動検証

| Gate / command | 結果 | Exit |
|---|---|---:|
| `node --test test/domain/*.test.mjs` | 1501/1501成功 | 0 |
| `npm run test:local` | 181/181成功。統括actorのEmployee-only退職が公開Callableで完了。demo project・loopback限定、利用者saved-data不変 | 0 |
| `npm run test:local:ui:build` | clean `bd011956`から専用Nuxt build成功。既存のBrowserslist/chunk size/sourcemap/deprecation warningあり | 0 |

最終文書状態で、project-docs（255 Markdown / 60 ADR / 11 roadmap / 8 TOML）、project-docs-negative、capacity-regression（7 checks）、managed-governance（rendererを含む）、diff-checkを個別に実行し、すべてexit 0だった。Dev/Prod generateはrelease-onlyかつ未承認のため実行しない。

## 判定・次工程

EMP-06のLocal完了条件を満たし、重み10を加点してEmployee進捗を75%から85%へ更新する。EMP-07の独立課題確認は未開始であり、別の開始判断を待つ。EMP-09のDev反映・実data確認は引き続き別承認である。
