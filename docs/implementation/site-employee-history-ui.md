# SiteEmployeeHistory UI

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-059
- 最終確認日: 2026-08-11
- 根拠ファイル: `pages/sites/[id].vue`、`components/SiteEmployeeHistory/Employee/Chip.vue`、`composables/dataLayers/useSiteEmployeeHistoriesBySiteId.js`、schemas `SiteEmployeeHistory.js`、`utils/pageSettings.js`、`firestore.rules`
- 制約: runtime、実data、同期Functions本文は再調査していない。

## caller・到達性

直接callerは`/sites/[id]`の現場詳細pageだけである。routeは暫定`sites:read` permissionを要求し、画面の「入場者」cardに履歴ごとのchipを表示する。component/data layerの他callerは検索で確認できず、現行到達は1経路である。

通常従業員本人向けの「自分が入場した現場一覧」route/component/Callable/projectionはこのscopeに存在しない。CONF-0029で承認済みの本人閲覧方針は現在UIへ未実装である。

## query・subscription・sort

data layerはmount時に`SiteEmployeeHistory.subscribeDocs`を次の単一constraintで開始し、unmount時にunsubscribeする。

```text
where siteId == route.params.id
```

date/status/employee filter、orderBy、limit、paginationはない。callbackが渡されるとsnapshot itemごとにEmployee fetchを起動する。Site detailは全履歴をclientでcopyし、cached Employeeの`displayNameKana`（欠損時空文字）を`ja` localeでsortする。同一kanaのtie-break、employeeId fallbackはない。

queryのloading/error/cache状態はdata layerから返さず、返却APIは`docs`だけである。subscription errorをpageへ表示する結線も直接確認できない。Employee fetchはpage rootの`useFetch(..., true)`がprovideするcacheをchipでinjectして共有し、同一Employeeの重複取得を抑える基盤を使う。

## 表示field・操作

| 表示 | 値源 | 挙動 |
| --- | --- | --- |
| chip text | Employee `displayName` | cache未取得/欠損時は`...loading` |
| sort | Employee `displayNameKana` | 欠損は空文字、同値順は明示しない |
| tooltip | history `firstDate` / `lastDate` | schemaのJST `YYYY-MM-DD`読み取り専用property |

tooltipはhoverでは開かずclickで開く。subtitleは「クリックすると詳細表示」だが、表示するのは初回・最終日だけで、Employee detailやOperationResultへのnavigationはない。`firstOperationResultId`/`lastOperationResultId`はUIで利用せず、CONF-0032の将来配列契約にも未対応である。

空配列時はchipが0件になるだけで、empty message、skeleton、error、retryを表示しない。Employeeが削除/取得不能の場合も`...loading`が永続し得て、missing/staleを区別しない。

## actor・Rules・privacy

Site detailのclient guardは`sites:read`だけであり、employee本人、現場/配置管理者、他の同社roleをfield単位に区別しない。ただし`SiteEmployeeHistories`専用RulesがなくCompanies配下fallbackはsuper-userだけを許可するため、通常の同社認証Userによるqueryは拒否される実装である。UI permissionとFirestore enforcementが一致していない。

super-userはwhole historyをclient read/writeできる。通常User向けread projection/Callableはない。履歴documentにはemployeeId、siteId、初回/最終日時と境界OperationResult IDが含まれ、chipはEmployee documentから氏名/カナも取得する。

承認済み方針（CONF-0029）は次である。

- 本人は自己が入場した現場名、初回・最終入場日だけを本人確認済みCallable/projectionで閲覧する。
- 他従業員、顧客/取極め/請求、他配置者は見せない。
- 現場・配置管理者は同一会社履歴を閲覧できる。
- writeはFunctions-only、repairはOperationResultを正本とする監査付きprocessとする。

現行Site detailは本人projectionではなく「当該現場の全履歴」を描画する管理側候補UIである。具体permission未確定かつRules未実装のため、承認済み方針を満たすとは扱わない。

## stale・複数ID・整合性

- delete失敗を同期処理が吸収するとstale historyが残り、UIはstale表示を識別しない（FUT-0042）。
- Employee master削除/欠損時は履歴自体を除外せず、名称だけloading表示になる。
- schemaはfirst/last OperationResult IDをscalarで保持し、chipはIDを使わない。承認済みの境界日全ID配列へ移行しても、現行日付tooltipだけなら直接表示は維持できるが、複数ID navigationは未実装である。
- realtime subscriptionにより履歴更新は反映されるが、Employee displayName変更はfetch cacheの購読契約次第であり、このscopeでは未確認。

## loading・error・lifecycle

履歴subscriptionはmount/unmountで開始・解除される。route paramの同一component内変更をwatchせず、`siteId`もplain valueであるため、component再mountなしのparam変更では旧subscriptionを維持する候補である。Nuxtが当該route param変更で再mountするかはruntime未確認。

Employee fetchはchip watcherとpage callbackの両方から呼ばれるが共通cache/promise共有基盤により重複networkを抑える設計である。chipはfetch errorを直接表示せず、global logger/error store境界に依存する。

## 矛盾・未使用候補

- `sites:read`で表示するUIと、通常同社Userを拒否するRulesが不一致で、一般利用者からは機能未到達候補である。
- subtitleの「詳細表示」に対しtooltipは2日付だけでnavigationがない。
- `firstOperationResultId`/`lastOperationResultId`はこのUIでは未使用。
- data layerのoptional callbackは現callerで使用する。component/data layer自体は1 callerでありunusedではない。
- Site detailで設定したpage-level `fetchEmployee` callbackと各chipのwatcherが同じID取得を重ねる。

## 将来要対応・要確認事項

- FUT-0044へ、現行Site detailの`sites:read`対Rules拒否、全履歴UI、projection未実装の証拠を追記する。
- FUT-0042/0043のstale、並行性、境界ID配列課題はUI表示にも到達する。
- access/field ownership方針はCONF-0029で回答済み。具体permission名、projection/Callable API、保持期間はFUT-0044の実装詳細として残し、新規CONFは追加しない。

## 未確認範囲

- Firestore/Emulatorでのpermission error表示、初回loading、empty、large history件数のruntime。
- Nuxt route param変更時のcomponent再mount、Employee cacheの更新購読。
- 本人/管理者用の将来route/API、実role preset、実利用者・実data。
- SiteEmployeeHistory同期・repairの本文は`site-employee-history-sync.md`を参照し再調査していない。
