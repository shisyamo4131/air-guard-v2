# 0037 SuperUser兼会社管理者の自社表示順更新

- 日付: 2026-08-31
- 状態: Accepted
- 関連仕様: Company設定とtenant lifecycle
- 関連ロードマップ: [SuperUser兼会社管理者の表示順対応](../roadmaps/superuser-company-admin-display-order.md)
- 関連判断: [0031](0031-proportional-data-boundary-and-change-safeguards.md)、[0034](0034-codex-bounded-implementation-and-user-ui-acceptance.md)、[0035](0035-company-display-order-update-boundary.md)、[0036](0036-terminated-site-display-order-visibility.md)
- 置換範囲: ADR 0035の「super-userは会社管理者でも表示順を更新できない」というactor境界だけを置き換える。

## 背景

Devで利用者の会社を確認したところ、会社管理者として運用するaccountに`isSuperUser=true`も設定されていた。画面には会社用メニューとスーパーユーザーメニューが表示される一方、稼働予定管理と配置管理の表示順編集入口は表示されなかった。Cloud Functionsのlogには保存POSTがなく、clientの`isSuperUser === false`条件で操作前に停止していた。serverも同じidentityを一律拒否するため、画面だけを変えても保存できない。

super-userであることだけをCompany設定権限にはできないが、同じ会社の有効な本登録Userであり、その会社の唯一の会社管理者でもあるaccountまで一律拒否すると、会社管理者の通常業務を実行できない。

## 決定

- `siteOrder`と`scheduleOrder`だけについて、同じtenantの有効な本登録Userで`User.isAdmin === true`なら、`isSuperUser`がboolean `true`でも更新を許可する。
- 会社管理者でないsuper-userは、role presetに対象permissionがあっても拒否する。super-userであること自体や直接permission文字列を許可根拠にしない。
- non-super-userの会社管理者と、既知role preset由来で対象fieldのpermissionを持つUserは従来どおり許可する。
- `isSuperUser`の欠損・型不正、temporary、disabled、他tenant、User不在、未知role、直接permission文字列は引き続きfail closedで拒否する。
- clientは表示・送信直前、Callableは現在Authentication identityとCompany配下のactor Userを再取得したうえで同じ条件を検査する。Client判定はUX補助であり、serverの最終認可を代替しない。
- clientは既存の`isSuperUser`正規化を他機能向けに維持しつつ、生claimがbooleanであることを別状態で保持し、表示順入口ではその妥当性が明示的に確認できた場合だけ判定を続行する。
- この例外をCompany基本情報、振込先、通常設定、User管理、会社横断support access、maintenance、migration、repairへ広げない。

## 理由

会社管理者としてのtenant内責任と、super-userという付加的な運用属性を両立させる。許可の根拠を同じtenantの有効な本登録会社管理者へ限定すれば、単独super-userによる恒久的なCompany設定変更や他社操作を復活させず、利用者が必要とする表示順管理だけを回復できる。

## 代替案

- super-user accountと会社管理者accountを分離する案: 現行の厳格な境界を維持できるが、既に兼任accountを利用しているDev運用では表示順を変更できず、利用者が仕様変更を承認したため採用しない。
- 全super-userへ表示順変更を許可する案: 会社管理者またはfield別presetという既存の責任境界を失い、会社横断accessを復活させるため採用しない。
- clientだけ許可する案: Callableが拒否して保存時だけ失敗するため採用しない。
- `isSuperUser` claimを自動変更する案: 他の運用権限へ影響するAuthentication data変更であり、この表示順operationの範囲を超えるため採用しない。

## 影響と互換性

- SuperUser兼会社管理者には、稼働予定管理と配置管理の表示順編集入口が表示され、自社の両表示順を保存できる。
- non-super-user会社管理者、field別既知preset actor、保存形式、Company document、Rules、競合UIは変わらない。
- Functionsを先に反映し、Hostingを後に反映する。旧clientは入口を表示しないだけで安全に動作し、新clientが旧Functionへ先行して保存errorになる時間を作らない。
- data migration、remote claim変更、Company分割、Rules変更はない。client session内に表示順用のclaim妥当性状態を追加するだけである。
- Dev・Prod・remote/data・deployは別のbounded release承認を必要とする。

## Rollback

local commitをrevertしてclientとCallableの旧actor条件、test、文書を一体で戻す。release後は旧Functionを先に戻すと新clientが保存errorになるため、Hostingを旧clientへ戻してからFunctionを戻す。dataとclaimは変更しないためdata rollbackは不要である。

## 検証

- clientとserverの両方で、SuperUser兼会社管理者が`siteOrder`と`scheduleOrder`を更新できる。
- 会社管理者でないsuper-userは、対象permissionを持っていても両fieldを更新できない。
- non-super-user会社管理者とfield別既知preset actorの既存成功を維持する。
- temporary、disabled、他tenant、User不在、未知role、直接permission、`isSuperUser`欠損・型不正を拒否する。
- 対象field限定、同値write 0、Company root client CUD拒否、draft・競合・保存中制御の回帰を維持する。
- Dev反映後、利用者のSuperUser兼会社管理者accountで両画面の編集入口、保存、再読込を最終確認する。

## 再検討条件

一つのaccountがsuper-userと会社管理者を兼ねる運用を廃止する場合、Company管理者が複数になり得る場合、会社横断support accessを正式実装する場合、または表示順以外のCompany設定にも兼任actorが必要になった場合。
