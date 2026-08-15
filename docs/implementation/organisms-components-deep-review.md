# Organisms components deep review

## メタデータ

- 状態: 実装調査（SPEC-DEEP-032、deep-reviewed）
- 最終確認日: 2026-08-11
- 対象: `components/organisms/**` の6ファイル
- 根拠: 対象6ファイル、直接caller `components/Users/Manager/index.vue`、`composables/auth/useAuthFunctions.js`、Functions `modules/auth-v2.js`、既存の `site-ordering.md`・`user-auth-lifecycle.md`
- 制約: Air/Firebase/Vuetify内部、runtime、実ブラウザ、Rules評価、実dataは未確認。直接依存の公開契約だけを確認した。

> 後続改修: 2026-08-15に`changeAdminUser`のserver認可を強化した。以下は2026-08-11時点の画面・旧Callable調査記録であり、現在のCallable境界は`callable-authorization.md`と`user-auth-lifecycle.md`を正とする。

## コンポーネント/API表

| ファイル | 公開契約 / 責務 | 状態・外部作用 |
| --- | --- | --- |
| `ChangeAdminUserDialog/index.vue` | propsなし、`complete` emit。activator付きpersistent dialog、4段階windowで現管理者・移行先選択・確認・完了を表示する。 | `auth.isAdmin`がfalseならactivatorをdisabled。開くとactive・非temporary Userを購読し、閉じるとunsubscribe/reset。step 3で`changeAdminUser({from,to})`を呼び、成功時だけstep 4へ進む。 |
| `ChangeAdminUserDialog/WindowItem1.vue` | injectした`adminUser`をchipへ表示。 | admin不在はerror表示。props/emits/loading/独自validationなし。 |
| `ChangeAdminUserDialog/WindowItem2.vue` | injectした`otherUsers`をchip-groupへ描画し、選択したUserオブジェクトを`selectedNewAdminUser`へv-modelする。 | 空配列はerror表示。完全なUser objectをselectionへ保持し、subscription更新後の世代確認はない。 |
| `ChangeAdminUserDialog/WindowItem3.vue` | injectした移行元/移行先のdisplayNameを確認画面へ表示。 | ID、company、disabled/temporary状態、競合versionは表示・検証しない。 |
| `ChangeAdminUserDialog/WindowItem4.vue` | 成功後の`adminUser`を表示。 | parentのlive subscription結果に依存し、明示refetchはない。props/emits/loadingなし。 |
| `SiteOrderManager.vue` | `siteOrder`配列のdefineModel、Boolean `loading` prop、cancel/submit emit。`vuedraggable`とActionsSubmitCancelを組み合わせる旧順序UI。 | drag disabledはvuedraggableへ渡さず、loadingはactionへだけ伝播。validation、permission、保存、rollback、error表示は親へ委譲。 |

## ChangeAdminUserDialogの処理フロー

1. `/settings/users` の `UsersManager` が`OrganismsChangeAdminUserDialog`をmenu内に配置し、`complete`時に`/dashboard`へ遷移させる。対象dialogは静的callerがあり、未使用とは判定しない。
2. activatorはclient `auth.isAdmin`だけで表示・操作を制限する。dialog open時に`disabled == false`かつ`isTemporary == false`のUserを購読する。query自体にcomponent側のcompanyId条件はなく、User schemaのpath/contextに依存する。
3. `adminUser`は購読結果の最初の`isAdmin`、`otherUsers`は非adminで導出する。adminが複数ある場合の一意性検証、selection後の再確認はない。
4. step 3は親の`isLoading`を立て、`useAuthFunctions.changeAdminUser`へ`from`/`to`のdoc IDだけを渡す。成功時はstep 4、完了操作でdialog closeと`complete` emit。例外はloggerへ渡し、step 3に留めてfinallyでloadingを解除する。ユーザー向けerror messageはこのcomponentにはない。
5. 戻る・cancel・次へはloading中disabled。UI上はsingle-flightとなるが、server側の再送・競合version・監査記録をこのcomponentは持たない。

## callable / 認可境界

`useAuthFunctions.changeAdminUser`はFirebase callable `changeAdminUser`へ結果をそのまま返す薄いadapterである。Functions入口はauthenticationとID token `companyId`を要求し、`from`/`to`の存在・不同、両Userの同一company pathでの存在、移行元`isAdmin`、移行先の非adminを検証する。Firestore transaction内でfromの`isAdmin=false`、toの`isAdmin=true`・`roles=[]`を更新するため、2文書更新はtransaction境界にある。

一方、callableはcaller自身がadminであること、`from`がcaller本人であること、移行先のdisabled/temporary状態、明示的なfield allowlistや監査理由を検証しない。componentのclient `auth.isAdmin`はserver強制の代替ではない。この差は既存`FUT-0080`（User/Auth管理のserver認可とfield制約）へ統合する。

## loading・error・selection・accessibility

- dialogの購読はopen/close watcherで解除される。unmount時のFireModel購読cleanup、購読失敗時の画面表示、古いselectionの自動clearは対象componentでは確認できない。
- WindowItemはprops/emitsを持たずinjectへ依存する。chip/chip-group/windowのkeyboard・focus trap・accessible nameはVuetify/Air側へ委譲され、対象6ファイルには明示ARIAやfocus returnがない。
- SiteOrderManagerのdrag/actionは`loading`の一部だけを受け、操作中のdraft rollback・save error・duplicate guardを持たない。既存の旧component候補であり、静的callerは確認できない。
- 対象6ファイル専用のunit/component testは静的検索で確認できなかった。

## caller・未使用候補・整合

- `ChangeAdminUserDialog`は`components/Users/Manager/index.vue`から到達する。認証ライフサイクル文書が記録するadmin移譲経路と一致する。
- `SiteOrderManager.vue`は現行のtype対応reorder formとは別の旧実装で、直接callerは確認できない。`site-ordering.md`のlegacy候補記録を、6ファイル本文・公開契約まで確認した証拠で補強する。削除・統合は運用判断を伴わない将来整理事項として残す。
- コメントの`OrganismsChangeAdminUser`/`SiteOperationScheduleDuplicator`表記と実ファイル責務には差がある。これはruntime未確認のため、コメント不一致候補として扱う。
- accessibilityの共通課題は既存`FUT-0115`、admin移譲のserver認可差は`FUT-0080`へ重複登録せず証拠追記する。新規FUT/CONFは追加しない。

## 未確認範囲

- Firestore RulesのUser write条件、Nuxt auto-registration、Air componentのARIA/focus/keyboard実装。
- callableのApp Check、rate limit、監査基盤、Functions retryと実運用の再送。
- 複数admin・購読遅延・対象User状態変更を含むruntime競合、実ブラウザ操作、専用テスト実行。
