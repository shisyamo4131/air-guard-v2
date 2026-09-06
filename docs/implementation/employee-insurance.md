# Employee保険管理（実装調査）

## EMP-02の移行状態

Employee詳細の3保険はEMP-04の専用保存へ移行するまで一時read-onlyにした。Employee原本/archiveの直接client CUDをRulesで拒否し、旧全文保存を許可して併存させない。現6操作の採用条件は維持する。実装・受入れ状況は[Employeeロードマップ](../roadmaps/employee.md)と[local検証記録](../verification/employee-02-04-local.md)を参照する。

## EMP-01時点の再照合（2026-09-06・履歴）

3保険の埋込み、6操作、live instanceの先行変更と親の`submit:complete`後の全文保存は現sourceにも残る。計画は[Employeeロードマップ](../roadmaps/employee.md)、個人情報の権限・保険訂正/監査の未決は[CONF-0061](pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)へ統合する。通常CRUD安全化と監査制度の新設を同一視せず、現historyをappend-only監査証拠として扱わない。

下の2026-08-11記録のRules「全field write」「super-user全read/write」は当時の記述である。現在はEmployee退職3fieldの変更とdeleteを拒否し、同社の有効な本登録Userというidentity境界があるが、保険のpermission・field・遷移制約は不足する。archiveの個別/汎用許可も含め[現行再照合](employee-master.md#現行経路の再照合)を参照する。今回のruntime test、保存data検証、Dev確認は未実施。

## EMP-01の採用条件（2026-09-06追加回答）

在職Employeeでは履歴復元を含む6操作を会社管理者・統括・人事へ許可し、下記の現行状態遷移を維持する。退職後は保険更新・履歴復元を含め通常編集を禁止する。現UIの退職者操作可能という記録は実装事実であり、採用仕様ではない。[ADR 0059](../decisions/0059-employee-retired-edit-and-insurance-operation-boundary.md)に従い、保存時の最新在職状態と保険の局所競合を同じ保存境界で確認する。実装・runtimeは未検証。

## メタデータ

- 状態: 実装調査（SPEC-DEEP-027で対象9 componentをdeep review済み）
- 対象セグメント: SPEC-SEG-051
- 最終確認日: 2026-08-11
- 根拠ファイル: schema `Employee.js`、`Insurance.js`、`constants/insurance-status.js`、Employee詳細page、`components/Insurance/`のManager/Menu/6 input/Status Chip、Employees Rules
- 調査境界: Employee内の3保険と9 UI component、直接保存・権限境界だけ。給与、行政手続、外部API、実data、runtimeは未確認。

9 Insurance componentのprops、状態分岐、保存失敗・並行性、accessibilityのfile単位確認は[Employees / Insurance components deep review](employees-insurance-components-deep-review.md)を参照する。

## 保険種別・保存形態

Employee documentに次の3つを独立した`Insurance` customClassとして埋め込む。別collectionや保険種別fieldはなく、property名が種別を表す。

| Employee field | UI title |
| --- | --- |
| `employmentInsurance` | 雇用保険 |
| `healthInsurance` | 健康保険 |
| `pensionInsurance` | 厚生年金 |

各fieldのdefaultは新しい`Insurance()`で、Employee全体のupdateとして保存する。被扶養者、扶養人数、保険者、事業所整理記号、標準報酬、保険料、資格確認書、証書画像、期限・更新期限のfieldは存在しない。

## データ契約

| field | 意味・default |
| --- | --- |
| `status` | 必須。NOT_ENROLLED / ENROLLED / EXEMPT。defaultはNOT_ENROLLED |
| `previousStatus` | 直前状態。default空文字。手続取消に使用 |
| `enrollmentDateAt` | 資格取得日 Date/null |
| `number` | 被保険者番号（整理記号）string/null。形式・長さvalidationなし |
| `lossDateAt` / `lossReason` | 遷移入力用。method完了後は現在値からnullへ戻す |
| `isProcessing` | 加入手続中flag。default false |
| `isRetire` | 喪失入力用の退職flag。method完了後null相当のfalseへ戻す |
| `history` | 過去の加入状態配列。default空配列 |
| `enrollmentDate` | `enrollmentDateAt`をJST YYYY-MM-DDへformatする読み取り専用プロパティ |

history entryはstatus、previousStatus、enrollmentDateAt、lossDateAt、lossReason、numberを保存する。actor、changedAt、reason分類、Employee revision、isProcessing、isRetireは保存しない。履歴数上限・保持期限・archiveはない。

## 状態遷移・validation

| 操作 | 前提 | 必須入力 | 結果・履歴 |
| --- | --- | --- | --- |
| `enroll` | NOT_ENROLLEDまたはEXEMPT | 資格取得日。即時完了ならnumber | ENROLLED。`isProcessing=true`ならnumberをnullにする。履歴追加なし |
| `enrolled` | ENROLLEDかつprocessing | number | processingをfalse。履歴追加なし |
| `cancelEnroll` | ENROLLEDかつprocessing | なし | previousStatusへ戻し加入日/numberを消す。加入実態なしとして履歴追加なし |
| `exempt` | NOT_ENROLLEDまたはENROLLED | 完了済ENROLLEDからは喪失日・理由 | EXEMPT。完了済加入だけhistoryへpush。processing中は履歴なし |
| `loss` | ENROLLED（processingもcode上許可） | 喪失日・理由 | 現状態をhistoryへpush。退職ならNOT_ENROLLED、それ以外EXEMPT |
| `rollback` | historyあり、processing=false | なし | 最新historyをpopし現在値へ復元。rollback自体の履歴・監査は残らない |

Dateは`instanceof Date`、理由/numberはtruthyだけを検査する。将来日、加入日前の喪失日、同日、文字長、番号書式、3保険間整合は検証しない。`status`の通常schema setterはenum選択を持つが、Rulesは直接writeの状態遷移を強制しない。

## UI・保存flow

- `/employees/[id]`は3つの`InsuranceTransitionManager`を常時表示し、各modelへEmployee内のInsurance instanceを渡す。
- Menuはschema methodによる遷移可否、processing、history件数で6操作をdisabled制御する。
- Managerは選択actionごとにAirItemManagerのclone/edit dialogを開き、submit時に元Insuranceの専用methodへcloneを渡す。完了eventで親が`doc.update()`を実行しEmployee document全体を保存する。
- 各inputはprops `item/componentAttrs/updateProperties`だけを受け、独自emitやFirestore作用はない。LossはisRetire=trueで理由を「退職」へ設定し、Enrollはprocessing=trueでnumberをnullにする。
- loading/error/dialog/二重submitはAirItemManager共通契約に依存し、保険component固有のversion check、lock、監査、同時編集mergeはない。
- Managerは元Insuranceをschema methodで先に同期mutationし、親のasync `doc.update()`失敗時にhistory push/popを含むlocal rollbackや再fetchを行わない。3保険Manager間にもEmployee document単位のsingle-flightはない。
- RESIGNED Employee詳細でも3保険Managerは表示・操作可能である。

## 個人情報・権限・Rules

- Employee detail routeは`employees:read`で到達し、保険Managerに追加のwrite permission/disabled判定はない。
- Employees/Employees_archive Rulesは同一会社の全認証Userまたはsuper-userへ全field read/writeを許す。本人、労務担当、管制、管理者、read/writeを区別しない。
- 被保険者番号、加入/喪失日・理由、履歴はEmployee内の他の高感度情報と一括取得・保存され、field maskingやserver APIはない。
- client UIを迂回する直接writeでは専用遷移method、history追加、Date/order validationを回避できる。

## 現在値・履歴・上書き

- status/enrollmentDateAt/numberが現在値で、喪失情報は現在値として保持せずhistory entryだけに残る。
- 通常の喪失・完了加入からの適用除外はappendするが、加入開始・完了・取消、未加入→適用除外、processing中の適用除外は履歴に残らない。
- rollbackは末尾entryを破壊的にpopするため、復元前の状態、実行者、理由、時刻を追跡できない。繰り返すと履歴を順次消費する。
- Employee全体updateで保存するため、別画面・別tabの更新とfield単位merge/revision guardがない場合は保険または他Employee fieldのlost update候補となる。

## 下流利用・未使用候補

- repository検索で3 Insurance field、history、status methodの直接利用はEmployee詳細の保険UIとschema testに限られた。給与、勤怠、配置、請求、外部申請、帳票が参照する実装は確認できない。
- 6 input、Menu、Manager、Status ChipはいずれもEmployee詳細から到達する。独立した未使用componentは確認しなかった。
- `lossDateAt`、`lossReason`、`isRetire`は永続class fieldだが専用method完了時に初期化され、通常はdialog一時入力として使われる。
- history entryの`previousStatus`はrollbackで復元されるがUIの復元previewはstatus/date/number/processingだけを表示し、喪失日・理由を表示しない。
- Rollback previewだけはDateをbrowser local timezoneでformatし、schema読み取り専用プロパティとManagerのJST/dayjs表示契約から外れる。

## コメント・実装差

- `enroll` JSDocの一部は「isProcessing=trueならnumber必須」と記すが、実装とUIは逆で、processing=trueならnumberをnull、falseならnumber必須である。
- Loss component説明は「LOSSへの遷移」と書くがLOSS statusは存在せず、実装はNOT_ENROLLEDまたはEXEMPTへ遷移する。
- Enroll inputのtemplate commentは常にnumber必須と読めるが、processing checkbox選択時はdisabledかつ不要である。
- Menuは`loss`を`isEnrolled()`だけで許可し、processing中でもloss dialogへ到達する。schema `loss()`もprocessingを拒否せずhistoryへ加入状態を記録する一方、exemptはprocessing中を加入実態なしとして履歴に残さないため扱いが非対称である。
- ManagerのVuetify defaults keyは`EmployeeManager`、Enrolled inputは先頭空白付きkeyであり、Insurance component名と一致しない。意図したglobal defaultsが適用されない候補である。

## 将来要対応

- FUT-0159: Insuranceの履歴・監査・日付/番号validation・processing遷移を正式化する。
- FUT-0075: Employee個人情報のfield別read/write、本人/労務/管理者境界へ保険証拠を追加する。

## 要確認事項

- CONF-0061へ保険番号・加入喪失履歴・労務担当境界を統合した。新規CONFは追加していない。
- 保険情報をAirGuardで管理する目的、正式actor、保持/監査期間、rollback許可はCONF-0061の上位個人情報判断として扱う。

## code evidenceで質問不要となった事項

- 被扶養者・期限は未設計仕様ではなく、現行modelにfield/UIが存在しない。
- 保険は別履歴collectionではなくEmployee内の現在値＋破壊的pop可能なembedded historyである。
- 3保険は同一Insurance class契約で、種別固有validationはない。
- 現行下流利用はEmployee詳細UIに限定され、給与等への連携有無を推測する必要はない。

## 未確認範囲

- AirItemManager内部のconcurrency/error詳細、Emulator/実data、実運用の番号形式・法定保持、行政/給与連携。
- direct Firestore writeのruntime検証、archive後の閲覧運用、監査log、既存history品質・容量。
