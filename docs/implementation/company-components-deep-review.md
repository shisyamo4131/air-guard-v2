# Company and root navigation components deep review

> 2026-08-30: Company設定から既定取極めcallerを撤去し、`siteOrder`・`scheduleOrder`を専用Callableへ移行した。以下の旧Company全体writer調査は、CPU-05で残存callerを除去するための履歴inventoryとして読む。現行契約は[Company設定](company-settings.md)と[ADR 0035](../decisions/0035-company-display-order-update-boundary.md)を正とする。

## Metadata

- Status: implementation investigation (deep review)
- Checkpoint: SPEC-DEEP-020
- Last verified: 2026-08-11
- Exact sources: `components/AppNavigationDrawer.vue`; `components/Company/Activator/{Base,Bank,Setting}.vue`; `components/Company/Manager/index.vue`; `components/Company/Table/{BaseInfo,BankInfo,SettingInfo}.vue`
- Direct dependencies/callers read: `/settings/company`, default layout, `useBaseManager`, and Company schema

## Component contracts

| Component | Props / emits / slots / responsibility |
| --- | --- |
| `AppNavigationDrawer` | No declared props/emits; root attrs fall through to `v-navigation-drawer`; builds items from `auth.roles`, marks child route active, and exposes append slot. |
| `CompanyActivatorBase` | Required Company `item`, optional title, `click:edit(item)`, actions slot; displays company/address/contact/invoice information and exposes editable key list. |
| `CompanyActivatorBank` | Same activator contract for five bank fields. |
| `CompanyActivatorSetting` | Same contract for minute interval, round mode, first weekday, and attendance mode. |
| `CompanyManager` | Required object `doc`; passes loading/error attrs from `useBaseManager` to `air-item-manager`; rejects create/delete and delegates update to `item.update(item)`; forwards activator and all slots. |
| `CompanyTableBaseInfo` | Plain display props for company name/kana/address/tel/fax; no events or validation. |
| `CompanyTableBankInfo` | Plain display props for five bank values. |
| `CompanyTableSettingInfo` | Displays minute interval, RoundSetting label, weekday title, and attendance-mode title from plain props. |

## Company data and editing boundary

- The active settings page takes the stable reactive Company instance from `useCompanyStore` and mounts three CompanyManager/Activator pairs plus AgreementsManager. The activator `defineExpose(includedKeys)` lists determine the manager editor fields.
- Base keys are `companyName`, `companyNameKana`, `address`, `tel`, `fax`, and `invoiceNumber`. They omit `zipcode`, `prefCode`, `city`, and `building`, although the display uses computed `fullAddress` and `isCompleteRequiredFields` requires the address parts.
- Bank keys are `bankName`, `branchName`, `accountType`, `accountNumber`, and `accountHolder`. Setting keys are `minuteInterval`, `roundSetting`, `firstDayOfWeek`, and `attendanceManagementMode`.
- Hidden identity/integration fields (`stripeCustomerId`, `subscription`, maintenance fields, location, orders) are not exposed by these three activators. They remain in the same Company document and are not protected by Manager-level field authorization.
- Invoice display prepends `T` to any truthy stored `invoiceNumber`; no normalization prevents a stored `T` from becoming a visual double prefix. Missing display values use `-`.
- `minuteInterval` displays `- 分` for a falsy value; RoundSetting/day/attendance mappings use mixed fallback behavior. Activator Setting uses safe optional fallback for day/attendance, but legacy Table Setting directly dereferences `DAY_OF_WEEK_VALUES[firstDayOfWeek].title` and can fail on unknown/out-of-range input.

## Update, state, and failure handling

- CompanyManager has no create/delete UI path and its handlers throw if invoked. Update is a direct client model update; no transaction/version/precondition, server allowlist, audit reason, or local rollback is added here.
- `useBaseManager` tracks a boolean `isLoading` from AirItemManager events and routes errors to the common logger/store. Manager itself adds no synchronous submit latch, dirty-state prompt, cancellation rollback, success message, or retry policy; these remain AirItemManager/parent behavior.
- Each activator always renders an icon-only edit button and emits immediately. It does not inspect roles, loading, disabled state, or dirty state. The page route uses the shared `ADMIN` access policy, which permits company admin and super-user under the retained general-page semantics, while Firestore Company rules remain broader as documented elsewhere.
- CompanyStore exposes one reactive Company instance; these components do not subscribe independently. Changes to roundSetting, maintenance, subscription, or global settings are observed elsewhere through store/plugin consumers, not through these display components.

## Validation and field effects

- Activator props validate `instanceof Company`; CompanyManager only validates `doc` as an object. A plain object can therefore reach `item.update(item)` and fail at runtime.
- Actual field definitions/defaults reside in Company schema: Company names are required, bank lengths/account type, minute interval UI min/max, round mode, weekday, attendance mode, subscription defaults, and maintenance fields. The component layer does not add server-side validation.
- Changes affect live consumers: invoice/PDF issuer/bank information, process-global client rounding mode, attendance/week presentation, maintenance routing, subscription/customerType, and ordering. These components do not snapshot or warn about those downstream effects.

## Navigation and accessibility

- Drawer navigation is derived from `getNavigationItems(auth.roles)`. UI filtering is not server authorization. `route.name.endsWith` has no null/type guard; this reconfirms FUT-0118.
- Drawer items rely on Vuetify keyboard semantics. Company edit controls are icon-only with no explicit accessible label/tooltip; this adds evidence to FUT-0115. Tables have labels in first cells but no explicit captions or scope attributes.

## Reachability and unused candidates

- Active callers: default layout uses AppNavigationDrawer; `/settings/company` uses CompanyManager and the three Activators.
- No static caller/import was found for the three `Company/Table/*Info.vue` files. They overlap with active Activator display responsibilities and are unused/dynamic candidates, not deletion conclusions.
- No direct static tests for the eight files were found.

## Future actions and unverified boundaries

- Findings were integrated into FUT-0090, FUT-0092, FUT-0115, FUT-0118, and FUT-0166. FUT-0094's unused `ScheduleOrder` constructor remains confirmed but was not newly discovered here. No new FUT or CONF was necessary.
- Unverified: AirItemManager internals, runtime double-submit/dirty behavior, rendered accessibility, dynamic component reachability, real Firestore writes, Rules execution, and external services.
