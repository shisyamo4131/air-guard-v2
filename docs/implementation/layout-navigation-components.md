# Layout・Navigation・App Shell Component実装カタログ

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-034
- 最終確認日: 2026-08-11
- 根拠ファイル: `app.vue`、`layouts/default.vue`、`layouts/auth.vue`、`layouts/guest.vue`、`components/AppNavigationDrawer.vue`、`stores/useAppStore.js`、`utils/pageSettings.js`、`middleware/auth.global.js`、`plugins/05.air-vuetify.js`
- 関連文書: `docs/implementation/app-shell.md`、`page-access.md`、`state-initialization.md`

## Layout表

| layout | 選択元・対象 | shell |
|---|---|---|
| `default` | 認証済み業務pageのdefault。一部pageは明示指定 | global loading/snackbar、dynamic app bar、drawer、back/nav icon、UserSetting activator、NuxtPage keepalive、footer |
| `auth` | sign-in/sign-up/reset/unconfirmedEmail/maintenanceで明示 | global loading/snackbar、desktop marketing pane、Air Guard brand、NuxtPage。`smAndDown`ではform paneのみ |
| `guest` | `/`で明示 | global loading、固定AirGuard app bar、NuxtPage、footer。snackbar queueなし |

`app.vue`はPWA manifestと`NuxtLayout`だけを配置し、各layout自身が`NuxtPage`を持つ。defaultのkeepalive includeは8 route component名、最大10である。

## Component・API表

| 対象 | API・store連携 |
|---|---|
| default app bar | `appStore.appBar`: primary/flat/title。prependに`navIcon`と`previousButton`、appendにaccount-cog activator |
| `AppNavigationDrawer` | `$attrs`をroot v-navigation-drawerへ透過。auth.rolesから`getNavigationItems`。group/child/list itemを描画しappend slotを提供 |
| drawer state | `appStore.navBar`: modelValue、permanent/temporary、update handler。lgAndUpでは常時open、mobileではtoggle |
| nav icon | 認証UIDなしまたはlgAndUpでhidden、clickでdrawer反転 |
| page title | route.pathをpageSettingsへ解決しlabel、未設定ならAirGuard |
| back button | `hasParentPage(route.path)`時だけ表示し、clickで`router.go(-1)` |
| user menu | layoutは`UserSetting`へactivator slotを渡す。repo内component定義は見つからず、外部plugin登録または欠損の判定は未確認 |
| sign out | drawer append list itemが`handleSignOut`。loading queue追加→auth action→message→`/` push、error logger、finally queue除去 |
| global state | loading queueをAirLoadingDialog、message queueをSnackbarQueueへ接続。guestはmessage queueを表示しない |

bottom navigation、breadcrumb component、notification indicator、個別page title setterは確認できない。

## Route・store data flow

route change → auth middlewareがerror storeをclearし認証/maintenance/page access policyを判定 → layout render → useAppStoreがroute.pathからtitle/back visibilityを計算 → drawerがauth stateからnavigation treeを再計算する。navigation表示とroute accessは同じpage policy evaluatorを使い、pathなしgroupはアクセス可能な子から導出するが、表示はsecurity boundaryではなくmiddleware/Rulesが別途必要である。

drawer child active判定はroute.name末尾`-id`を除いた値とpage idを比較する。単独itemはVuetify RouterLinkのactive判定へ任せ、`exact=false`である。

## Responsive

lgAndUpではdrawerをpermanent/openにしnav iconを隠す。それ未満ではtemporary drawerとtoggle iconを使う。authはsmAndDownでmarketing paneを隠す。defaultにmobile bottom navはなく、app bar/drawerを共用する。footerは全default/guestでapp領域を占める。

## Auth・permission表示境界

drawerは`getNavigationItems(auth.roles)`でrolesとnavigation flagを満たす項目だけ表示する。nav iconはauth.uidで表示制御する。UserSettingの内部action/権限は未確認。Sign Outは認証済みdefault layoutで常に表示され、二重clickのcomponent-level disableはない。

## Accessibility

Vuetify nav item/buttonのsemanticに依存する。account-cog、nav toggle、chevron backはicon-onlyで、コード上に明示的な日本語aria-label/tooltipはない。backは履歴操作で、focus移動/復帰は明示されない。drawer group/listはVuetifyのkeyboard contractへ依存する。authのbrand iconは装飾/名称のARIA区別を明示しない。

## Lifecycle・reset

useAppStoreのwatchEffectはdisplay breakpointにdrawerを同期する。route change時にtitle/back/navigationはcomputedで更新され、middlewareがglobal errorをclearする。drawer open state、message/loading queueをroute単位でresetする処理はない。keepalive対象pageはcomponent stateを保持し、include外は通常unmountする。logout後のshell state clearはauth action内部範囲で未確認である。

## 矛盾・未使用候補

- `AppNavigationDrawer.normalizeRouteName`は`route.name.endsWith`をnull/type guardなしで呼ぶ。名称なしroute/404で例外候補。SPEC-DEEP-020の全file reviewでも同一実装を再確認した。
- back button表示はpageSettings親関係だが、実動作は親pathではなくbrowser history backであり、外部referrerや別業務pageへ戻り得る。
- `UserSetting`はrepo内定義がなく、AirVuetify pluginが登録する名称か欠損かを静的に確定できない。
- `navBar.toggle`はAppNavigationDrawerが明示利用せず、rootへのfallthrough attributeとなる。
- guest layoutだけglobal snackbar queueを持たないため、guest pageのmessage store通知は表示されない。
- footerとauthで同じglobal CSS custom properties/emulator warning styleを重複定義する。

## 将来要対応

FUT-0118〜FUT-0120を`future-actions.md`へ追加した。

## 要確認事項

CONF-0098〜CONF-0099を`pending-confirmations.md`へ追加した。

## 未確認範囲

UserSetting/AirVuetify内部、通知UI/PWA内部、Auth action内部、実ブラウザのresponsive/keyboard/focus、keepalive memory挙動、各page本文は未確認である。
