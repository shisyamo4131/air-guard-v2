# ADR 0073: 現場稼働予定を標準Managerと単純なRulesへ戻す

- 日付: 2026-09-14
- 状態: Accepted
- 対象: 現場稼働予定、配置作業員、配置通知、Domain Manager、Firestore Rules
- 関連仕様: [稼働予定・配置通知・上下番](../specification.md#稼働予定配置通知上下番)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 置換範囲: [ADR 0051](0051-site-mistaken-registration-archive-boundary.md)で通常の予定・通知保存へ広げたSite revision／live Site連動を置換し、[ADR 0071](0071-normal-business-manager-and-callable-boundary.md)と[ADR 0072](0072-transaction-delete-client-trigger-boundary.md)を予定へ具体化する

## 背景

現場稼働予定の通常保存は、以前は`AirItemManager`／`AirArrayManager`と`SiteOperationSchedule` modelが担っていた。その後、通常の作成・更新・削除、配置作業員、表示順、通知までを専用Manager、`saveOperation` Callable、Siteの`scheduleRevision`、複雑なRulesへまとめた。この構成は同じ保存条件を画面、Functions、Rulesへ重ね、配置管理と上下番確定の不具合を調べる前提も複雑にしていた。

利用者は、過去改修で安全側へ偏り過ぎた実装を戻し、Rulesを簡素化し、Air Manager時代の実装へ戻すよう明示した。まず通常保存の経路を復元し、その後に配置管理と上下番確定の各エラーを分けて調べる。

## 決定

- 単数の予定編集は`SiteOperationScheduleManager`／`AirItemManager`、一覧と並べ替えは`SiteOperationSchedulesManager`／`AirArrayManager`を使う。
- 作成・更新・削除・複製・配置作業員変更・表示順変更は、`SiteOperationSchedule` modelの標準保存を使う。通常保存を`saveOperation`へ送らない。
- 配置通知の作成はmodelの既存`notify()`を使う。通知documentの通常保存も同じtenant境界のclient保存を許可する。
- `SiteOperationSchedules`と`ArrangementNotifications`のRulesは、有効な本登録Userと同じ会社であることを通常のread/write境界とする。Siteの`scheduleRevision`更新、maintenance状態、live Site、field形状、実績化済み状態をRulesへ重複実装しない。
- 予定から実績への確定は、複数documentを同時に扱う既存処理を今回は維持する。配置管理と上下番確定で現在発生しているエラーは、復元完了後の別checkpointで再現して原因を直す。
- 旧`saveOperation`の予定分岐と専用補助codeは、復旧用の互換経路として直ちに削除しない。正規画面から到達しないことを確認し、後続で安全に整理する。

## 理由

通常の予定保存をmodelへ一本化すると、画面とserverで同じ処理を二重に持たずに済む。Rulesは会社境界を守る役割へ絞り、入力内容と業務上の状態判断は正規applicationとmodelへ戻せる。これにより、現在の配置管理と上下番確定のエラーを、通常保存経路の複雑さから切り離して調査できる。

## 代替案

- 専用Callableを維持して個別のエラーだけ直す案: 過剰な保存経路とRulesを残し、利用者が求めた復元にならないため採用しない。
- Rulesへmodelと同じfield検査をすべて書く案: 二重管理を再び作るため採用しない。
- 上下番確定まで同時にclient化する案: 複数documentの処理と現在の障害原因を混ぜるため、今回採用しない。

## 影響・互換性・移行

通常画面の見た目、Firestore path、document形状、schema package、既存dataは変更しない。data migrationは不要である。Site archiveは予定・通知の参照をserverで確認するが、確認と同時に通常client保存を完全に止めるrevision barrierは持たない。

同じ会社の有効Userが正規applicationを介さず直接書き込んだ場合、modelの入力確認や実績化済み予定の変更拒否を迂回できる余地が増える。これは、通常業務ではtenant内を信頼しmodelへ検査を集約するという承認済み方針に伴う既知riskであり、新しい安全保証とは扱わない。未認証、User不在、仮登録、無効User、claim不正、他tenantは引き続き拒否する。

## Rollback

この変更単位をrevertし、予定Manager、保存action、Rules、対応testを直前の`saveOperation`／Site revision境界へ一緒に戻す。data形状とmigrationを変更しないため変換は不要である。環境への反映とrollback実行は別承認を要する。

## 検証

- source contractで予定の単数・複数Manager、作業員編集、複製、配置actionがAir Managerとmodel保存へ接続され、正規callerが`saveOperation`を使わないことを確認する。
- Emulatorで同じ会社の有効Userによる予定・通知の作成・読取り・更新・削除を許可し、未認証・仮登録・無効User・他tenantとnested bypassを拒否する。
- 全domain test、全Local Emulator test、専用UI build、文書検査、差分検査を最終状態で実行する。
- Dev反映、正規画面での操作、配置管理と上下番確定の障害修正は後続checkpointとする。

## 再検討条件

tenant内の直接書込みが現実の事故原因になった場合、法令・契約上のfield単位保護が必要になった場合、またはmodelでは防げない具体的な同時更新・外部作用が確認された場合。再検討時は、発生した事実と必要な最小範囲を示し、通常保存全体を専用Callableへ戻さない。
