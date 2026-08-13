# 要確認事項 dependency / reconciliation map

- 状態: 台帳再照合
- 対象チェックポイント: SPEC-RECONCILE-001
- 最終確認日: 2026-08-12
- 根拠: `pending-confirmations.md`全138件、`future-actions.md`の関連CONF/判断欄、各CONFが直接指定するimplementation文書の該当section、coverage索引
- 制約: 新規実装調査、runtime、外部環境、実dataは確認していない。ユーザー回答、既存ID、既存Statusは変更していない。

## disposition contract

| Disposition | 意味 |
| --- | --- |
| Answered | ユーザー回答済み。Answerを保持し再質問しない。 |
| Open-user-decision | 実装事実だけでは確定できない利用者判断。canonical group単位で提示する。 |
| Open-deferred | ユーザーが保留した。再開指示まで推奨案を採用しない。 |
| Resolved-by-implementation-fact | 実装事実だけで質問前提が解消し、設計承認を要しない。 |
| Merge-candidate | 上位CONFの回答へ統合でき、個別質問を避ける候補。ID/本文は履歴として保持する。 |
| Implementation-detail-no-user-question | 製品判断でなくFUTで管理する実装詳細。 |
| Blocked-by-uninvestigated | 未調査のため分類できない。 |

`canonical=SELF`は当該CONFのQuestionをcanonical questionとして維持する。`superseded-by`は削除や回答済み化ではなく、次回提示を上位IDへまとめる関係である。

## 全ID disposition

| ID | Disposition | canonical / superseded-by |
| --- | --- | --- |
| CONF-0001 | Open-user-decision | SELF |
| CONF-0002 | Answered | SELF |
| CONF-0003 | Answered | SELF |
| CONF-0004 | Answered | SELF |
| CONF-0005 | Answered | SELF |
| CONF-0006 | Answered | SELF |
| CONF-0007 | Answered | SELF |
| CONF-0008 | Answered | SELF |
| CONF-0009 | Answered | SELF |
| CONF-0010 | Answered | SELF |
| CONF-0011 | Answered | SELF |
| CONF-0012 | Answered | SELF |
| CONF-0013 | Answered | SELF |
| CONF-0014 | Answered | SELF |
| CONF-0015 | Answered | SELF |
| CONF-0016 | Answered | SELF |
| CONF-0017 | Answered | SELF |
| CONF-0018 | Answered | SELF |
| CONF-0019 | Open-user-decision | SELF; depends-on CONF-0111, CONF-0033 |
| CONF-0020 | Answered | SELF |
| CONF-0021 | Open-deferred | SELF; depends-on CONF-0033, CONF-0134 |
| CONF-0022 | Answered | SELF |
| CONF-0023 | Answered | SELF |
| CONF-0024 | Answered | SELF |
| CONF-0025 | Answered | SELF |
| CONF-0026 | Answered | SELF |
| CONF-0027 | Answered | SELF |
| CONF-0028 | Answered | SELF |
| CONF-0029 | Answered | SELF |
| CONF-0030 | Answered | SELF |
| CONF-0031 | Answered | SELF |
| CONF-0032 | Answered | SELF |
| CONF-0033 | Open-deferred | SELF |
| CONF-0034 | Answered | SELF |
| CONF-0035 | Open-deferred | SELF; depends-on CONF-0033 |
| CONF-0036 | Answered | SELF |
| CONF-0037 | Answered | SELF |
| CONF-0038 | Answered | SELF |
| CONF-0039 | Answered | SELF |
| CONF-0040 | Answered | SELF |
| CONF-0041 | Answered | SELF |
| CONF-0042 | Answered | SELF |
| CONF-0043 | Answered | SELF |
| CONF-0044 | Answered | SELF |
| CONF-0045 | Answered | SELF |
| CONF-0046 | Answered | SELF |
| CONF-0047 | Answered | SELF |
| CONF-0048 | Answered | SELF |
| CONF-0049 | Merge-candidate | superseded-by CONF-0043, CONF-0045, CONF-0048 |
| CONF-0050 | Merge-candidate | superseded-by CONF-0044, CONF-0047 |
| CONF-0051 | Open-user-decision | SELF; depends-on CONF-0111 |
| CONF-0052 | Open-user-decision | SELF; depends-on CONF-0134 |
| CONF-0053 | Open-user-decision | SELF; depends-on CONF-0054 |
| CONF-0054 | Open-user-decision | SELF; depends-on CONF-0044 |
| CONF-0055 | Open-user-decision | SELF |
| CONF-0056 | Merge-candidate | superseded-by CONF-0111 |
| CONF-0057 | Open-user-decision | SELF |
| CONF-0058 | Open-user-decision | SELF; depends-on CONF-0031 |
| CONF-0059 | Open-user-decision | SELF; depends-on CONF-0012, CONF-0030 |
| CONF-0060 | Open-user-decision | SELF |
| CONF-0061 | Merge-candidate | superseded-by CONF-0111, CONF-0115 |
| CONF-0062 | Open-user-decision | SELF; depends-on CONF-0014 |
| CONF-0063 | Open-user-decision | SELF |
| CONF-0064 | Open-user-decision | SELF; depends-on CONF-0043, CONF-0123 |
| CONF-0065 | Open-user-decision | SELF |
| CONF-0066 | Merge-candidate | superseded-by CONF-0111, CONF-0129 |
| CONF-0067 | Open-user-decision | SELF |
| CONF-0068 | Open-user-decision | SELF; depends-on CONF-0062, CONF-0063 |
| CONF-0069 | Open-user-decision | SELF; depends-on CONF-0129 |
| CONF-0070 | Merge-candidate | superseded-by CONF-0111 |
| CONF-0071 | Open-user-decision | SELF |
| CONF-0072 | Open-user-decision | SELF; depends-on CONF-0123 |
| CONF-0073 | Open-user-decision | SELF |
| CONF-0074 | Merge-candidate | superseded-by CONF-0111, CONF-0129 |
| CONF-0075 | Open-user-decision | SELF; depends-on CONF-0123, CONF-0127 |
| CONF-0076 | Open-user-decision | SELF |
| CONF-0077 | Merge-candidate | superseded-by CONF-0044 |
| CONF-0078 | Open-user-decision | SELF; depends-on CONF-0115 |
| CONF-0079 | Open-user-decision | SELF; depends-on CONF-0080, CONF-0130 |
| CONF-0080 | Merge-candidate | superseded-by CONF-0111, CONF-0129 |
| CONF-0081 | Open-user-decision | SELF |
| CONF-0082 | Open-user-decision | SELF; depends-on CONF-0114 |
| CONF-0083 | Open-user-decision | SELF; depends-on CONF-0128 |
| CONF-0084 | Merge-candidate | superseded-by CONF-0111, CONF-0129 |
| CONF-0085 | Open-user-decision | SELF |
| CONF-0086 | Open-user-decision | SELF |
| CONF-0087 | Open-user-decision | SELF; depends-on CONF-0085, CONF-0086 |
| CONF-0088 | Open-user-decision | SELF |
| CONF-0089 | Merge-candidate | superseded-by CONF-0111 |
| CONF-0090 | Open-user-decision | SELF; depends-on CONF-0123 |
| CONF-0091 | Open-user-decision | SELF |
| CONF-0092 | Open-user-decision | SELF; depends-on CONF-0115 |
| CONF-0093 | Open-user-decision | SELF |
| CONF-0094 | Open-user-decision | SELF |
| CONF-0095 | Open-user-decision | SELF; depends-on CONF-0114 |
| CONF-0096 | Open-user-decision | SELF |
| CONF-0097 | Open-user-decision | SELF; depends-on CONF-0095 |
| CONF-0098 | Open-user-decision | SELF |
| CONF-0099 | Open-user-decision | SELF; depends-on CONF-0114 |
| CONF-0100 | Merge-candidate | superseded-by CONF-0041, CONF-0042, CONF-0043 |
| CONF-0101 | Open-user-decision | SELF; depends-on CONF-0134 |
| CONF-0102 | Merge-candidate | superseded-by CONF-0044 |
| CONF-0103 | Open-user-decision | SELF; depends-on CONF-0057 |
| CONF-0104 | Open-user-decision | SELF |
| CONF-0105 | Merge-candidate | superseded-by CONF-0061, CONF-0111 |
| CONF-0106 | Open-user-decision | SELF |
| CONF-0107 | Open-user-decision | SELF; depends-on CONF-0106, CONF-0134 |
| CONF-0108 | Merge-candidate | superseded-by CONF-0111 |
| CONF-0109 | Open-user-decision | SELF; depends-on CONF-0026 |
| CONF-0110 | Open-user-decision | SELF |
| CONF-0111 | Open-user-decision | SELF |
| CONF-0112 | Open-user-decision | SELF; depends-on CONF-0111 |
| CONF-0113 | Open-user-decision | SELF; depends-on CONF-0111, CONF-0014 |
| CONF-0114 | Open-user-decision | SELF |
| CONF-0115 | Open-user-decision | SELF; depends-on CONF-0007 |
| CONF-0116 | Open-user-decision | SELF; depends-on CONF-0114 |
| CONF-0117 | Open-user-decision | SELF; depends-on CONF-0119 |
| CONF-0118 | Open-user-decision | SELF; depends-on CONF-0119 |
| CONF-0119 | Open-user-decision | SELF |
| CONF-0120 | Open-user-decision | SELF; depends-on CONF-0061, CONF-0115 |
| CONF-0121 | Merge-candidate | superseded-by CONF-0043 |
| CONF-0122 | Open-user-decision | SELF; depends-on CONF-0123, CONF-0130 |
| CONF-0123 | Open-user-decision | SELF |
| CONF-0124 | Open-user-decision | SELF |
| CONF-0125 | Open-user-decision | SELF; depends-on CONF-0124, CONF-0130 |
| CONF-0126 | Open-user-decision | SELF; depends-on CONF-0115, CONF-0124 |
| CONF-0127 | Merge-candidate | superseded-by CONF-0111, CONF-0129 |
| CONF-0128 | Open-user-decision | SELF; depends-on CONF-0129, CONF-0130 |
| CONF-0129 | Open-user-decision | SELF; depends-on CONF-0111 |
| CONF-0130 | Open-user-decision | SELF; depends-on CONF-0124, CONF-0129 |
| CONF-0131 | Open-user-decision | SELF; depends-on CONF-0111, CONF-0115 |
| CONF-0132 | Open-user-decision | SELF; depends-on CONF-0111 |
| CONF-0133 | Open-user-decision | SELF; depends-on CONF-0111, CONF-0115 |
| CONF-0134 | Open-user-decision | SELF; depends-on CONF-0039 |
| CONF-0135 | Open-user-decision | SELF; depends-on CONF-0048, CONF-0057 |
| CONF-0136 | Open-user-decision | SELF; depends-on CONF-0128, CONF-0129 |
| CONF-0137 | Open-user-decision | SELF |
| CONF-0138 | Open-user-decision | SELF |

## canonical dependency groups

| group | canonical CONF | members / relation | 1回答で整理できる範囲 |
| --- | --- | --- | --- |
| G-AUTHZ | CONF-0111 | 0019, 0051, 0056, 0061, 0066, 0070, 0074, 0080, 0084, 0089, 0100, 0105, 0108, 0112, 0113, 0127, 0129, 0131〜0133, 0136 | 正式role/permission matrixを先に定め、domain別actorは差分だけ残す。Callable/App Checkは0129を併用する。 |
| G-ARCHIVE | CONF-0123 | 0043, 0045, 0048, 0049, 0064, 0072, 0075, 0090, 0100, 0121, 0122 | 共通metadata・保持・exceptional restoreを上位化し、master固有の終了状態だけを分離する。 |
| G-SNAPSHOT | CONF-0044 | 0047, 0050, 0054, 0077, 0102 | 正式発行snapshotの承認済み原則を再利用し、OperationResult再適用等の業務差分だけ残す。 |
| G-BILLING | CONF-0033 | 0019, 0021, 0035, 0052〜0054, 0101, 0134 | invoice-issued境界を先に確定し、lock/payment/adjustment/roundingを順に決める。0033/0035/0021の保留は維持する。 |
| G-SCHEDULE | CONF-0057 | 0056〜0060, 0103, 0108, 0133, 0135 | 同時編集・状態/修復を基準に、資格/OJT、帳票、自動終了の差分へ展開する。 |
| G-PEOPLE | CONF-0062 | 0061〜0065, 0071〜0073, 0104〜0109, 0120 | User/Employee identityと雇用・外注・資格/OJT/個人情報を分離しつつ順序付ける。 |
| G-ONBOARDING | CONF-0067 | 0062, 0066〜0069, 0113, 0129 | account setup、identity、anonymous boundary、claims反映を一連のlifecycleとして扱う。 |
| G-MAINTENANCE | CONF-0081 | 0075, 0079〜0082, 0127, 0130, 0135 | fail-open/closedと復旧経路を先に決め、実行actor・metadata・scheduled処理へ展開する。 |
| G-SUBSCRIPTION | CONF-0083 | 0084〜0087, 0128〜0130 | deployment surfaceを起点にactor、identity、status、checkout成功条件を決める。 |
| G-REPORT | CONF-0088 | 0089〜0092 | SecurityReportの製品責務を先に決めてactor、保持、画像、署名/改訂を決める。 |
| G-SHARED-UX | CONF-0114 | 0094〜0099, 0110, 0116, 0138 | error/loading/navigation/range更新の共通UXを上位化し、component固有差分を残す。 |
| G-PRIVACY | CONF-0115 | 0061, 0091, 0092, 0120, 0126, 0131, 0133 | log/出力/住所/backup等の個人・業務情報境界と保持を統合する。 |
| G-ADDRESS | CONF-0119 | 0117, 0118, 0120 | 保存住所contractを先に定め、lookup/geocoding/個人住所の差分を決める。 |
| G-RECOVERY | CONF-0124 | 0125〜0130 | RPO/RTOとscopeを先に定め、restore semantics、artifact、actor、deployment/retryを順序付ける。 |
| G-DATA-COMPAT | CONF-0137 | 0055, 0071, 0104, 0119, 0134, 0138 | model/enum/date/roundingの旧data互換とmigrationを横断確認するが、各業務判断は統合しすぎない。 |

## 質問不要・統合候補

### Resolved-by-implementation-fact

0件。全coverage完了によりEvidenceは揃ったが、残るOpenの前提を実装事実だけで確定仕様へ変えられるものはなかった。実装確認済みという理由だけで承認扱いにしていない。

### Merge-candidate

17件。CONF-0049、0050、0056、0061、0066、0070、0074、0077、0080、0084、0089、0100、0102、0105、0108、0121、0127である。回答済み上位CONFだけで全詳細が自動確定するとは限らず、次回はcanonical questionへ差分を含めて一括提示する。

### Implementation-detail-no-user-question

0件。現台帳は既に実装だけで検証できる事項をFUTへ分離しており、今回さらに移す根拠はなかった。

## genuine user decisions / deferred

Open-user-decisionは75件。優先順は、G-AUTHZ、G-BILLING、G-ONBOARDING、G-ARCHIVE、G-RECOVERYを先行し、依存するdomain差分を後続とする。これは回答推奨ではなく、重複を減らす提示順である。

2026-08-12のsource review後も件数とdispositionは変わらない。新しい実装事実は既存canonical groupへEvidenceとして統合した。利用者向けには、(1) actor/tenant/role、(2) invitation identity、(3) Billing/lock、(4) backup/recovery、(5) privacy/retention、(6) retry/reconcile、(7) shared UX/date-timeの順に平文で提示する。詳細は[2026-08-12 source review統合記録](review-reconciliation-2026-08-12.md#要判断事項の優先グループ)を参照する。

Open-deferredはCONF-0021、CONF-0033、CONF-0035の3件。負数等の請求調整、Billing status/発行trigger、payment仕様について利用者が保留しており、再開指示まで推奨案へ置換しない。

## coverageとの照合

coverage inventoryは531 filesについてUncovered 0、Partially covered 0、unknown 0である。最後の部分被覆だった`utils/formats/util.js`はSPEC-DEEP-045bで公開契約、直接caller、validation非担当境界を確認してCoveredへ昇格した。従って`Blocked-by-uninvestigated`は0のままである。

## 未確認範囲

- 利用者へ質問を提示しておらず、Open判断は未回答のままである。
- code/runtime/実data/外部環境は再調査していない。
- groupは提示順と重複排除の索引であり、上位回答が全memberを暗黙に承認するものではない。
- FUT本文内の自然文による全CONF参照をsemanticに書き換えていない。既存Related FUT IDs/ユーザー判断欄は保持した。
