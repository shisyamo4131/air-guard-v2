# Dashboard（ログイン後トップ）（実装調査）

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-047、SPEC-DEEP-042
- 最終確認日: 2026-08-12
- 根拠ファイル: `pages/dashboard/index.vue`、直接ArrangementNotifications manager、WeeklyOperationQuantityBarとchart composables、recent arrangement/site alert/range data composables、`pageSettings.js`
- 関連文書: `arrangement-notification-ui.md`、`site-master.md`、`site-operation-schedule.md`、`operation-result-ui-export.md`、`authorization-model.md`
- 制約: 遷移先業務、store/auth内部、全model集計は再調査していない。

## 入口・権限

`/dashboard`はnavigation表示対象で、pageSettingsのrequired rolesは空配列である。認証global middlewareを通過した全login userがrouteへ入れる。widgetの表示はpage内で次の2条件に分かれる。

- `auth.employeeId` truthy: 直近配置情報とcalendar。
- `auth.isAdmin && auth.isDeveloper`: 7日稼働数graphと2つのSite警告。

ORではなくANDである。employeeIdを持たず、admin+developerの両方でもない利用者には空のcontainerだけが表示される。dashboard専用のrole/permissionはない。

## widget表

| widget | 表示条件 | data / period | 表示・操作 |
| --- | --- | --- | --- |
| あなたの直近配置情報 | employeeId | ArrangementNotification、前日開始の5日間 | 日付/勤務区分昇順。空stateあり。項目clickで詳細・状態遷移/日報入口。 |
| Calendar | employeeId | data/events未binding | `air-calendar color=secondary`だけ。filter、event、navigationなし。 |
| 稼働数の推移 | admin AND developer | 今日JSTから7日、SiteOperationSchedule+OperationResult | securityType別stacked bar。interaction/navigationなし。 |
| 工期終了現場 | admin AND developer | ACTIVE、終了日あり、終了日が今日JST開始より前 | SitesDataTable。row update eventで`/sites/{docId}`へ遷移。 |
| 工期終了日未設定現場 | admin AND developer | ACTIVE、`constructionPeriodEndAt == null` | SitesDataTable。同じSite詳細遷移。 |

請求、勤怠、売上、ユーザー数、通知未読数、system status等のdashboard widgetは実装されていない。

## data / query flow

page setupは表示条件より先に3 composableを常に呼ぶ。

1. `useRecentArrangements`: setup時点の`auth.employeeId`を通常値として取得する。値がなければplain `{docs: []}`を返して購読しない。ある場合、`id == employeeId`、`dateAt >= yesterday 00:00 JST`、`dateAt <= 5日範囲末`でArrangementNotificationをlive購読し、各docのSiteをfetch/cacheする。
2. `useSitesMustBeTerminated`: ACTIVE、`hasConstructionPeriodEndAt == true`、`constructionPeriodEndAt < today 00:00 JST`をlive購読する。
3. `useSitesEmptyConstructionPeriodEndAt`: ACTIVE、`constructionPeriodEndAt == null`をlive購読する。

Site警告2購読はwidget非表示のemployee/通常userでも開始される。Recent ArrangementsはemployeeIdなしなら開始しない。全購読はunmount時unsubscribeする。明示limit、cursor、orderBy、manual refresh、cache TTLはない。

chart componentは`v-if` row内なのでadmin+developer以外ではmountされない。mount時に今日から7日間のSiteOperationSchedulesとOperationResultsをそれぞれdateAt rangeでlive購読する。両data layerは各docに対してSite、Employee、Outsourcer cache fetchを呼ぶが、chart描画はsecurityType、docId、requiredPersonnel/statistics quantityだけを使う。

## 集計定義

7日graphはJST今日00:00から6日後23:59:59までをlabel rangeとする。日付→securityType→docId→quantityのMapを作る。

- schedule: `requiredPersonnel ?? 0`
- result: `statistics.total.quantity ?? 0`
- 同じdate/securityType/docIdがあれば、後から処理するOperationResultがschedule値を上書きする。
- security type constants全件をdatasetにし、stacked barで日別表示する。

status、customer、site、shift、OJT、qualification、cancel/locked等でfilterしない。予定と実績の同一docId invariantが成立するものだけ重複排除される。手動作成resultやID不一致では別稼働として合算される。graph titleは「稼働数の推移」だが、未来予定人数と完了実人数を同じ系列へ混在させる。

未使用候補として、securityType非分割の`useOperationQuantityInRange`が「現在未使用」とcode commentに明記され、直接caller検索でも見つからない。

## navigation

- Site警告tableのupdate actionだけが`/sites/{docId}`へpushする。
- Arrangement widgetはmanager dialog/状態遷移をdashboard内で行い、別routeへnavigateしない。
- calendarとchartにclick/navigationはない。
- dashboard自身の期間selector、filter、refresh button、widget設定はない。

## state / error / responsive

Recent Arrangementsは明示empty state「直近の配置情報はありません」を表示する。Site tablesとchart/calendarにはpage独自のloading/error/empty表示がない。site data layerはerror refを返さず、chart range layerはsubscribe呼出し時の同期errorをloggerへ渡してunsubscribeする。Firestore listener後続errorの扱いはadapter契約で未確認である。

配置widget内の詳細fetch/状態遷移はglobal loadingとloggerを使う。dashboard全widgetを束ねるrefresh、partial error、last updated、stale indicatorはない。live subscriptionにより通常は更新されるが、network復旧/stale cache表示は明示しない。

layoutはemployee rowがmobile 12列、md以上で配置4/calendar8。admin+developer widgetは全て12列で縦積み。chartはresponsive/maintainAspectRatio false、高さ240。Site tableのmobile挙動は共通componentへ委ねる。keyboard/focus/aria labelはdashboard独自に追加しない。

## security / performance

- routeは全認証Userへ開き、Site警告queryは表示条件に関係なく全dashboard訪問者で実行される。Rulesが許す同社Site dataをclient memoryへ取得するため、UI非表示はdata取得制御にならない。
- employee向け配置には自身のemployeeId filterがある。setup時のemployeeIdを非reactiveにcaptureするため、初期値なしから後で設定されても自動購読開始しない。通常middleware初期化との順序で回避される可能性はあるが未確認。
- recent arrangementは各docのSiteをfetchする。chartの2 range queryも各docのSite/Employee/Outsourcerをfetchするがchartはそれらを使用せず、N+1/cache lookup負荷候補である。
- Site警告、arrangements、schedule、resultにlimitがない。期間固定の後者3つに対し、Site警告は全該当Siteを購読する。
- chartはschedule/resultをclient集計し、server aggregate/cacheなし。同一データを複数dashboard sessionが個別計算する。
- 表示dataは配置、現場終了状態、稼働人数で、employee/業務情報を含む。請求金額・個人連絡先はdashboardに直接表示しない。

## 矛盾・未使用候補

- dashboard navigationは全認証Userへ見えるが、employeeIdなし・admin+developerでないuserは空画面となる。
- Site警告はadmin+developerだけ表示するのにqueryは全訪問者で実行する。
- `isAdmin && isDeveloper`はadminだけ/developerだけを除外する。暫定権限の意図はcodeから確定しない。
- Calendarはevents/操作未結線で、placeholder候補である。
- 「稼働数」は未来の予定必要人数と実績の実人数を同じchartへ混在する。ID/date/securityType一致だけで上書きする。
- chartが不要なEmployee/Outsourcer/Site fetchを各schedule/resultで起動する。
- recent arrangementsのemployeeIdがsetup時snapshotでreactiveでない。
- `useOperationQuantityInRange`はcommentとcaller検索の両方で未使用候補。
- dashboard専用loading/error/last-updated/refreshがない。

## 将来要対応

- FUT-0155: dashboardの表示条件とquery開始条件を一致させ、不要取得/N+1/limit/staleを改善する。
- FUT-0156: dashboard audience、calendar、稼働数metric、空dashboardの正式契約を決定する。

## 要確認事項

- CONF-0132: dashboardを誰向けにし、widget/permission、calendar、稼働数の予定/実績定義、空状態をどうするか。

## 未確認範囲

実UI、Firestore/Emulator、実件数・index、network/offline、chart tooltip/色accessibility、AirCalendar/SitesDataTable内部、Auth初期化race、遷移先Site/Arrangement業務本文は未確認である。query cost、render時間、mobile実機、screen reader、production role distribution、正式KPI要件も未確認である。

## dashboard data layer追加確認（SPEC-DEEP-042）

- `useRecentArrangements`はsetup時に`auth.employeeId`を通常値としてcaptureし、未準備ならplain `{docs: []}`を返す。後からemployeeIdが設定されても購読を開始しない。
- `useSitesMustBeTerminated`のtodayと`useUnconfirmedSiteOperationSchedules`のcurrentDateはsetup時に一度だけ計算する。画面を開いたままJST日付を跨いでもquery境界は更新されない。
- Site alert 2層とrecent arrangementはloading/error/retry/lastUpdatedを返さず、listener async errorを受けるcallbackもない。master cache fetchも結果をawaitしない。
