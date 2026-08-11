# Notification Functions deep review

- 状態: 実装調査（deep review）
- 対象セグメント: SPEC-DEEP-007
- 最終確認日: 2026-08-11
- 対象: notification producer 4 files、delivery utility 1 file

## ファイル別公開契約

| file / export | input・recipient・payload | side effects / caller | error・retry・idempotency・security |
| --- | --- | --- | --- |
| `createNotificationForArrangement.js` / `createNotificationForArrangement(arrangementData, companyId)` | employeeId一致の同社Users全doc ID。配置日body、arrangement/site/shift data | random-ID Notificationをraw Admin `add`。ArrangementNotification create triggerから到達 | Userなしはlogして成功return。その他throw。schema validation、actor、dedupe/idempotency keyなし |
| `createNotificationForConfirmedArrangement.js` / `createNotificationForConfirmedArrangement` | Employee/Site live名、`receiveConfirmedArrangementNotification == true` Users | status CONFIRMEDへのupdate triggerからrandom-ID Notification作成 | Employee/Site/Userなしはlogしてreturn。actor・入力allowlist・再実行抑止なし |
| `createNotificationForArrivedArrangement.js` / `createNotificationForArrivedArrangement` | 上記と同じ構造、ARRIVED opt-in | ARRIVED遷移からNotification作成 | 同上 |
| `createNotificationForLeavedArrangement.js` / `createNotificationForLeavedArrangement` | 上記と同じ構造、LEAVED opt-in | LEAVED遷移からNotification作成 | 同上 |
| `utils/notifications.js` | `sendNotification`、`sendMulticastNotification`、`sendBatchNotifications`、`onNotificationCreated`。local unexported `testNotification` | Admin FCM送信、Recipients/Notification status、invalid token delete | helper別error分類が不統一。delivery triggerは最外catchでstatus failedへ更新するが再throwせずplatform retryを要求しない |

## Producer flow・recipient境界

create producerだけが対象従業員のUserをemployeeIdで検索する。status producer 3種はEmployee/Siteをpoint fetchし、各受信設定がtrueの同社User全員を選ぶ。全producerは`createdBy: ""`、sourceType arrangement、sourceId arrangement document IDを保存するが、event ID、遷移revision、actor、recipient snapshot versionを持たない。

random IDの`add`であるため、producer triggerが同じeventを再実行すると別Notificationを作成し得る。status producerはbefore/afterだけで遷移を判定し、同じeventの処理済みledgerを持たない。missing master/recipientは例外でなく通知なしの成功として終了し、その結果記録も残さない。

## Delivery・token query・batch

`onNotificationCreated`はpath companyIdを使い、各recipient User documentの存在確認後、`FcmTokens`を`uid == user document ID`かつ同companyIdで逐次queryする。tokenをSetで重複排除し、FCM custom data valueをString化して全tokenへ同じpayloadを送る。

multicast helperは500 tokenごとに直列chunk送信し、tokenを含む全responseを返す。異なるmessageのbatch helperは先頭500件だけを送り、超過を黙って切り捨てる。Recipients pending/resultとtoken削除はFirestore batchだがrecipient数・invalid token数を500以下へchunk化しないため、大量recipient時はFirestore batch limit境界を越え得る。

## Error classification・delete

- multicastはnot-registered、invalid-registration-tokenに加え`invalid-argument`もinvalid tokenとして削除対象にする。payload全体の不正でもinvalid-argumentとなる場合、有効token削除候補である。
- batch helperはnot-registeredとinvalid-registration-tokenだけをinvalid扱いし、分類が一致しない。
- single helperは全errorを`{success:false,error:message}`へ吸収し、codeを返さない。
- chunk途中throw、Recipients更新、token削除、最終Notification更新の各境界で部分状態が残る。最外catchはNotificationをfailedへ更新するがthrowしない。failed status自体のupdateが失敗した場合はcatch内で再例外となり得る。

## User集計・duplicate ownership

Userは1 device以上successならsentとなる承認済み方針に沿う。実装はtoken→Userを単一値mapにするため、同じtokenが複数Userへ紐づく場合は最後のownerだけへresponseを割り当て、他ownerをfailedにする。重複をwarningするが結果補正しない。recipientUserIds自体の重複もRecipient docは同IDへ上書きする一方、total/failureは元配列長を使う。

## Logging・test handler・export boundary

emulator単体送信warningはtoken全文とpayloadを記録し、multicast完了時はresponse JSONとしてtoken全文をconsoleへ出す。mask helperも先頭8＋末尾8の可逆部分を残し、承認済みの不可逆hash先頭8文字方針ではない。local `testNotification` handlerはexportされないがmodule import時にonRequest objectを構築し、認証なし・query指定tenant/user・token全文log/responseを含む休眠危険コードである。

`sendNotification`と`sendBatchNotifications`のrepository callerは確認できない。plain helperはfunctions entryのstar export経由でmodule exportされるがFirebase deployment endpointとしての扱いはruntime未確認である。`onNotificationCreated`はentryからexportされるdeployed candidateである。

## Validation・auth・tenant

deliveryはFirestore triggerでrequest authを持たず、作成済みNotificationを信頼する。title/body/data/imageUrl/recipient配列の型、長さ、key/URL allowlist、件数上限、status/source/actorを検証しない。Userとtokenはpath companyに絞るが、Notificationを作成可能な上流Rules/producerの安全性へ依存する。Admin SDK write/deleteはRulesを迂回する。

## Tests・FUT/CONF統合

5対象fileのhelper/triggerを直接検証するrepository testは確認できなかった。既存FUT-0009、0011〜0015、0018/0019、0152/0153と通知関連CONFへ統合し、新規FUT/CONFは追加しない。

## 未確認範囲

- Firebase公式error codeの実payload別発生、platform retry option、deploymentでplain exportを扱う挙動
- Emulator/DEVのFCM送信、500/501 recipient・token、chunk途中failure、duplicate event
- 実token、実Notification、外部通知、監視・retention・manual retry
