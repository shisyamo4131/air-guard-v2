# ADR 0067: Component階層、useFetch、表示正本、従属参照境界

- 日付: 2026-09-09
- 状態: Accepted
- 対象: page/component構成、`useFetch` provide/inject、表示data、従属先存在確認、物理削除
- 関連仕様: [Pageとcomponentの構成](../specification.md#pageとcomponentの構成)、[表示dataと従属参照](../specification.md#表示dataと従属参照)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 既存判断との関係: ADR 0046・0051・0060が採用したCustomer／Site等の参照作成barrierは、今回の原則より厳格な既存例外として直ちに撤去しない。維持または簡素化は各機能checkpointで明示する。

## 背景

業務pageへ取得・編集・表示責務が集積すると、画面配下で共有すべき従属先cacheの起点が曖昧になる。AirGuardV2には`composables/fetch/useFetch.js`があり、`isOrigin=true`ではArticle、Customer、Employee、Outsourcer、Site用composableを新規作成してprovideし、通常呼出しでは親からinjectし、存在しなければ新規作成してprovideする。

利用者は、pageから画面root、rootから機能componentを構成し、従属先の名称等を`useFetch`で解決する原則を定めた。また、主対象documentは複数利用者の変更へ追随する一方、従属先の補完表示は`useFetch` cacheを優先してよいと明確化した。従属先存在確認は通常CRUへ広げず、物理削除時の限定的な確認と不足時UIで扱う。

## 決定

### ComponentとuseFetch

- 認証済み業務pageは、原則として画面全体を制御する一つのroot componentを直接配置し、そのrootが一つ以上の機能単位の子componentを構成する。pageはroute parameter、metadata、layoutとroot接続へ責務を絞る。
- pageは`useFetch(componentName, true)`を一度呼び、画面配下専用のfetch composable群をprovideする。子componentとそのcomposableは`useFetch(componentName)`を呼び、injectされた同じinstanceとcacheを使う。
- `isOrigin=false`時にproviderがなければinstanceを生成する現行fallbackは、componentの独立利用に必要な互換経路として残せる。ただし通常pageのroot設置忘れを前提にしない。
- 単純な認証、案内、error page等で階層化が価値を持たない場合は、改修checkpointで例外理由を示す。意味のないwrapperだけを増やすことを要求しない。

### 表示data

- 画面の主対象である変更可能なFirestore documentはreal-time listenerから受信した現在値を正本とする。
- IDから名称等を補完する従属先情報は`useFetch`の共有cacheを優先でき、画面内の各参照へreal-time listenerを必須にしない。cache取得後の従属先変更が直ちに反映されないことを受容する。
- 認証・tenant scopeをまたぐcache再利用は認めない。従属先が不存在または取得不能なら画面全体をerrorにせず、該当箇所を「取得できなかった」旨へ置き換える。別documentの値を推測せず、正常な空値と取得失敗を区別する。
- 確定済み履歴・帳票等の意図的snapshotは現在masterの代替ではなく、確定時点の事実として維持できる。

### 従属先存在確認と物理削除

- 従属documentのcreate・read・updateでは、従属先documentの存在確認を既定にしない。候補UIのfilterは保証境界ではない。
- 従属先documentの物理削除では、操作時点に既知の従属documentを確認し、存在、検査失敗、対象不整合では削除を中断する。
- 従属側CRUとのlock、tombstone、transactional barrierは既定にしない。検査直前または同時の従属作成による参照不整合は保証対象外とし、強い参照整合性を保証したとは表示しない。
- 金銭確定、identity、archive・復旧、順序依存状態等に確認済みのより厳格な不変条件がある場合は、個別仕様を例外として維持できる。既存のCustomer／Site参照barrierを本ADRだけで一括撤去しない。

## 理由

pageを薄い接続層にし、画面単位の`useFetch` instanceを共有すれば、同じ従属先の重複取得とcomponent間のcache不一致を抑えられる。主対象だけをlistener正本とし、補完情報はcacheを優先することで、同時利用への追随と読取・listenerコストを分離できる。

従属側CRUで毎回存在確認を行わない方式は、強い参照整合性より実装・保守コストと応答性能を優先する明示的なtrade-offである。物理削除時の確認と欠落時UIにより通常運用の被害を限定するが、競合による孤立参照を完全には防止しない。

## 影響と現行実装差

- `useFetch.js`のorigin／inject／fallback構造は新ルールと整合する。現行pageにはoriginを設けているものと設けていないものがあり、component階層も一様ではないため、各機能checkpointで整理する。
- `useFetchEmployee`はdocument listenerとscope generationを持つ一方、Customer、Site、Outsourcer、Articleは主にone-shot cacheを使う。従属先補完としては許容されるが、主対象表示に使う場合は別のlistenerが必要である。
- 現在の欠落・取得失敗表示はcomponentごとに「不明」、空文字等へ分かれており、「取得できなかった」旨を一貫して区別できるとは未確認である。
- Customer／Site archiveとEmployeeの計画には従属writer側の存在barrierがある。これらは現在の安全な実装を壊さず、対象機能checkpointで例外維持または簡素化と回帰範囲を決める。
- 今回はapplication、Functions、Rules、schema、data、Dev・Prodを変更しない。

## 移行

Customer、Site、Employee、Outsourcer、その他transaction系の各checkpointで、page/root/child、`useFetch` origin、主対象listener、従属cache、missing表示、従属CRUと削除側検査を一つずつ棚卸しする。機能挙動を一括変更せず、既存のより厳格な参照barrierを外す場合は、対象writer、残存risk、rollback、陰性testを別途提示して承認を得る。

## rollback

今回の文書変更は通常のGit revertで戻せる。将来のcomponent／fetch変更は対象機能commitを戻し、主対象listenerとtenant scope分離を失わないことを確認する。参照barrierを撤去した後に生じた孤立参照はcode revertだけで修復できないため、data変更が必要なら別承認の診断・補正を行う。

## 検証

- pageごとにroot componentが一つあり、画面機能が子componentへ分割されていることを確認する。
- pageのorigin instanceと子のinjected instanceが同一で、画面間またはtenant間でcacheを共有しないことを確認する。
- 主対象listener更新、従属cache hit・miss・not-found・permission/network error、scope変更、画面全体が継続表示される欠落fallbackを確認する。
- 物理削除は従属あり・検査失敗でwrite 0、従属なしで許可されることを確認する。競合raceは保証対象外であることをtest名・説明で偽らない。
- 既存の厳格な参照barrierを変更するcheckpointでは、該当するsource contract、Rules／Functions、Emulator、rollback、Dev受入れを変更classに応じて追加する。

## 再検討条件

孤立参照が実運用で無視できない頻度または影響となった場合、法令・請求・監査上の強い整合性が必要になった場合、従属先名称の即時反映が業務要件になった場合、または`useFetch` cacheのscope分離・欠落状態を共通実装できない場合。
