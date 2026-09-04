# 配置管理の表示順行削除UXロードマップ

- 状態: Proposed / Planned（詳細受入条件と実装checkpointの承認待ち）
- 優先度: Medium
- 開始日: 2026-09-04
- 現在の進捗: 0%
- 部分加点: なし
- 完了条件案: 配置管理の表示順行削除で、操作直後から対象行の待機状態を表示し、同じ`siteOrder`への変更を一時停止し、live Companyから対象行が消えるまで完了表示へ移らない。失敗・timeoutから最新live dataに基づいて明示再試行でき、自動test、Codex専用local UI、独立review、文書・Git統合、別途承認するbounded Dev反映と利用者受入れを完了する。
- 確認済み要件の唯一の正本: [現行仕様のCompany表示順契約](../specification.md#company設定とtenant-lifecycle)
- この文書の位置づけ: 利用者観測と静的事実に基づく実行計画案。詳細受入条件は未承認であり、現行仕様を追加・変更しない。

## 承認境界

2026-09-04に利用者が承認したのは、観測の記録と専用roadmapの追加までである。下記の詳細受入条件、実装方法、test、local UI、Dev反映は未承認であり、ARU-01の実装checkpointで仕様との整合、対象file、環境、data、期待結果、停止条件を示して別途承認を得る。今回のsubagentはapplication、Functions、Firestore Rules、test code、build、local UI、Dev/Prod、remote/data、migration、package、Git操作を実行しない。document差分のGit統合は検証後にcoordinatorが判断できる。

## 対象と対象外

- 対象は配置管理で`siteOrder`の表示順entryを1行削除する操作だけとする。
- SiteやSchedule documentの削除、`scheduleOrder`の削除UX、schema・Rules・migration、generic UI全体の作り直しは対象外とする。
- 現行の回避策として、操作後に反映を待てば削除は完了するため、後続実装までその運用を許容する。削除完了前の再click、tap、Enterは避ける。

## 観測と静的事実

- 確認済みの利用者観測: 行削除は最終的に成功するが、待機中であることが画面に見えず、反応がないように見えるため同じ操作を繰り返すriskがある。現時点では待って確認する回避策を許容できる。
- 確認済みの静的実装事実: 共通の表示順更新actionは`isSaving`によるsingle-flightを持ち、配置管理と共有tableは保存中の関連操作をdisabledにする。Callable完了時に`isSaving`が解除され、Companyのlive `siteOrder`から対象entryが消えたことを待つ専用状態はない。
- 静的推論: Callableの成功応答がlive Company反映より先になる場合、行が一時的に残ったまま再度操作可能になる表示gapが成立し得る。実際のbrowser timing、再操作によるcall回数、発生頻度は未検証であり、利用者観測の原因とは断定しない。

## 受入条件案（未承認）

以下は実装範囲と検証可能性を具体化する提案であり、確認済み仕様ではない。ARU-01で利用者承認を得るまでapplication・testの実装根拠にしない。

- 操作開始と同期して対象行をpendingにし、spinnerまたは同等の視覚表示と、支援技術へ伝わるaccessibility状態・文言を示す。
- pending中は削除、drag、並べ替え、保存、取消、再読込を含む同じ`siteOrder`への全mutationを停止する。他の期間・予定・配置内容の閲覧など無関係な閲覧は継続できる。
- click、tap、Enterのどれでも1回の利用者actionにつきCallableは1回だけ実行する。連続入力や入力方法の混在でも追加callを発生させない。
- Callable成功だけでは完了にせず、最新live Companyの`siteOrder`から対象entryが消えたことを確認してpendingを解除する。
- Callable失敗、permission/network error、またはlive反映timeoutでは対象行を残し、最新live dataを再取得・照合したうえで明示的に再試行できる。成功と誤表示せず、同じ失敗操作を自動再送しない。
- 2行を扱う場合も、進行中は同じ`siteOrder`のmutationを直列化し、完了後は最新live dataに存在する別行だけを操作できる。
- 共有実装を利用する`/operation-schedules`で、既存の表示順削除・保存・disabled・閲覧に直接回帰がないことを確認する。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| ARU-01 現行経路・状態設計・失敗境界 | 15 | 0 | Not started | action、配置管理、共有table、live listenerの設計review、詳細受入条件と実装checkpointの利用者承認 |
| ARU-02 行pending・single-flight・live反映待機 | 35 | 0 | Not started | 対象行表示、同一`siteOrder` mutation停止、1 action 1 call、成功・失敗・timeout・再試行の実装 |
| ARU-03 自動回帰test | 25 | 0 | Not started | double click/tap/Enter、slow call、delayed listener、permission/network failure、retry、2行、`/operation-schedules`回帰 |
| ARU-04 Codex専用local UI | 10 | 0 | Not started | loopback・合成dataでpending、accessibility、閲覧継続、成功・失敗・retryを確認 |
| ARU-05 最終review・文書・Git・bounded Dev受入れ | 15 | 0 | Not started | 独立review、最終gate、文書・Git統合、別途承認したDev反映と利用者受入れ |

重み合計100。各マイルストーンの完了証拠がすべて揃った場合だけ加点し、部分加点しない。このroadmapの作成は製品runtimeの変更または受入完了を意味しない。

## 検証計画

- 想定する影響classはUIとapplication logic。後続実装時はproject verification policyから最終対象fileに対応するgateを選び、直接対象test、共有`/operation-schedules`回帰、local UI、最終差分のcompletion gateを実行する。
- 自動testはdouble click、tap、Enter、slow Callable、Callable成功後のlistener遅延、permission/network failure、timeout、最新live dataからのretry、2行、無関係な閲覧継続を含める。
- Codex専用local UIでは合成dataとloopback環境だけを使用する。利用者Chrome、Dev/Prod、remote account・session・dataは扱わない。
- bounded Dev反映と利用者受入れでは、対象commit、環境、data、実施者、期待結果、停止条件、cleanupを別途承認する。browser timingと実dataでの再現性はそれまで未確認とする。

## 互換性・移行・rollback

`siteOrder`のshape、Callable request、permission、Site・Schedule、保存順の意味は変更しない計画とする。schema、Rules、data migrationは不要であり、必要性が判明した場合はこのscopeを停止して別のmaterial changeとして確認する。

後続実装のrollbackは、新しいpending・live反映待機・retry UIをrevertし、現行の共通`isSaving`と待って確認する回避策へ戻す。remote dataを巻き戻したり、表示順entry以外を削除したりしない。

## 未確認・次工程

- browser上のCallable応答とlive listener反映の実順序、gapの継続時間、二重入力時のcall数、permission/network failure時の現表示。
- `/operation-schedules`を含む共有componentへの具体的な影響fileと、最終verification policy選択。
- ARU-01を開始する前に、対象component、pending表示文言、timeout、retry操作、test fixture、local UI範囲を実装checkpointとして確認する。
