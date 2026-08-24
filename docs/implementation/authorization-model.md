# role・permission認可モデル（実装調査）

## Authorization/page helper最終確認（SPEC-DEEP-045a/045b）

- `getPermissions`は複数role由来permissionを重複した配列で返し得る。未知roleは拒否されず、その文字列自体をpermissionとして採用する。
- page routeとnavigationは共有`PAGE_ACCESS_POLICIES` catalogと`isPageAccessAllowed`を使用する。一般page policyは従来のadmin override、super-user wildcard、直接permission、preset展開を維持し、User管理policyだけは会社管理者または既知preset由来`users:write`へ限定する。
- 未登録pathは`getPageConfig`が親pathへfallbackするため、明示登録漏れが親の公開・権限設定を継承し得る。development validatorはwarningのみでbuildを失敗させない。
- 以上はnavigationとclient middlewareの表示・遷移制御であり、Firestore Rules/Functionsのactor・tenant認可を代替しない。

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-039
- 最終確認日: 2026-08-24
- 根拠ファイル: `constants/rolePresets.js`、`utils/auth/authorization.js`、`utils/auth/policies/pageAccessPolicy.js`、`stores/useAuthStore.js`、`composables/application/auth/useAuthActions.js`、`utils/pageSettings.js`、`middleware/auth.global.js`、schemas `src/User.js`、`src/parts/fieldDefinitions/array.js`、admin-sdk `src/commands/claims.js`
- 関連調査: `state-initialization.md`、`page-access.md`、`user-auth-lifecycle.md`

## 確認済み方針

- role/permissionによる機能制御は試作段階であり、現在のrole名、permission分割、actor範囲は確定仕様ではない。
- 本書はclient実装の導出・表示・route判定を記録する。UIを隠すことはFirestore RulesまたはFunctionsの認可を代替しない。

## role・permission契約

### roleの入力源

| 種類 | 保存・導出元 | 実装上の意味 |
| --- | --- | --- |
| 業務role | User documentの`roles: string[]` | preset名または直接permission文字列を格納できる。schemaは語彙・重複をvalidationしない。 |
| `admin` | User documentの`isAdmin` | `buildRoles`が追加する。custom claimではない。 |
| `super-user` | ID token claim `isSuperUser` | `buildRoles`が追加し、permissionを`["*"]`にする。 |
| `developer` | ID token claim `isDeveloper` | `buildRoles`が追加する。admin-sdkに付与・除去commandがある。 |

`buildRoles`はUser rolesをcopyし、各flagがtrueなら上記special roleを末尾へ追加する。重複排除はしない。複数roleは許容され、deny roleまたは明示denyの仕組みはない。

### preset一覧

| preset | 展開されるpermission |
| --- | --- |
| `manager` | customers/sites/employees/outsourcers/site-operation-schedules/operation-results/billings の各`write`、`users:provision`、`users:write` |
| `controller` | customers:read、sites:write、employees:read、outsourcers:read、site-operation-schedules:write、operation-results:write |
| `accountant` | customers/sites/employees/outsourcers/operation-resultsのread、operation-billings/billingsのwrite |
| `human-resource` | customers/sitesのread、employees:write、operation-results:read、`users:provision` |
| `labor` | customers/sites/employees/operation-resultsのread |
| `legal` | customers/sitesのwrite、employees:read |

各`*:write`は同じresourceの`*:read`を暗黙付与する。presetの継承関係はなく、複数presetのpermissionをSetでunionする。`super-user`を検出すると即座に`["*"]`を返す。

## 導出algorithm

1. Firebase session初期化時、tokenを強制refreshして`isSuperUser`、`isDeveloper`、`companyId`をstoreへ設定する。
2. claimのcompany pathから`Users/{uid}`をfetch・subscribeし、User `roles`と`isAdmin`をstoreへ反映する。
3. `buildRoles`がUser roles、claim flags、User `isAdmin`を1配列へまとめる。
4. `getPermissions`がpresetを展開し、未知文字列はそのままpermissionとして採用し、writeからreadを追加する。
5. route middlewareとnavigationは`auth.roles`と必要なraw User contextを`pageSettings`から共有page policy evaluatorへ渡す。componentは必要に応じてstoreの`hasRole`/`hasPermission`を直接使う。

role間の優先順位、deny、scope、company別role、期限付きroleは存在しない。

## 判定API

| API | 判定 |
| --- | --- |
| `hasRole(roles, role)` | role配列の完全一致。wildcard展開なし。 |
| `getPermissions(roles)` | preset union、未知文字列の直接permission化、write→read、super-user→`*`。 |
| strict User管理判定 | `users:provision`はmanagerとhuman-resourceへ、`users:write`はmanagerだけへpreset内で明示付与する。`users:write`からprovisionへの特殊展開は行わない。 |
| `hasPermission(permissions, permission)` | `*`または完全一致。admin特例なし。 |
| store `hasRole` | computed `roles`に対する`hasRole`。 |
| store `hasPermission` | computed `permissions`に対する`hasPermission`。 |
| `PAGE_ACCESS_POLICIES` | 35のpath付きpageが参照する13件のdeep-frozen policy descriptor。catalog identity外の値を未知policyとして扱う。 |
| `isPageAccessAllowed` | 一般pageの従来判定とstrict User管理判定をpolicy別に評価する純粋関数。client UX gateでありserver認可ではない。 |
| `isPageConfigAllowed` | configなし、未知・複製policy、legacy access field併記をfalseとし、既知policyだけを評価する。 |
| `isPageAllowed` | page configなしならfalse。configありなら`isPageConfigAllowed`。 |
| `getNavigationItems` | page routeと同じpolicy evaluatorで子itemをfilterし、pathなしgroupの表示をアクセス可能なnavigation childから導出する。 |

一般page policy内部のrequired role／permissionはANDではなくORである。ただし`SUPER_USER`と`DEVELOPER` policyはそれぞれのspecial roleを直接持つUserだけを許可する。adminはこの2種類の専用page以外の一般pageをpermissionに関係なく通過し、super-userは一般pageで`*`として扱われる。`USER_MANAGEMENT`はこの一般互換規則を使わない。

## UI data flow

```text
ID token claims ─┬─ isSuperUser / isDeveloper / companyId
                 │
User subscription ─ roles[] / isAdmin
                 │
                 ▼
        useAuthStore.roles
                 ├─ getPermissions → store.hasPermission → component表示/操作
                 └─ pageSettings → pageAccessPolicy.isPageAccessAllowed
                      ├─ auth.global route guard
                      └─ navigation item／group filter
```

middlewareは認証初期化完了を待ち、公開・email確認・maintenance判定後にpage configとroleを検査する。設定のない実在pageをmiddlewareが許可する既知fail-openは`page-access.md`の将来修正事項であり、`isPageAllowed`単体のfail-closedとは異なる。

## claims・更新反映

- User roles/isAdminはUser document subscriptionの更新によりclient storeへ反映される。roles変更にclaims更新は不要である。
- isSuperUser/isDeveloper/companyIdはsession初期化時に取得したID token claimsで、Auth token更新を検知して再評価する独立listenerは確認できない。
- admin移譲はUser documentsのisAdminをtransaction更新するため、購読が生きていればstore roleへ反映される。
- company切替UIや同一sessionでcompany claim/prefixを切り替える契約は確認できない。companyId claimが欠ける場合、Userを取得せず`Companies/unknown`へprefixを設定する。
- logout/clear時はclaim由来flagsとUserを初期化する。

## unknown・error

- User rolesが配列でなければ`buildRoles`は空配列からspecial rolesだけを構築する。`getPermissions`へ非配列を直接渡すと空配列を返す。
- 一般page evaluatorの`userRoles`は`useAuthStore.roles`が供給する配列をcaller契約とする。`PUBLIC`と`AUTHENTICATED`はrole内容に依存せず、任意の不正入力を新たなroute認可規則として扱う変更は本移行に含めない。
- 未知role、typo、未知permissionは一般`getPermissions`ではerrorにならず、その文字列自体をpermissionにする。ただし`USER_MANAGEMENT`はraw rolesを既知presetだけに限定してfail closedとする。
- page access policyはcentral catalog化されたが、componentが直接使うrole/permission文字列とpreset全体の語彙は引き続き単一enumへ統合されていない。
- `validatePageSettings`はdevelopmentだけconsole warningを出すが、validator自体は単体test可能である。重複ID・path、path policy欠損・未知policy・legacy field、group policy、不完全nodeを検査する。
- pathなしgroupはaccess policyを持たないため、親子permission包含関係の検査とdriftは廃止された。

## server enforcement境界

- client route/navigation/component判定はUX上の制御であり、直接Firestore SDK、callable、triggerの実行を防止しない。
- Firestore Rulesはtoken claims、path、document fieldsを各matchで独自判定し、clientの`ROLE_PRESETS`や`PAGE_ACCESS_POLICIES`／`isPageAccessAllowed`を共有しない。
- Functionsも各入口でactor・tenant・roleを個別検証する必要がある。clientでadmin扱いでもserverで同じ権限を持つとは限らず、その逆もある。
- `isAdmin`はUser document、`isSuperUser`/`isDeveloper`はclaimsという別のtrust sourceにあり、serverごとの利用差が生じ得る。

## 矛盾・未使用候補

- page accessの`roles` fieldとpermission値の混在は共有policy参照へ置換された。ただしpolicy内部とcomponent側のpermission語彙は別管理である。
- 一般page policyではadminを広く許可する一方、store `getPermissions(["admin"])`は`admin`文字列だけを返す。このためadminがrouteへ入れても、componentの`hasPermission("x:write")`ではfalseになり得る。
- storeコメントのpreset一覧から`human-resource`が欠落する。
- presetには`operation-billings:write`があるが、pageSettingsの請求系入口は`billings:read`を使い、両permissionの境界は正式化されていない。
- 一般authorizationがunknown roleをpermissionとして扱うため、typoとcustom direct permissionを区別できない。User管理page policyはこの互換挙動を採用しない。
- deny、permission version、role revision、監査情報は未実装である。

## 将来要対応

- FUT-0133: admin/special roleを含むrouteとcomponentの実効権限判定を統一する。
- FUT-0134: role/permission語彙、validation、unknown処理をcentral contract化する。
- `getPermissions`は現行callerが残るlegacy互換APIであり、UWBのstrict認可へ新しい包含規則を追加しない。FUT-0133/0134の単一authorization API移行後に置換・削除可否を判断する。
- FUT-0135: claimsとUser role変更の反映・失効・company境界を検証可能にする。
- 個別業務のserver認可不足は既存future-actionsを参照し、本項目で重複登録しない。

## 要確認事項

- CONF-0111: 正式なrole/permission matrixとspecial roleの意味。
- CONF-0112: required permissionのOR/AND、admin override、denyの正式意味。
- CONF-0113: role/claim変更の反映時期、強制logout、company切替方針。

## 未確認範囲

- 個別page/componentの全permission使用箇所、Firestore Rules全体、Functions全入口。
- Emulator/実claimsによるrole変更、token expiry/refresh、複数tab、offline復帰の動作。
- 正式な運用担当者、最小権限matrix、既存Userの未知role・重複・stale claim実データ。
