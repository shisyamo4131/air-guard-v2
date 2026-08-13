# Atoms core controls deep review

## Metadata

- Status: implementation investigation (deep review)
- Checkpoint: SPEC-DEEP-018
- Last verified: 2026-08-11
- Sources: `components/atoms/{BillingUnitTypeChip,HourInput,QualifiedTypeChip,SearchTextField}.vue`, `components/atoms/alerts/Warn.vue`, `components/atoms/dialogs/Fullscreen.vue`, `components/atoms/icons/{Draggable,HasLicense,HolidayFlag}.vue`
- Direct callers/setting boundary read: `components/Agreement/Input/index.vue`, `components/Arrangements/Manager/index.vue`, `components/Users/Manager/index.vue`, `components/Tag/index.vue`, `components/Workers/Table/Tr.vue`, `plugins/04.vuetify.js`

## Public contracts

| Component | Props / events / slots | Confirmed responsibility |
| --- | --- | --- |
| `AtomsBillingUnitTypeChip` | required `billingUnitType`; validator admits keys of `BILLING_UNIT_TYPE_VALUES` | Resolves title/color through `useConstants`; shows `ERROR` and no color if no resolved entry. |
| `AtomsHourInput` | default `v-model`; `precision` default `1`; emits `update:modelValue`; forwards slots/attrs to `air-number-input` | Displays minute model as hours; emits `Math.round(hours * 60)` in minutes. Null/undefined/non-number becomes null. |
| `AtomsQualifiedTypeChip` | required `type` (`BASE`/`QUALIFIED`); declared `label` and `variant` | Resolves title/color through `useConstants`; unknown value displays `ERROR`. The declared `label` and `variant` are not bound to `v-chip`. |
| `AtomsSearchTextField` | No declared props/emits/slots; root attrs fall through | Supplies compact, clearable SEARCH defaults and magnifier to `air-text-field`; parent owns model, query delay, loading, empty and error state. |
| `AtomsAlertsWarn` | `border`, `density`, `variant`; default slot | Fixed warning `v-alert`; other root attrs fall through. It has no close/error/retry state of its own. |
| `AtomsDialogsFullscreen` | No declared props/emits; forwards all slots and root attrs | Renders `v-dialog`, forcing `fullscreen` from Vuetify `mobile`; parent-provided `v-model`, scrollability, dimensions, close handling and focus-trigger contract fall through. |
| `AtomsIconsDraggable` | None | Displays an `mdi-drag` icon with cursor-grab CSS only; it does not implement drag, keyboard movement, a label, or `draggable`. |
| `AtomsIconsHasLicense` | `color`, plus manually forwarded attrs | Displays `mdi-license`; caller supplies size and any title/aria attributes. |
| `AtomsIconsHolidayFlag` | `color` | Displays `mdi-flag-variant`; root attrs fall through automatically. |

## Caller, reachability, and effects

- `AtomsHourInput` is used in Agreement, arrangement notification, schedule, operation-result, and operation-billing input paths. The sampled Agreement caller supplies model/label/step; domain validation and persistence remain outside the atom.
- `AtomsSearchTextField` is used by master/user managers and pages. It is only the text field; there is no atom-level debounce, query, error, or empty-result messaging.
- `AtomsDialogsFullscreen` is used for schedule selection/reordering and SelectCancel. Its responsive fullscreen rule is presentation-only; it neither opens nor closes a dialog itself.
- `AtomsIconsDraggable` and `AtomsIconsHasLicense` are used in reusable Tag/worker display paths. No static caller/import was found for `AtomsBillingUnitTypeChip`, `AtomsQualifiedTypeChip`, `AtomsAlertsWarn`, or `AtomsIconsHolidayFlag`; plugin defaults alone are not a render caller. They remain dynamic/template-only reachability candidates rather than deletion conclusions.
- No target atom reads/writes Firestore, calls Functions, evaluates a role/permission, or sends an external request.

## Validation, fallback, and accessibility

- Both enum chip validators can warn during Vue prop validation, but the display code retains an `ERROR` fallback. Billing chip accepts only schema keys at the prop boundary; Qualified chip allows only two literals. Neither records unknown input or provides a diagnostic action.
- `HourInput` checks JavaScript type only. `NaN` and infinities are numbers and can therefore reach `Math.round(value * 60)`; min/max/required/finite validation is delegated to attributes and `air-number-input` behavior, which was not run.
- Icon-only atoms do not provide independent accessible names. `Draggable` is visual affordance only, so keyboard users require the surrounding drag alternative. This confirms additional evidence for FUT-0115.
- The dialog forwards slots, including activator/default slots, but neither documents nor enforces focus return, Escape/close policy, or unsaved-change confirmation. Vuetify runtime semantics were not exercised.

## Consistency and future actions

- The common UI catalog is updated with the declared-but-unused QualifiedType props, HourInput numeric boundary, and static-unreached candidates.
- FUT-0115 gains icon/drag evidence. FUT-0173 records the atom-level defensive input/display and dead-candidate cleanup work. No user-decision confirmation was added.

## Unverified boundaries

- Dynamic Nuxt component reachability; rendered Vuetify/Air input validation and ARIA behavior; actual dialog focus/Escape/activator behavior; useConstants loading/error behavior; and all runtime tests.
