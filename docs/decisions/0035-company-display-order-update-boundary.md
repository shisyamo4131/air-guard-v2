# 0035 Company表示順の専用更新・権限境界

- 日付: 2026-08-30
- 状態: Accepted
- 関連仕様: Company設定とtenant lifecycle
- 関連ロードマップ: [Company部分更新](../roadmaps/company-partial-updates.md)
- 関連判断: [0031](0031-proportional-data-boundary-and-change-safeguards.md)、[0034](0034-codex-bounded-implementation-and-user-ui-acceptance.md)
- 置換範囲: [0025](0025-company-configuration-boundary.md)に残る表示順のpreset-only actor、専用Settings document、revision前提を、現行単一Company rootのfield限定更新へ置き換える。
- 一部置換: [0037](0037-superuser-company-admin-display-order.md)が、会社管理者でもあるsuper-userを拒否するactor境界だけを置き換える。単独super-user・他tenant拒否、field別preset、入力・競合・保存境界は維持する。

## 背景

`siteOrder`と`scheduleOrder`は配置管理・稼働予定の行順を共有するが、従来は画面がlive Company配列を先に変更し、Company document全体を保存していた。失敗時の復元、編集中のlistener更新、二重送信、field別権限が不十分で、Company既定`agreementsV2`の廃止方針とも画面が一致していなかった。

利用者は、表示順を既存permission actorだけでなく会社管理者も変更できること、Companyに既定取極め設定を持たせないことを確認した。

## 決定

- Company設定画面からCompany既定取極めのUIとwriterだけを撤去する。保存済み`agreementsV2`、schema field、Site固有取極めは削除・移行しない。
- `siteOrder`と`scheduleOrder`はCompany rootに残し、exact `{field, order}`の専用Callableで一方だけを更新する。各orderは最大2000件、itemはexact `{siteId, shiftType}`、siteIdは1〜128文字でslash/control禁止、shiftTypeは`DAY/NIGHT`、pairは一意とする。
- actorは同じ会社の有効な本登録non-super-userで、会社管理者、または既知role presetから対象fieldのpermissionを得るUserとする。`siteOrder`は`sites:write`、`scheduleOrder`は`site-operation-schedules:write`を要求する。直接permission文字列、未知role、temporary、disabled、他社、super-userを拒否する。
- Callableは検証済みidentityからCompanyを導出し、transaction内でactorと最新Companyを再確認する。対象fieldとserver管理の`updatedAt`・`uid`だけを更新し、同値はwrite 0とする。clientから`agreementsV2`、`siteOrder`、`scheduleOrder`を直接変更することは全actorへ拒否する。
- UIはlive Companyと独立したdraftを使い、保存成功前にCompany本体を変更しない。dirty中の外部更新はdraftを置換せず保存を止め、最新値の明示再読込を要求する。自分の保存reflectionは競合にしない。保存中はdrag・保存・取消・再読込・行削除等を停止し、失敗時はdialogとdraftを維持する。
- 存在しないSiteと非active Siteは表示から除外し、次の明示保存時だけorderから除去する。自動cleanup writeは行わない。
- revisionやexpected baselineは今回導入しない。相手の更新を受信した後のstale saveはUIで止めるが、許可actorの完全な同時保存は後commit優先となる残存riskを受容する。

## 理由

Company documentを分割せずにwhole-document replacementと直接client writeを閉じれば、現在の読取互換を保ちながら配置順だけを安全に更新できる。会社管理者を明示actorへ含めることで運用責任と画面操作を一致させ、field別preset permissionも維持できる。

## 代替案

- CompanyをSettings/arrangementへ分割する案: 読取、量、query、復旧の具体的必要がなく、ADR 0031の比例原則に反するため採用しない。
- 会社管理者にもpreset permissionを必須とする案: 利用者が会社管理者による変更を明示したため採用しない。
- revisionをrequestへ追加する案: 完全同時保存を防げるが、現行保存contractとmigrationを広げるため今回は採用しない。具体的な上書き被害が確認された場合に再検討する。
- Company既定取極めの保存値を同時削除する案: data migrationと復旧が必要なため採用しない。

## 影響

- 配置管理と稼働予定のsort/removeは同じactor・保存処理・保存中制御を使う。
- Company既定取極めは画面から消えるが、Site取極めは変わらない。
- 旧未使用のCompany whole-document writerはRulesにより対象field変更を拒否される。caller 0の除去はCPU-05で行う。
- Dev、Prod、remote/data、deploy、migration、Schemas/Admin SDKは変更しない。

## Rollback

local commitをrevertしてapplication、Callable、Rules、test、文書を一体で戻す。data migrationがないためdata rollbackは不要である。将来release時はFunctions、client、Rulesの互換順序を別checkpointで固定する。

## 検証

- exact入力、2000/2001、item形式、重複、field限定update、同値write 0。
- 会社管理者とfield別既知presetの成功、直接permission・未知role・super-user・temporary・disabled・他社の拒否。
- protected 3 fieldの直接write拒否と、対象外Company fieldの互換更新。
- live非mutation、dirty draft、自己保存reflection、真正競合、single-flight、保存中操作停止、失敗時維持。
- Company既定取極めUIなし、Site取極め維持、非active Site除外、sort/remove両経路。
- Codex専用UI smokeと利用者の実際の利用環境による最終UI acceptanceを分離する。

## 再検討条件

許可actor同士の完全同時保存による実害が確認された場合、orderがdocument sizeやquery要件を満たさなくなった場合、またはCompany既定取極めの保存値を削除するmigrationを承認する場合。
