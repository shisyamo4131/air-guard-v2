# Notification作成認可とRecipients・Rules境界の実装調査

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-006 — Notification作成認可とRecipients/Rules境界
- 最終確認日: 2026-08-10
- 根拠ファイル: `air-guard-v2-schemas/src/Notification.js`、`air-guard-v2-schemas/src/NotificationRecipient.js`、同schemasの `index.js`、`firestore.rules` のhelper・ArrangementNotifications・Users・Companies配下fallback match、`functions/modules/utils/notifications.js` のonCreate入力部分、`functions/triggers/arrangementNotification.js` のtrigger条件、4件の `functions/modules/notifications/createNotificationFor*Arrangement.js` の対象選定・Notification作成部分、`functions/modules/auth-v2.js` の登録済みUser作成部分

この文書はNotification作成とRecipientsの信頼境界から観察できる実装事実を記録する。実token、環境値、実データを読み取らず、通知・Functions・Rules testを実行していない。producerの通知以外の業務ロジック、Rules全体、他モデルは調査していない。

## データ契約

### Notification

- 保存先は `Companies/{companyId}/Notifications/{notificationId}` で、会社prefixを使用するFireModelである。
- schema fieldは必須title・body、任意imageUrl・data・recipientUserIds、既定0のtotalCount・successCount・failureCount、既定 `pending` のstatus、sourceType・sourceId・createdByである。
- schema commentが列挙するstatusはpending、processing、sent、failed、completedである。server triggerの親Notificationはprocessing、completed、failedを使用し、sentはRecipients側で使用する。
- schema commentはsourceType例にmanual、arrangement、billingを挙げるが、確認した作成実装はarrangementだけである。

### NotificationRecipient

- 保存先は `Companies/{companyId}/Notifications/{notificationId}/Recipients/{recipientId}` である。
- `NotificationRecipient` はFireModelではなくBaseClassを継承し、notificationId、userId、status、sentAt、errorを定義する。
- status既定値はpendingで、server triggerがsentまたはfailedへ更新する。
- schema commentは「Cloud Functionsのみが作成・更新、アプリ側は読取り専用」と記載する。
- 実server triggerはrecipient User IDをRecipientsのdocument IDとして使用する。

### User document ID

- 管理者のCompany同時作成では、Authentication UIDを `Companies/{companyId}/Users/{uid}` のdocument IDとして明示指定する。
- 仮Userから本登録へ移行する `setupUserAccount` でも、認証済みrequestのUIDを本Userのdocument IDとして明示指定し、仮documentを削除する。
- 通知producerはUser query結果のdocument IDをrecipientUserIdsに入れ、配送triggerはrecipientUserIdをFcmToken.uidとして検索する。この経路では「本登録済みUser document ID = Authentication UID」を前提としている。
- User schema自体にはAuthentication UID fieldがなく、Users Rulesはdocument IDとAuth UIDの一致を強制しない。

## 作成経路

| 経路 | 起点 | Notification作成主体 | 宛先選定 | 入力・認可の直接確認 |
|---|---|---|---|---|
| 配置通知作成 | 同一会社のArrangementNotification document create | Firestore triggerのAdmin SDK | employeeId一致のUser document ID | ArrangementNotifications Rulesは同一会社の認証Userまたはsuper-userへread/writeを許可。role・field・shouldNotify検証なし |
| 配置確認 | ArrangementNotification statusがCONFIRMEDへ変化 | Firestore triggerのAdmin SDK | receiveConfirmedArrangementNotificationがtrueの同一会社User | 同上。before/after status変化だけを確認 |
| 上番 | statusがARRIVEDへ変化 | Firestore triggerのAdmin SDK | receiveArrivedArrangementNotificationがtrueの同一会社User | 同上 |
| 下番 | statusがLEAVEDへ変化 | Firestore triggerのAdmin SDK | receiveLeavedArrangementNotificationがtrueの同一会社User | 同上 |
| client直接作成 | Notifications pathへのclient write | client | clientがdocumentへ指定 | Notifications専用matchなし。Companies配下fallbackによりsuper-userだけread/write可能 |
| その他server | Admin SDKによるraw write | server code | server実装次第 | 確認範囲でarrangement以外の作成実装は見つからなかった |

- arrangement create triggerは `shouldNotify` が未指定ならtrueとして通知作成へ進む。
- arrangement update triggerはbeforeとafterのdata存在を確認し、特定statusへの遷移でproducerを呼ぶ。
- producerはAdmin SDKのraw `add` でNotificationを作成し、Notification schema instanceによるvalidationを使用しない。
- producerはNotificationのcreatedByを空文字にする。元の認証User・trigger eventのactor情報は保存しない。

## 認証認可表

| path・操作 | 未認証 | 同一会社の通常認証User | 他社の通常認証User | super-user | Admin SDK trigger |
|---|---:|---:|---:|---:|---:|
| `ArrangementNotifications` read/write | 拒否 | 許可 | 拒否 | 許可 | Rules非適用 |
| `Notifications` read/write | 拒否 | 拒否 | 拒否 | 許可 | Rules非適用 |
| `Recipients` read/write | 拒否 | 拒否 | 拒否 | 許可 | Rules非適用 |
| `Users` read/write | 拒否 | 同一会社なら許可 | 拒否 | 許可 | Rules非適用 |

- NotificationsとRecipientsに専用matchはない。
- `match /Companies/{companyId}/{collection}/{document=**}` のfallbackはsuper-userかつcollectionがSecurityReportIndexes以外の場合にread/writeを許可する。Notificationsと、その配下Recipientsはこのfallbackに一致する。
- Firestore RulesのmatchはOR評価されるため、親Company documentのallowはsubcollectionへ継承されない。Notifications/Recipientsへの通常会社Userの許可は確認できない。
- schema comment上の「アプリ側はRecipients読取り専用」に対し、Rulesは通常Userのreadも拒否し、super-userにはwriteも許可する。

## テナント境界

- 通常Userが直接writeできるArrangementNotificationsはcustom claimのcompanyIdとpath companyId一致を要求するため、通常Userから他社pathへの作成・更新は拒否される。
- super-userは全会社のArrangementNotifications、Notifications、Recipientsをread/writeできる。
- producerと配送triggerはevent pathのcompanyIdを使い、Employee、Site、Users、Notifications、Recipientsを同じ会社配下で参照する。
- FcmToken選定はrecipient User document IDとevent companyIdの両方でqueryするため、別companyIdのtokenは選ばない。
- Users Rulesは同一会社内の全User documentへread/writeを許し、role、対象User本人、document ID、fieldを制限しない。通知target設定fieldやUser document ID不変条件もRulesでは保護されない。

## トリガー信頼境界

### 間接作成

- 同一会社の任意の認証UserがArrangementNotificationをwriteできるため、そのdocumentがtrigger条件を満たすと、Admin SDKが権限を昇格してNotificationを作成する。
- createでは `shouldNotify` 未指定がtrueとなる。updateではCONFIRMED・ARRIVED・LEAVEDへのstatus変化が通知生成条件になる。
- RulesはArrangementNotificationの許可field、employeeId、siteId、status遷移、shouldNotify、actor roleを検証しない。
- producer側は参照先Employee/Site/Userの存在を一部確認するが、元writeのactor、role、所有関係を確認しない。
- 通常Userは他社へは送れないが、自社内で意図しない通知作成・状態通知・大量triggerを起こす候補がある。

### Notification onCreate

- onCreate triggerはrequest authを持たず、作成済みdocumentを信頼してAdmin SDKで処理する。
- title、body、imageUrl、data、recipientUserIdsをdestructureするだけで、型、長さ、許可field、status、source、createdBy、recipient件数を検証しない。
- recipientUserIdsは未指定時だけ空配列になる。配列であること、文字列User IDであること、重複、最大件数を検査しない。
- 各recipientが同じ会社の実在User documentかは送信前に確認する。実在しないIDにはtokenを割り当てない。
- dataの各値は送信前にStringへ変換するが、key allowlist、URL、document参照、サイズを検査しない。
- imageUrlはFCM notification payloadへそのまま渡す。scheme、host、長さのallowlistはない。
- title/body欠落や不正payloadがFCM errorとなった場合、配送側のerror分類・invalid-token削除へ影響する可能性がある。
- Recipients pending batchはrecipient数上限を事前検査しない。
- actorをNotificationに保存・検証しないため、後から元のclient write主体をNotificationだけで追跡できない。

### super-user直接作成

- super-userは任意会社pathへ任意Notification/Recipients documentをclientからwriteできる。
- Notification onCreateはsuper-user作成とserver作成を区別せず、同じ入力検証なしで配送する。
- super-userは仕様上の例外権限を持つが、任意payload・宛先・件数を許可することが承認済みの手動通知仕様かは未確認である。

## 仕様との一致

- Notificationが会社path配下、token選定がcompanyId付きであることは会社間分離を重視する仕様と整合する。
- clientが直接FCM送信せず、Admin triggerが対象Userのtokenを選んで送信する点は、clientだけで送信権限を完結させない仕様と一致する。
- RecipientsとNotificationへ送信結果を記録する構成は、通知成否追跡の仕様と整合する。
- 通常Userから他社pathへのArrangementNotification writeを拒否する点はtenant分離と整合する。
- 一方、同一会社の任意認証UserにArrangementNotification全field writeを許し、そのwriteからAdmin権限の通知作成へ進む点は、role・状態遷移・入力を検証するという安全要件を満たすと確認できない。
- schemaが示すRecipientsの「Functionsのみwrite、アプリread-only」と実Rulesは一致しない。

## 矛盾・未使用候補

- NotificationRecipient schema commentとRulesのread/write権限が不一致である。通常アプリはread不可、super-userはwrite可である。
- Notification schemaはmanual/billing sourceを例示するが、確認したFunctions producerはarrangementだけである。将来用または未使用候補であり、全呼出し元は未調査。
- 親Notificationのstatus候補にsentが記載されるが、確認したtriggerはcompletedを使用し、sentはRecipientで使用する。sentの親用途は未確認。
- producerはschema classを使わずraw addするため、schemaのrequired・field type定義はserver作成時の入力保証にならない。
- createdByは空文字固定で、schema上の作成者UID用途と一致しない。
- Users Rulesはregistered User document ID = Auth UIDというFunctions側の不変条件を強制しない。

## 仮説

- Notifications/Recipientsを通常Userから非表示にしsuper-userだけに許可するRulesは、画面で送信履歴をまだ提供していない段階の暫定制限の可能性がある。
- manual/billing sourceTypeと親status sentは将来機能を先行してschemaへ定義した可能性がある。
- ArrangementNotificationsの広いcompany-member writeは、従業員本人による状態更新と管理者による配置操作を同じRulesで扱った結果、notification producerの権限境界が広がった可能性がある。

## ユーザー確認済み方針

- 2026-08-11: 本人は自己配置連絡の確認・到着・上番・下番に必要な時刻・statusだけを変更できる。配置管理者は同一会社内で任意status・time・qualification・OJTを変更できる。Generatorは対象schedule所属通知だけをLEAVED化できる。
- その他fieldとnotification生成はdedicated server processingへ限定する。payload field allowlist・length・array count・URL validation、recipient/batch upper limits、actor・changedAt・before/after auditを必須とする。
- 配置管理者の具体的role名はauthorization design確定時に決め、当面はprovisional permissionを使う。
- 2026-08-11: Userは自分宛履歴だけ、配置管理者は同一会社の配置通知履歴・結果を閲覧できる。client direct Notification/Recipient CRUDは禁止し、resendはdedicated server process、super-user repairもreason・audit付き専用処理に限定する。
- 通知本文・結果は原則1年保持後に削除または匿名集計だけを残し、法令・契約上長期保持が必要な通知は別区分とする。
- 2026-08-11: registered User document ID = Auth UIDを必須とする。temporary Userは別state・identifierで明確化し、conversionはserver-onlyとする。companyId・role・admin・Auth linkはgeneral client変更不可とし、company adminのrole変更もtenant・actor・field検証Callableへ限定する。既存mismatchはmigration前にdetect・listする。

## 将来要対応

- FUT-0011へ、未検証Notification payloadが `invalid-argument` を誘発し、有効token削除候補へ接続する証拠を追記した。
- FUT-0012へ、未検証入力・大量recipient・actor不記録が再試行と監査を難しくする証拠を追記した。
- FUT-0015へ、recipientUserIdsの型・重複・上限未検証を追記した。
- FUT-0018として、ArrangementNotification writeからAdmin通知作成へ至る間接認可と入力validationを登録した。
- FUT-0019として、Notification/Recipients Rulesとschema契約の不一致を登録した。
- FUT-0020として、registered User document ID不変条件をRules・data validationで保護する課題を登録した。

## 質問

- 調査継続を妨げる質問はない。
- actor別のfield・status境界は確認済みである。配置管理者の具体的role名とpayload・recipient・batchの具体的上限値は未確定である。
- Notification/Recipientsの閲覧・write・repair・resend境界は確認済みである。配置管理者の具体的roleと長期保持通知区分は未確定である。
- title/body/imageUrl/data/recipient件数の制限と、許可するdestination data keyの仕様化が必要である。

## 未確認範囲

- ArrangementNotification schemaの全field・状態遷移method、画面操作、各roleの利用要件。
- Notifications/Recipientsを扱う未確認のUI、callable、producer、運用tool。
- FireModel/BaseClassのschema validationとraw Admin writeの関係。
- Firebase/FCMのpayload size、imageUrl、安全なdata key、Firestore batch上限の現在仕様。
- super-userの運用者、認証強度、監査log、手動通知要件。
- 実データ上のtemporary User、User ID不一致、重複recipient、大量宛先、任意payload。
