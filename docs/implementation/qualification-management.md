# Qualification（資格）管理実装調査

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-036
- 最終確認日: 2026-08-11
- 根拠ファイル: schemas `Certification.js`、`Employee.js`、`OperationDetail.js`、`SiteOperationSchedule.js`、`ArrangementNotification.js`、`OperationResult.js`、certification-type constants/field definition、`pages/employees/[id].vue`、`components/Employee/Certifications/`、`Employee/Activator/SecurityGuard.vue`、予定・通知・実績の資格flag直接UI、`firestore.rules`、`utils/pageSettings.js`

## 責務・識別

独立したQualification master/documentは存在しない。資格種別は固定enum、個々の保有資格はEmployee document内の`securityCertifications[]`へ`Certification` subobjectとして埋め込む。配列item keyは資格名そのもの (`key === name`) である。

配置・通知・実績が使うのは資格ID/typeではなく、予定全体の`qualificationRequired` booleanとworker明細の`isQualified` booleanである。Employeeの保有資格配列から`isQualified`を自動導出する実装は確認できない。

## 入口・権限

従業員詳細pageの「保有資格」cardがAirArrayManagerで配列のcreate/update/deleteを行い、submit完了後にEmployee document全体を`update()`する。従業員詳細pageは`employees:read`で到達する暫定設定で、編集用permissionはpageSettings上分離されない。

Firestore Rulesは同一companyの全認証Userまたはsuper-userへEmployee/Employee_archive全field read/writeを許可する。資格専用Rules、操作別role、field制約はない。

## データ契約

| 対象 | field・契約 |
|---|---|
| Certification | `name`必須、`type`必須、`issuedBy`、`issueDateAt`必須、`expirationDateAt`任意、`serialNumber` |
| 読み取り専用property | `key`は`name`をそのまま返す |
| enum | FACILITY、TRAFFIC、CROWD、VALUABLES、BODYGUARD、OTHER |
| Employee保持 | `securityCertifications` array、customClass Certification |
| 稼働要件 | Operation `qualificationRequired` boolean |
| worker適用 | OperationDetail `isQualified` boolean |

資格level（1級/2級）、資格ID、発行地域、対象業務詳細、取消/停止status、確認者、証憑画像はない。警備員登録情報 (`hasSecurityGuardRegistration`、登録日、緊急連絡先、本籍等) は別Employee field群であり、個別Certificationとは連動しない。

## CRUD・validation

資格配列Managerはschema Certification、item-key `key`を使い、追加と更新を公開する。tableに明示delete actionはなく、AirArrayManager editor内部のdelete可否は未確認。Employee updateが配列全体を保存する。7 componentの公開契約・caller・表示境界のfile単位確認は[Employee certification / custom-input components deep review](employee-certification-components-deep-review.md)を参照する。

schemaはname/type/issueDateAt必須とtype select optionsを提供するが、name重複、serial重複、issueDate<=expirationDate、未来取得日、文字形式、typeとname整合を独自に検証しない。keyがnameなので改名はidentity変更となる。

## 従業員保持

資格はEmployee documentの個人情報と同じread/write単位に埋め込まれる。別collection/query indexはなく、資格type・期限で全従業員を検索する直接実装は確認できない。同時に別のEmployee fieldを編集するとdocument全体更新の競合境界を共有する。

## 期限・状態

tableは取得日と有効期限をJST日付表示し、期限なしは`-`とする。現在日時との比較、expired/expiring soon status、失効除外、更新通知、更新履歴はない。有効期限切れでも資格配列に残り、配置用`isQualified` booleanへ自動影響しない。

## 配置・実績参照

予定は現場単位の`qualificationRequired`とworkerごとの`isQualified`を手入力/snapshotする。ArrangementNotificationでも`isQualified`を編集可能で、表示・Generatorは通知値を予定worker値より優先する。Generatorは要資格予定に対してeffective `isQualified` workerが1人もいなければ警告文言を出すが、Employee certifications/type/expiration/登録状態を検証しない。

SiteOperationScheduleの実効worker変換は通知があればnotification.isQualified、なければ予定worker.isQualifiedをOperationResult detailへ渡す。したがって実績・後続資格者区分はboolean snapshotであり、資格ID、名称、type、番号、期限、判定根拠を保存しない。

## Rules・security

tenant claimによるcompany path分離はあるが、同社Userは資格だけでなくEmployeeの本籍、緊急連絡先等を含むdocument全体をread/writeできる。資格番号/発行情報も個人情報として同じ境界にある。Rulesは埋込み配列の型・許可field・actor・期限を検証しない。

## 矛盾・未使用候補

- Certification Tableは必須`type`を列表示せず、`components/Employee/CustomInput/SecurityGuard.vue`は空で静的callerもない。
- Certification modelの説明は「資格名が重複しない想定」とし、2byte名をkeyにする妥当性を未決のまま記す。
- `type`と期限を保持するが、配置判定は無関係なmanual booleanだけで行う。
- `qualificationRequired`は必要な資格種別/levelを表せず、任意のisQualified=trueで要件充足となる。
- Generatorのaction buttonはinvalid時にerror色/文言を出すが、確認した直接範囲ではdisabled属性を設定しない。
- 警備員登録済みか、資格保有/有効か、配置上資格者かが独立し、整合検査がない。

## 将来要対応

FUT-0124〜FUT-0126を`future-actions.md`へ追加した。

## 要確認事項

CONF-0103〜CONF-0105を`pending-confirmations.md`へ追加した。

## 未確認範囲

AirArrayManager内部delete/duplicate validation、Employee全体、予定/実績保存本文、請求計算、実データ、remote Rules、資格証画像は未確認である。
