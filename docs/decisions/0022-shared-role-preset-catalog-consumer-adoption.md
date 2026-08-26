# 0022 共有role preset catalogのconsumer導入

- 日付: 2026-08-26
- 状態: Accepted
- 関連仕様: システム境界、テナントと認証
- 関連判断: [0012](0012-feature-branch-acceptance-and-related-repositories.md)、[0018](0018-user-provisioning-and-employee-link-boundary.md)

## 背景

AirGuardV2のルートアプリとCloud Functionsは同一内容のrole preset catalogを別々のlocal fileとして保持していた。表示metadataとpermission割当の変更が片側だけへ反映されると、UI表示、clientの事前判定、Functionsの最終認可が異なる危険がある。Schemas packageは環境非依存のrole・permission・display catalogを公開できる一方、actorやtenantを使うruntime認可はconsumerの責務である。

## 決定

- `@shisyamo4131/air-guard-v2-schemas/constants`の`ROLE_PRESETS`、`ROLE_PRESET_IDS`、`isRolePresetId`をrole preset catalogの単一正本とする。
- ルートアプリとCloud Functionsは公開済みexact `2.4.2-dev.166`を使用し、manifest、lock、実installのversion、resolved tarball、integrityを一致させる。rangeや`@dev`による独立更新はこのcatalog導入に使わない。
- 両consumerのlocal `rolePresets.js`を削除し、直接利用箇所を公開`./constants` subpathへ移行する。package rootからのre-exportには依存しない。
- strict client/Functions経路は`isRolePresetId`でown-catalog membershipを確認し、未知role、直接permission文字列、`toString`、`constructor`、`__proto__`をfail closedとする。
- packageはcatalog membershipだけを提供し、`hasPresetPermission`、`resolveRolePermissions`、write→read導出、actor・tenant・target・request contextを使うallow/deny判定はAirGuardV2に残す。
- 一般clientの`getPermissions`が未知文字列を直接permissionとして扱う既存互換挙動は維持するが、strict User管理・lifecycle認可には使用しない。

## 理由

clientとFunctionsが同じversion・contentを使うことでcatalog driftを除去しつつ、環境非依存dataとruntime authorizationのtrust boundaryを混在させないためである。exact pinとlock parityは、authorization-sensitiveなpreset変更がconsumerごとに異なる時点で入ることを防ぐ。

## 代替案

- local catalogを維持してparity testだけ行う案: 複製自体が残り、更新漏れを防げないため採用しない。
- packageへ`hasPresetPermission`やFunctions resolverも移す案: client/server固有の認可policyとruntime contextをshared data contractへ混在させるため採用しない。
- semver rangeまたは`@dev`を両consumerで指定する案: install時点によるcontent差を許すため採用しない。
- 一般`getPermissions`を同時にstrict化する案: 既存の直接permission互換を破壊し、UWB-09のcatalog統合を超えるため採用しない。

## 影響

- package: 公開Schemas `2.4.2-dev.166`が必要であり、packageのtag、workflow、registry integrity、fresh installはconsumer変更前に確認済みである。
- application: ルートとFunctionsのdependency・lock、catalog import、strict membership判定を更新し、重複local catalogを削除する。
- security: prototype inherited propertyを既知presetと誤認する経路を閉じる。preset permissionの追加・削除は構造上additiveでもauthorization-sensitiveなmaterial changeとして扱う。
- compatibility: 一般clientのunknown-as-direct-permissionとconsumer側write→read規則を維持する。

## 移行

Schemasを先に公開確認し、ルートとFunctionsのdependency・lockを同時にexact versionへ更新する。全importを公開subpathへ移した後だけlocal catalogを削除し、別install実体のcatalog parity、manifest/lock parity、strict prototype-key拒否、一般互換、全domain testをNode 22で確認する。UI表示値とpolicy値を変えないdata/import refactorであるため、Emulator・browser受入れをUWB-09の必須gateにはしない。

## ロールバック

AirGuardV2の依存をexact `2.4.2-dev.164`へ戻し、両local catalogとpackage import以前のcatalog参照を同じconsumer commitで復元する。ただし、旧truthy lookupは復元せず、local catalogに対するprototype-safe own-property membershipをstrict経路と一般展開へ維持する。prototype-key陰性test、parity test、policy testを再実行し、rollback差分も独立reviewする。公開済みSchemas versionは残し、npm unpublish、tag削除、force push、history rewriteを行わない。

## 再検討条件

正式な全role・permission matrix、permission語彙のvalidation、一般`getPermissions`の直接permission互換廃止、package catalogのfield・preset permission変更、または新しいconsumerを追加するときに再検討する。
