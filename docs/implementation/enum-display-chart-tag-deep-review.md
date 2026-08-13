# Enum display, chart, and Tag components deep review

## Metadata

- Status: implementation investigation (deep review)
- Checkpoint: SPEC-DEEP-019、SPEC-DEEP-041
- Last verified: 2026-08-12
- Sources: the 13 exact files in `components/Charts/**`, `DayType/**`, `EmploymentStatus/**`, `IsStartNextDay/**`, `SecurityType/**`, `ShiftType/**`, and `Tag/**`
- Direct callers/dependencies read: dashboard chart caller, representative ShiftType/EmploymentStatus/SecurityType/IsStartNextDay/Tag callers, and `useOperationQuantityBySecurityTypeInRange.js`

## Public contracts

| Component/file | Contract and confirmed behavior |
| --- | --- |
| `ChartsWeeklyOperationQuantityBar/index.vue` | Props `borderWidth` (1), `hideLabel` (false), unused `label` (稼働数), `startDate` (today in timezone); forwards attrs to `vue-chartjs` Bar. |
| `WeeklyOperationQuantityBar/useChartData.js` | Subscribes to 7-day schedules and OperationResults, then builds date × security-type datasets. OperationResult quantity replaces a schedule quantity only when the same `docId` is present. |
| `WeeklyOperationQuantityBar/useChartOptions.js` | Returns a plain options object: responsive, stacked axes, and legend visibility from setup-time `hideLabel`. |
| `DayType/Chip.vue` | Required `dayType`; constant title/color mapping; unknown mapping displays `ERROR` and no color. |
| `EmploymentStatus/Chip.vue` | Required `value`; direct constant title/color lookup with no unknown fallback. |
| `IsStartNextDay/Checkbox.vue` | Attribute-only wrapper around `air-checkbox`; supplies an explanatory label tooltip and example, no own model/state. |
| `SecurityType/Select/index.vue` | Optional label (警備種別); builds items from `SECURITY_TYPE` and forwards select attrs/model. |
| `ShiftType/Chip.vue` | Required schema-key `shiftType`; validator uses `SHIFT_TYPE_VALUES`; unknown mapping displays `ERROR` and no color. |
| `ShiftType/RadioGroup.vue` | `v-model`, optional `useAll`; renders each `SHIFT_TYPE` value and optional literal `ALL`. |
| `ShiftType/Tabs.vue` | `modelValue` defaults to first `SHIFT_TYPE_OPTIONS` value and validates schema keys; local `tab` mirrors prop and emits updates on local changes. |
| `Tag/index.vue`, `props.js`, `useIndex.js` | Tag props include label/loading/removable/removeIcon/highlight/isDraggable/size/variant/border/rounded; named slots and `click:remove`. It computes responsive size, classes, loading text, and remove-button attrs; parent owns deletion. |

## Reachability and caller boundaries

- The chart is mounted only in the dashboard's admin+developer row found by static search. Its data composable reads schedule and result layers; chart display itself has no loading/error/empty state.
- ShiftType chips are used in agreement, arrangement, schedule, operation-result, operation-billing, and site-order displays. ShiftType Tabs is used by Agreements Viewer; SecurityType Select is used by the Sites filter; IsStartNextDay is used by Agreement, ArrangementNotification, and schedule inputs.
- EmploymentStatus Chip is used by Employee Card. Tag is wrapped by Employee/Outsourcer tags and worker display paths. The exact DayType Chip and ShiftType RadioGroup had no static caller/import in the searched app paths; they remain unused/dynamic candidates, not deletion conclusions.
- No target component performs persistence or authorization. Tags emit a removal event after stopping propagation; their parents must implement deletion, retry, and permission handling.

## Validation, fallback, and state findings

- DayType and ShiftType chips use safe `ERROR` fallback, but EmploymentStatus direct indexing can throw for an unknown value. This is evidence for the existing enum contract FUT-0166.
- ShiftType Tabs and RadioGroup derive from different constants (`SHIFT_TYPE_OPTIONS` versus iteration over `SHIFT_TYPE`), while `ALL` exists only in RadioGroup and is not a schema shift value. Caller filters must treat it as UI-only.
- Tabs mirrors prop changes through a watcher and emits local changes; no loading, disabled, or duplicate-transition guard is implemented in the atom.
- Tag's validator lowercases for acceptance but `useIndex` uses the original `props.variant` in the CSS class. Uppercase accepted inputs therefore do not match lowercase CSS classes. Loading hides label and disables the remove action; mobile forces small sizing and hides loading text. No keyboard drag/reorder operation exists in Tag itself.
- `IsStartNextDay` provides a tooltip explanation but relies on the underlying Air checkbox for model/validation and accessible labeling. SecurityType Select relies on Air select for filtering/error/empty behavior.
- The chart aggregation can retain unknown security types in its intermediate map, but only known `SECURITY_TYPE` values become datasets; those quantities are not visible. `label` is not used, `hideLabel` is not reactive after setup, and OperationResult/schedule input failures are not surfaced by this layer.
- SPEC-DEEP-041 confirmed that quantity aggregation does not validate finite/nonnegative numeric inputs. `requiredPersonnel` or result quantity can therefore concatenate as a string or propagate `NaN`; missing/unknown date and security type are grouped outside the rendered known datasets. The older total-only composable has no static caller and is an explicit source-marked unused candidate.

## Consistency and future actions

- Existing common UI documentation is updated with these boundaries. Findings are integrated into FUT-0115 (icon/drag accessibility), FUT-0132 (UI ownership boundary), FUT-0155/FUT-0156 (dashboard/chart query and KPI semantics), and FUT-0166 (enum/fallback contract). No new CONF or FUT was necessary.
- Full source evidence is in this document; this does not establish a production KPI or approve any role/permission design.

## Unverified boundaries

- Chart.js rendering and registration, live query cleanup/cache behavior, unknown production enum data, Air component validation/ARIA behavior, dynamic Nuxt component reachability, and runtime tests were not exercised.
