# SecurityReport（警備日報）実装調査

## Storage utility最終確認（SPEC-DEEP-045b）

- uploadはclient圧縮後、入力形式にかかわらず`.jpg`へ保存し、`contentType`を明示しない。metadataは`uploadedBy`だけで、company・operation・原file名・hash・revisionは記録しない。
- listはfolder全件を`listAll`し、各本体のmetadata/download URLとthumbnail URLを並行取得する。1本体のmetadata/URL失敗で全体がrejectし、件数上限・pagination・部分結果契約はない。
- deleteは本体とthumbnailを並行削除し、thumbnail側の全errorを「未存在」として吸収する。本体成功後にthumbnailがpermission/network等で残っても成功扱いとなり、原因分類・repair markerを持たない。

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-030、SPEC-DEEP-008、SPEC-DEEP-035
- 最終確認日: 2026-08-12
- 根拠ファイル: `utils/storage.js`、`composables/useSecurityReports.js`、`components/SecurityReports/Manager/index.vue`、`components/SecurityReports/Window/index.vue`、`functions/triggers/securityReport.js`、`functions/modules/securityReport/`、`functions/modules/operationCleanup.js`、`functions/apis/index.js`、`storage.rules`、`firestore.rules`、schemas `SecurityReportIndex`

## 入口・権限

専用ページはなく、配置管理、配置通知、上下番確定、稼働実績詳細、請求稼働詳細から共通の `SecurityReportsManager` を開く。専用pageSettingsもなく、画面到達性は各親ページの暫定権限に依存する。一方、実際の画像アクセス境界であるStorage Rulesは認証済みであることだけを要求し、会社、role、permission、稼働との関係を検証しない。

## データ契約

構造化された `SecurityReport` document/classは確認できない。実体は次の写真と索引である。

| 対象 | 契約 |
|---|---|
| 本体画像 | Storage `Companies/{companyId}/Operations/{operationId}/SecurityReports/{uuid}.jpg` |
| サムネイル | 同じfolderの `{uuid}_thumb.jpg` |
| uploader | 本体画像のcustom metadata `uploadedBy` にAuth UIDを保存するが、一覧UIは表示しない |
| 検索索引 | Firestore `Companies/{companyId}/SecurityReportIndexes/{operationId}` |
| 索引field | `dateAt`、`reportCount`。`hasSecurityReports` getterは `reportCount > 0` |
| operationId | `OperationResult` doc IDを優先し、存在しなければ`SiteOperationSchedule` doc IDとして日付を解決する |

company/site/date/author/status/body/items/attachments/signatureを持つ単一報告書契約はない。companyとoperationはpath、日付は関連稼働から索引へ導出され、siteは索引に保存されない。

## 作成・編集

`v-file-input`は`image/*`を受け、browser-image-compressionで最大1 MB、長辺最大1920、Web Worker使用として圧縮する。UUID名を生成して直接Storageへuploadし、upload完了後に一覧を再取得する。明示的な本文編集、画像metadata編集、置換はなく、追加と削除だけである。入力MIME、実体形式、寸法、件数の業務validationは確認できない。upload時にcontentTypeを明示せず、入力形式にかかわらず`.jpg`名を使用する。

Storage finalize triggerはpathに一致する本体`.jpg`だけを処理し、現在の本体画像数から索引を同期した後、Sharpで400x400以内・JPEG quality 80のサムネイルを作成する。件数はincrementではなくStorageの現在状態から再計算する。

6 helperの公開API、再構築batch、失敗・再実行境界のfile単位確認は[SecurityReport Functions deep review](security-report-functions-deep-review.md)を参照する。

## 状態遷移

draft/create/update/submit/approve/rejectという状態または遷移は実装されていない。uploadされた写真は直ちに一覧対象となる。提出、承認、差戻し、署名、確定後lockも存在しないため、それらを現行仕様とは扱わない。

## 添付

一覧は`listAll`でfolder全件を取得し、`_thumb`を含む項目を除外して本体metadata、download URL、対応サムネイルURLを取得し、`timeCreated`昇順で表示する。サムネイルがなければ本体URLを使用する。画像クリックは新規tabで本体URLを開く。

Storage Rulesには最大size、contentType、拡張子、UUID形式、件数、uploader、operation存在の制約がない。client圧縮はセキュリティ境界ではなく、直接SDK利用では迂回できる。

## 検索・表示

`SecurityReportIndex`は日付範囲で取得され、operationIdごとの有無表示に利用される。clientの索引writeはFirestore Rulesで拒否され、Storage triggerまたはsuper-user callableの再構築処理が管理する。再構築は指定会社のStorageと既存索引を列挙し、20 operationずつ同期する。

## 削除・保持

Managerは確認dialog、uploader判定、status/lock判定なしで本体画像とサムネイルを削除する。サムネイル削除の失敗は無視される。Storage delete triggerは現在件数を再集計し、0件なら索引を削除する。

予定削除時は`operationResultId`がない場合にそのIDのfolderを全削除する。実績作成済み予定の削除では保持し、OperationResult削除時に実績IDのfolderを全削除して、関連予定も削除する。保持期間、法的保持、soft delete、復元、監査履歴は確認できない。

## Rules・テナント・セキュリティ

- Firestore索引: 同一会社Userまたはsuper-userがread可能、client write不可。
- Storage画像: `request.auth != null`だけでread/writeを許可する。
- この差により、任意の認証Userが既知または推測した他社pathへ画像の閲覧、追加、上書き、削除を行える実装である。
- callable再構築は認証済みsuper-userだけだが、入力companyIdはcaller companyへ限定しない。これはcross-tenant運用権限の正式仕様が未確定である。

## 失敗・並行性

- upload/list error stateはcomposableにあるがManagerに表示されない。delete errorはcatchしてconsoleへ記録し、画面へ通知しない。
- 索引同期後にthumbnail生成が失敗するとtriggerは失敗するが、retry時の絶対件数再計算で索引は収束し得る。thumbnail生成は再試行対象となる。
- 関連OperationResult/Scheduleが見つからない場合、既存索引を削除するがStorage画像は残る。
- main削除後のthumbnail削除失敗をclientが無視するため、orphan thumbnailが残り得る。
- transaction、version、編集lockはなく、upload/delete/listの同時操作について画面側の個別path loading以外の排他はない。
- 再構築は候補operationIdを重複排除して20件ずつ`Promise.all`する。1件失敗時は当該chunkがfail-fastとなる一方、開始済み同期はrollbackされず、後続chunk、failed ID、resume cursorはない。

## 仕様との一致・矛盾・未使用候補

- UI上の呼称は警備日報だが、実装は写真群であり、提出書類のstatus/body/signature contractは存在しない。
- `uploadedBy`は保存されるが表示・認可・削除guardに使われない。
- Firestore索引のtenant制約とStorage画像の認証のみ制約が一致しない。
- mainがないthumbnailは一覧対象外だが、再構築でも本体として数えられず削除されない。

## 将来要対応

FUT-0105〜FUT-0110を`future-actions.md`へ登録した。

## 要確認事項

CONF-0088〜CONF-0092を`pending-confirmations.md`へ登録した。

## 未確認範囲

実Storageデータ、remote Rules/deploy状態、ブラウザupload、画像decoderの各形式挙動、親画面の業務ロジック全文、他報告書、PDF、外部送信は未確認である。

## Manager / Window境界の追加確認（SPEC-DEEP-035）

Managerはcomposableの`isListing`、`listError`、`uploadError`を表示せず、loading・permission failure・真の空件数を同じempty表示へ畳み込む。削除は確認、status/lock、actor判定なしで直接実行し、宣言した`click:delete` emitも発火しない。最後の1件を削除するとWindowがunmountする一方、Manager側`currentReport`はscheduleId変更時しかresetされないため、削除済みURLをfull-size/delete操作が参照し続け得る。Windowはindexをkeyにし、明示的なempty/error状態を持たない。

## SecurityReportIndex range data layer追加確認（SPEC-DEEP-043）

- range layerはlive/snapshot両modeを持つが、snapshotの連続range変更にgeneration/cancelがなく、失敗時は旧docsを保持する。live modeは同期登録errorだけをcatchし、listener後続errorを受けない。
- loadingはsnapshot fetch中だけで、live initial load、permission failure、empty、stale、lastUpdatedを区別しない。このIndexを合成する配置管理画面も同じpartial-state境界を継承する。

## Storage composable追加確認（SPEC-DEEP-044）

- operationId変更時のlistはrequested ID一致時だけ結果を採用し、単純なstale list上書きを防ぐ。一方、in-flight request自体はcancelせず、同一IDの重複fetchにgenerationがない。
- uploadはfile watchで即時開始しUI attrをdisabledにするが、programmatic file変更のsingle-flight guardはない。upload後fetchまで別作用で、成功後のlist失敗はupload済み/表示旧値となる。
- deleteはoperationId/revisionをcaptureせず、完了時に現在のreportsからpathを除く。対象切替中のdelete、同一path重複、invalid report、partial failureのrefetch/rollbackはない。
- upload/list errorはmessageをlocal refへ入れる一方deleteはloggerだけで、Managerは既確認どおりlocal errorを表示しない。scope disposeでrequestをcancelせず、global loading keyはuploadだけに使う。
