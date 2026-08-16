# Functions entry / auth / employee / maintenance deep review

- 状態: Deep-reviewed
- 対象チェックポイント: SPEC-DEEP-001
- 最終確認日: 2026-08-11
- 対象: deep-review-plan `SPEC-DEEP-001`のexact 11 files
- 制約: 直接依存はsignature/caller確認だけとし、通知・派生同期・SecurityReport core・Site自動終了の内部は既存文書参照に留めた。runtime、Firebase、実dataは未確認。

## 後続改修

- 2026-08-14〜15にUser更新Auth同期、`disableUser`、`enableUser`、`changeAdminUser`のactor・company・target境界を新規policy/use-caseへ分離して改修し、Firebase非接続の認証関連単体test 151件を追加した。
- 2026-08-15に`checkEmailAvailabilityGlobal`を有効な同社会社管理者へ限定し、2つの再構築Callableを同社の有効なスーパーユーザーへ統一した。3つの公開Callableと共有再構築認可を`functions/apis`の単体ファイルへ分離し、専用Emulator suite 51件を確認した。
- 2026-08-15に全10 Callableを`functions/apis`へ集約し、Authentication削除triggerを`functions/triggers/auth.js`へ移した。公開名と既存挙動を維持し、専用Emulator suite 60件とfunctions entry実importを確認した。
- 2026-08-16に`checkUserPreRegistration`の未認証応答をbooleanだけへ縮小し、metadata公開と複数一致時の先頭採用を廃止した。専用Emulator suite 61件で確認した。
- 下記表は2026-08-11時点のdeep-review基準線である。現在の認証実装事実は`user-auth-lifecycle.md`と`callable-authorization.md`を正とし、Functions transport、remote、実dataは未確認である。

## per-file public contract

| file | responsibility / exports | input・main branches / output | auth・tenant / error・side effect / reachability |
| --- | --- | --- | --- |
| `functions/index.js` | deployment entry。dayjs UTC/timezoneを登録しdefaultをAsia/Tokyoへ設定、Firebase/FireModel初期化をside-effect importし、modules/triggers/apisをstar export | 引数/returnなし。Stripe exportだけcomment out | 全exportのdeployment surface。global regionはfirebase.init側。re-export先内部は各segment範囲。testなし |
| `functions/apis/index.js` | `rebuildAllHistories`、`rebuildSecurityReportIndexes` v2 callable | 前者は`companyId:string`→`{message}`、後者は同input→core result+message、timeout 540秒。core errorをHttpsError internalへ変換 | 履歴rebuildは**authなし**で任意companyId。SecurityReport rebuildはauth+`isSuperUser===true`。双方App Check/rate/idempotency/auditなし。super-user pageから直接到達。testなし |
| `functions/triggers/arrangementNotification.js` | create/update Firestore triggers。通知document作成helperへ委譲 | createはdata undefinedをskip、`shouldNotify ?? true`。updateはbefore/after undefinedをskipし、各statusへ「以前そのstatusでなかった→現在status」の遷移でCONFIRMED/ARRIVED/LEAVED helperを順に呼ぶ | path companyIdをhelperへ渡す。event dedupe/ledgerなし。helper errorは伝播しplatform retry候補。戻し後の再進行でも再発火する現実装。Emulatorだけの不具合と断定するcommentはruntime根拠をこのfile内に持たない。testなし |
| `functions/triggers/operationResult.js` | `onOperationResultChange` onDocumentWritten | create/update/deleteをbefore/afterで判別。Billing→DailyAttendance→DailyOperationsByEmployee→SiteEmployeeHistoriesを**直列**await。updateでsite/date変更時は旧site rebuild後に新site rebuild | tenantはevent path。途中失敗で後続未実行、前段rollbackなし。catchはstructured log後rethrow。event idempotency/ledgerなし。indexからexport。testなし |
| `functions/triggers/securityReport.js` | Storage finalize/delete triggers | parser不一致/thumbnailはreturn。uploadはindex同期→thumbnail生成、deleteはindex同期だけ | region asia-northeast1、bucket限定なしでpath parserが境界。upload後段失敗でindexだけ成功、main deleteでthumbnailを直接削除しない。helper errorは伝播。testなし |
| `functions/triggers/user.js` | User update/delete→Firebase Auth同期 | temporary updateはskip。displayName/disabled差分時だけAuth update。deleteはdocIdをUIDとして`deleteUser` | tenant/doc ID不変条件を自前検証しない。Firestore更新/削除が先行しAuthは後続非atomic。Auth user不存在deleteは成功扱い、それ以外error伝播。testなし |
| `functions/modules/auth/deleteUser.js` | `deleteUser(uid): Promise<void>` | uidはstringだけ検証（空文字はAdmin SDKへ進む）。Auth delete、`auth/user-not-found`だけ吸収 | callableではない。UIDをinfo log。その他error再throw。onUserDeletedから直接利用。testなし |
| `functions/modules/auth-v2.js` | 8 v2 callable＋1 v1 Auth delete trigger | email global/registration check、admin company setup、pre-registration lookup、temporary→registered setup、enable/disable、admin transfer、Auth削除token cleanup | 詳細は次節。Auth/Firestore/claimsは非atomic。error mappingは一部Auth codeだけ。`onAuthUserDeleted`だけv1でtoken cleanup errorを吸収。全てindexからexport。testなし |
| `functions/modules/Employees.js` | `onEmployeeDeleted` Firestore delete trigger | 同companyのUserを`employeeId == docId`でquery。0件return、1件目だけ`User.delete` | multiple Userでも先頭1件だけ。deleteは後続triggerを通じAuth削除へ連鎖。admin delete拒否等はschema method依存。error log+rethrow、reconcileなし。testなし |
| `functions/modules/firebase.init.js` | module initialization side effects | `initializeApp`、global region asia-northeast1、FireModel ServerAdapter注入、GeocodableMixinへserver fetchCoordinates注入 | import時一度の前提。公開exportなし。初期化失敗はentry load失敗。Emulator/credential分岐なし。indexだけがside-effect import。testなし |
| `functions/modules/maintenance.js` | `runDailyTask` scheduled export。private cleanup helpers | JST毎日00:00。60日前より古いScheduleを全tenant collectionGroup queryし、company別`in` 30件で通知削除後、Scheduleをbatch 300件削除。その後Site自動終了 | 通知→Schedule→Site終了を直列実行。batch群はPromise.all。途中成功rollbackなし、pagination/limitなし。外側catchがerrorを**吸収**するためplatform成功扱い/自動retryなし。audit/run ledgerなし。testなし |

## auth-v2 callable matrix

| export | guard / target | validation / output | confirmed risk / partial state |
| --- | --- | --- | --- |
| `checkEmailAvailabilityGlobal` | unauthenticated、全tenant Users collectionGroup | email truthyのみ。存在でalready-exists、不在で`{available:true}` | App Check/rateなし、enumeration可能。Auth側は見ない |
| `checkEmailAvailability` | unauthenticated。caller入力`isAdmin`を信頼 | email truthy＋isAdmin boolean。Auth全体確認後、adminは全Users不存在、normalはtemporary 1件以上 | tenant/temporary一意対応を返さず、列挙/raceあり |
| `createAdminAccount` | authenticatedのみ | companyName/companyNameKana/displayName truthy。Firestore transactionでCompany+UID User作成後、claims設定 | caller既存company/User/claimを拒否しない。claims失敗でCompany/Userだけ残る。再実行idempotentでない |
| `checkUserPreRegistration` | unauthenticated | email truthy。先頭temporaryを取り、companyId/displayName/roles/tempUserIdを返す | 個人・所属・role・doc ID露出。複数一致順序なし |
| `setupUserAccount` | authenticated | caller指定companyId/tempUserIdをfetchし、Auth email一致＋temporaryを確認。transactionでtemp delete→UID User create、後でclaims | email一致はtenant takeoverを抑えるが、claims失敗後retryはtemp消失。source company claim/招待secretなし |
| `disableUser` / `enableUser` | authenticatedのみ | target UID→Auth custom claim companyId→User doc。Firestore disabled update→`{success,uid}` | caller role/companyとtarget tenant不一致を検証しない。Auth disabled反映はonUserUpdatedの別event。self/temporary/last-admin guardなし |
| `changeAdminUser` | authenticated＋caller claim companyId | same-company from/to存在、from admin、to non-admin、different ID。transactionでisAdmin移譲しto.roles=[] | caller自身admin/from本人を検証せず、disabled/temporary targetも許す。Auth claimsは更新しない |
| `onAuthUserDeleted` | v1 Auth delete event | FcmToken.deleteByUid、count log | cleanup errorをlog後吸収しretryさせない。emailをinfo log。削除済みtokenはcore依存 |

## caller / entry reachability

- `functions/index.js`のstar exportにより11 filesのexportはdeployment候補となる。Stripeだけcomment out。
- auth-v2 8 callablesは`composables/auth/useAuthFunctions.js`から同名で直接呼ばれ、signup pagesまたはUser管理UIへ到達する。
- `rebuildAllHistories`と`rebuildSecurityReportIndexes`は`pages/super-user/index.vue`から直接呼ばれる。UI guardはserver guardを代替しない。
- Firestore/Storage/Auth/schedule triggersはindex exportによりevent到達する。private `deleteUser`はUser delete triggerだけが直接呼ぶ。

## main state / failure chains

1. User disabled変更はFirestore write成功をcaller successとし、別eventでAuthへ反映する。trigger失敗時は状態が分離する。
2. User document delete→Auth delete→Auth delete event→FcmToken cleanupの3段階で、最後のcleanup errorだけ吸収する。
3. Employee delete→先頭User delete→上記chain。複数User、admin拒否、各event失敗で部分状態が残る。
4. OperationResult triggerとmaintenanceは複数domain副作用を直列実行する。前者はerror再throw、後者は最外catchで吸収するためretry性が異なる。
5. SecurityReport uploadはindex成功後thumbnail失敗が可能。delete handlerはmain file削除後にindexだけ同期し、thumbnail cleanupを直接行わない。

## conflicts / unused / comment mismatch

- `rebuildAllHistories`の管理操作だけauthがなく、隣接rebuildはsuper-user必須。
- `runDailyTask`のJSDocはerrorを処理するだけだが、最外catch吸収により失敗をplatformへ通知しない。
- arrangement create commentはEmulatorの挙動を「不具合と断定」とするが、file内に検証可能なtest/evidenceはない。
- maintenanceのdayjs plugin削除候補commentとunused cleanup commentが残る。timezone pluginはentryでglobal登録される暗黙依存である。
- `AUTH_ERROR_CODE_MAP`の一部statusはFirebase callable標準codeではない候補だが、実SDK runtime受理は未確認。
- 対象11 filesにdead exportは確認しなかった。private cleanup helpersはrunDailyTaskから到達する。

## tests

repository内のtest/spec検索で、対象export/handler名を検証する自動testは0件だった。runtimeは実行していない。必要なtest観点は既存FUT-0076、0080〜0084、0109、0151〜0153、0161へ統合する。

## FUT / CONF

- 新規FUT/CONFは追加しない。
- 認可はFUT-0151/FUT-0080、account部分状態はFUT-0081〜0084、Employee cleanupはFUT-0076、SecurityReport整合はFUT-0109、runtime/retryはFUT-0153/FUT-0161へ証拠を追記する。
- user判断は既存CONF-0062、0066〜0069、0090、0111、0129、0130、0135へ統合する。

## 未確認範囲

- 直接helper/core内部、schema methodのtransaction/idempotency、Cloud側retry/IAM/App Check override。
- Emulator/DEV/PROD、実data、trigger ordering、Eventarc redelivery、Auth token失効時点、Storage lifecycle。
- Firebase error code runtime validationとlogger retention。
