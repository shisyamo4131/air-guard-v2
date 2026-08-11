# Atoms buttons / chips deep review

## Metadata

- Status: implementation investigation (deep review)
- Checkpoint: SPEC-DEEP-017
- Last verified: 2026-08-11
- Sources: `components/atoms/Btns/Cancel.vue`, `Edit.vue`, `Select.vue`, `Submit.vue`, `useBtns.js`, `components/atoms/chips/ArrangementNotification.vue`, `isStartNextDay.vue`; direct callers `components/molecules/Actions/{Edit,SelectCancel,SubmitCancel}.vue`

## Scope and responsibility

| File / public component | Confirmed responsibility and contract |
| --- | --- |
| `AtomsBtnsCancel` | Wraps `v-btn`; defaults to cancel text and close icon; re-emits native click event. |
| `AtomsBtnsEdit` | Same wrapper with edit defaults. |
| `AtomsBtnsSelect` | Same wrapper with primary/select defaults. |
| `AtomsBtnsSubmit` | Same wrapper with primary/submit defaults. |
| `useBtns(props, emit)` | Returns computed `attrs` for the four wrappers. `icon` truthiness switches between icon-only and text-plus-prepend-icon modes, and maps click to `emit("click", event)`. |
| `components/atoms/chips/ArrangementNotification.vue` | A standalone `v-chip` that accepts optional `notification`, obtains a status definition from `ArrangementNotification.STATUS`, and emits the notification on click when one exists. |
| `components/atoms/chips/isStartNextDay.vue` | Fixed, compact secondary `v-chip` showing the next-day label; no props or emitted events. |

## Caller and state boundary

- Static callers of the button wrappers are `components/molecules/Actions/{Edit,SelectCancel,SubmitCancel}.vue`. They create no records themselves; their parent owns persistence, authorization, error feedback, and retry policy.
- `MoleculesActionsEdit` disables its sole edit button while `disabled` or `loading`; Select/Submit wrappers leave cancel enabled during loading but disable the primary action and pass Vuetify `loading` to it.
- The atom buttons add no local submitting latch, debounce, validation, confirmation, permission check, error display, or rollback. A second activation remains possible until the direct caller changes `loading` or the parent makes its handler idempotent.
- No static caller/import was found for either file under `components/atoms/chips/`. The actively referenced notification display is the distinct `components/ArrangementNotification/Chip/index.vue`; the active next-day input is the distinct `components/IsStartNextDay/Checkbox.vue`. Nuxt auto-registration can make dynamic/template-only reachability possible, so this is an unused candidate rather than a deletion conclusion.

## Attributes, fallback, and accessibility

- Button components expose `color`, `icon`, `prependIcon`, and `text`; other `v-btn` attributes fall through automatically. `useBtns` combines resolved props with `icon`, `prependIcon`, `text`, and `onClick`, so its click handler occupies that binding key.
- For a missing notification, the ArrangementNotification atom supplies a local `TEMPORARY` fallback and installs no click handler. For a present notification, it indexes `ArrangementNotification.STATUS[notification.status]` without an unknown-status fallback. An unrecognized status leaves `status` undefined, so the template's `status.title` access is unsafe.
- The atom chip deliberately spreads `useAttrs()` (`inheritAttrs: false`). Its notification click emit overwrites a caller click attribute when a notification exists; when none exists, the caller click attribute remains forwarded.
- The button atoms rely on Vuetify for keyboard behavior and accessible name. Text mode supplies visible text; icon mode removes text and adds no accessible-name prop, leaving callers responsible for a suitable label. `isStartNextDay` has fixed text and is noninteractive.

## Validation, permissions, and effects

- No target component validates values, consults roles, reads/writes Firestore, calls Functions, or invokes external services.
- `useDefaults` allows Vuetify default overrides. Effective runtime attributes, dynamic component reachability, and Vuetify's accessible-name behavior were not exercised.
- No static test reference to the seven files or their generated component names was found.

## Consistency and future work

- The common UI catalog describes the button role but did not distinguish `useBtns` click/attribute overwrite behavior, icon-only accessible-name boundary, or legacy chip reachability. This checkpoint adds that evidence to FUT-0115 and FUT-0117.
- See FUT-0115, FUT-0117, and FUT-0172 in [future actions](future-actions.md). No user-decision confirmation was added.

## Unverified boundaries

- Rendered Vuetify accessible-name behavior; actual dynamic use of the two chip files; production component auto-import configuration; pointer/keyboard behavior while a parent is loading; and test coverage outside static matches.
