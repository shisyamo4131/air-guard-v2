# SITE-05/06 Codex専用local検証記録

## 対象と判定

- 対象: SITE-05 archive安全性、SITE-06 取極め契約
- 環境: Codex専用local。Dev、Prod、remote、実dataは未接続・未変更
- 影響分類: UI、application logic、data contract、Firestore Rules
- 判定: SITE-05/06のlocal実装と自動検証は完了。内蔵ブラウザによる権限別・既存機能回帰はSITE-08で実施する
- 実装基準commit: `536556d87e13d98ecd974119833e5d694f59787b`、`2cb2adf090e9d15707ab8d4d58cfedd79b46341d`、`9a065d75002a0d7275fdb0ece16a226288027c23`

## 実装境界

SITE-05は誤登録・重複Siteだけを専用Callableでarchiveし、同一transactionで直接参照を確認する。参照があるSite、権限不適合、maintenance中、競合、異なる冪等再試行を拒否する。clientからのSite delete、archive create/update、同じIDのSite再作成、generic restoreへのSite UI到達は許可しない。

SITE-06は取極めの作成・更新・削除を専用Callableへ集約し、現在のAuth、User、maintenance、ACTIVE Site、同一field競合、数値範囲、重複、0円確認を検証する。保存先はSite documentの`agreementsV2`、`uid`、`updatedAt`だけであり、既存OperationResult snapshot、専用履歴、取極めrevisionには書き込まない。

## 現場ドキュメント以外の読み書き差分

| 対象 | 改修前 | SITE-05/06後 | 互換性判断 |
|---|---|---|---|
| `SiteOperationSchedules` | 予定CRUD・実績化で参照・更新 | Site作成、site/date変更、実績化の境界でlive Site/revisionを追加確認。通常削除は同じ | 正常系の提供機能は維持。競合・不存在だけを新たに拒否 |
| `OperationResults` | 実績CRUDで参照・更新 | createまたはsiteId変更時にlive Siteを追加確認。既存snapshotは取極め変更で更新しない | snapshot不変は従来仕様を維持。不存在参照だけを新たに拒否 |
| `ArrangementNotifications` | 通知CRUDで参照・更新 | createまたはsiteId変更時にlive Siteを追加確認。通常更新・削除は同じ | 正常系を維持。不在Siteへの新規参照だけを拒否 |
| `Billings` | 請求CRUDで参照・更新 | createまたはsiteId変更時にlive Siteを追加確認し、新規Billing初期化は同一transactionでSiteを読む。既存非Site field更新・削除・読取りは同じ | 正常系を維持。不在Siteへの新規参照だけを拒否 |
| `SiteEmployeeHistories` | 履歴再構築で実績を読み履歴を書込 | 再構築時に対象期間の実績とlive Siteを同一transactionで確認。実績0件のcleanupは従来どおり可能 | 正常系を維持。不在Siteを使う再構築だけを拒否 |
| `System` / `Users` | 各処理に応じて参照 | 専用Callableがmaintenanceとstrict actor判定のため追加読取り | 読取りのみ追加。product writeなし |

`DailyAttendances`と`DailyOperationsByEmployee`はOperationResult由来の下流snapshotであり、SITE-05/06ではarchive blockerにも書込対象にもしていない。Customers、Storage、その他collectionへのproduct writeも追加していない。remote上のlegacy shapeはSITE-09 preflightまで未確認である。

## 実測した自動検証

| Gate | Command | Result | Exit |
|---|---|---|---:|
| domain-full | `node --test test/domain/*.test.mjs` | 1087 passed、0 failed | 0 |
| local-emulator-suite | `npm run test:local` | 166 passed、0 failed | 0 |
| local-ui-build | `npm run test:local:ui:build` | Nuxt/Nitro build成功 | 0 |
| project-docs | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1` | 242 Markdown、54 ADR、10 roadmap、8 TOMLの検証成功 | 0 |
| diff-check | `git diff --check` | whitespace errorなし | 0 |

対象testではarchiveの認可・冪等性・参照拒否・Rules barrierと、取極めの認可・競合・no-op・数値・時間・重複・0円確認を検証した。独立reviewで重大な認可、tenant境界、非Site data書込みの逸脱は検出されなかった。reviewで検出した0円確認中の二重操作によるPromise上書きは、single-flight、操作無効化、unmount時cancelへ修正し、再検証した。

## 未検証・次工程

- SITE-08: 内蔵ブラウザでSite画面と、影響した予定・稼働実績・請求・配置通知の従来同等動作を確認する
- SITE-08: 会社管理者、既知role、read-only相当、直接permission、未知role、temporary、disabled、他tenant、non-admin super-userの最小十分な権限組合せを確認する
- SITE-09: Dev反映前にremoteの既存archive、取極め、予定、下流snapshot shapeをread-only preflightする。別承認まで接続・変更しない
