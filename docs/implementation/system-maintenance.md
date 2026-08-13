# System設定・システム/会社メンテナンス制御（実装調査）

## メタデータ

- 状態: 実装調査
- 対象セグメント: SPEC-SEG-028、SPEC-DEEP-040
- 最終確認日: 2026-08-12
- 根拠ファイル: `stores/useSystemStore.js`、`composables/application/system/useSystemActions.js`、`plugins/07.system.js`、`plugins/02.firebase.auth.js`、`middleware/auth.global.js`、`pages/maintenance.vue`、`firestore.rules`、schemas `src/System.js`、`src/Company.js`、admin-sdk `src/commands/system.js`、`src/commands/companies.js`、`src/commands/backup.js`

## 確認済み環境

### ユーザー確認済み

- 試用先として既存DEV Firebase projectを使用する。
- PROD Firebase環境はまだ用意されていない。
- Emulatorは実機/PCの動作確認にも使う別環境である。

### 実装上の判定

- `useSystemStore.isDev`は`process.env.NODE_ENV === "development"`だけで決まり、Firebase projectがDEV/PROD/Emulatorのどれかは判定しない。
- System documentにenvironment fieldはない。Admin SDK初期化は`version: "1.0.0"`を保存するが、System schemaのclassPropsにversion/createdAtはない。
- したがってユーザー確認済み環境状況と、build modeの`isDev`は別概念である。

## データ契約

### System

- path/doc IDは固定`System/system`。prefix、自動採番、logical deleteなし。
- schema fieldsはhidden `isMaintenance`（default false）、`updatedAt`（default null）、`lastMaintenanceBy`（default `admin-sdk`）。
- create/update/deleteはSystem classで明示的に未実装エラーを返し、client modelから変更できない。
- Admin SDK initializeは上記に加えてcreatedAt/versionを保存する。これらはclient System schema契約外である。

### Company maintenance

- Company fieldsはhidden `maintenanceMode`（default false）、`maintenanceReason`、`maintenanceStartAt`、`maintenanceStartedBy`。
- Admin SDKは`maintenanceStartedAt`（`StartAt`ではなく`StartedAt`）を書き、解除時に同fieldを削除して`maintenanceEndedAt/maintenanceEndedBy`を追加する。schemaとのfield名・field集合が一致しない。
- Company maintenanceに予定開始/終了期間はなく、booleanを即時切替する。

## 初期化・購読

1. `plugins/07.system.js`がSystem store/actionを取得し、maintenance computedのwatchを登録する。
2. `initializeSystem()`が`System/system`をfetchする。
3. fetch成功後に同docをlive subscribeする。
4. fetch/subscribe開始のtry内で例外になるとlogを記録し、local `system.isMaintenance=true`へ強制する。
5. Auth初期化がCompanyをclaim companyIdでfetch/subscribeすると、Company.maintenanceModeの変化もcomputedへ反映される。

System subscriptionの後続切断・permission/network error時にisMaintenanceへ切り替える明示callbackは確認できない。Company取得失敗時はCompany default falseのため、Systemがfalseなら会社maintenanceを認識できない。

## maintenance判定表

`isMaintenance = System.isMaintenance || Company.maintenanceMode || false`で、Systemが優先的に全体を止め、Companyが現在tenantだけを止める。

| System | Company | 実効値 | 対象 |
|---|---|---|---|
| false | false/未取得 | false | 通常route判定へ進む |
| true | 任意 | true | 未認証を含む全client session |
| false | true | true | Companyを取得した当該tenant session |
| fetch失敗 | 未取得 | true | local fail-closed |
| false取得済み | Company fetch失敗 | false | company maintenanceについてfail-open候補 |

role例外はなく、admin/developer/super-userも実効値trueならmaintenance pageだけへ送られる。

## route・UI

- global auth middlewareは認証準備より先にmaintenanceを判定する。trueなら`/maintenance`だけを許し、他routeをreplaceする。falseで`/maintenance`へ行くと`/`へ戻す。
- plugin watchもtrueへの変化で現在routeから`/maintenance`へ、falseへの変化で同pageから`/`へreplaceする。
- `/maintenance`はauth layoutの固定文言だけを表示する。System/Companyの区別、理由、開始日時、予定終了、更新者、再試行、logout、管理者導線は表示しない。
- maintenance pageに明示pageSettingsはないが、middleware専用分岐がpage access判定より先行する。
- plugin watchとmiddlewareが同じ遷移責務を持つが、前者はlive状態変化、後者は各navigationを扱う。

## 更新主体・Rules

- System Rulesは未認証readを許し、全client writeを拒否する。Admin SDK CLIがinitialize/status/on/off/toggleを行う。
- Company maintenanceはAdmin SDK CLIが会社ID指定でon/offし、backup/restore commandが排他前提としてmaintenanceModeを確認する。
- ただしCompany Rulesは同一会社の全認証UserへCompany全writeを許すため、clientからmaintenanceModeや関連fieldを直接変更できる。Admin専用境界ではない。
- アプリ内にSystem/Company maintenance設定UIや直接Callable Functionは確認できない。
- maintenance判定はclient route制御であり、Firestore Rules、Callable Functions、既に保持したSDK reference、外部clientを読書き禁止にはしない。

## failure・concurrency

- 初回System fetch失敗はlocal fail-closedだが、復旧後に自動再fetchする処理はなく、subscribeが開始されていないためreload等が必要となる。
- System on/offはread後merge setで冪等的に近いが、version/preconditionはなく同時CLI操作は後勝ち。
- Company on/offもread後updateでversion checkなし。直接client writeと競合できる。
- Company live subscriptionによりtenant mode変更は反映されるが、Company初期化が部分失敗してauth readyになる経路ではstale/default stateになり得る。
- route redirectは処理中のFirestore/Functions requestをcancelまたはrollbackしない。切替直前に開始したwriteの完了境界はない。

## 矛盾・未使用候補

- Admin SDKの`maintenanceStartedAt`とCompany schemaの`maintenanceStartAt`が不一致。schema fieldはCLIから設定されず、CLIが書く開始/終了fieldはschema外となる。
- Admin SDKのSystem `version/createdAt`はSystem schemaに定義されず、client契約から利用できない候補。
- CLIは会社maintenanceで「ユーザーはアプリを使用できない」、backupは排他前提とするが、実装はroute表示だけでRules/API writeを止めない。
- maintenance reason/timestamps/updaterを保存してもmaintenance pageは表示しない。
- System schemaの全操作拒否とRules write denyは一致するが、Company maintenance hidden fieldはCompany全write Rulesで保護されない。

## 将来要対応

- FUT-0095〜FUT-0098を`future-actions.md`へ登録し、FUT-0090へCompany maintenanceの証拠を追加した。

## 要確認事項

- CONF-0079〜CONF-0082を`pending-confirmations.md`へ登録した。

## 未確認範囲

- DEV Firebase/EmulatorのSystem実doc、network断、subscription再接続、route競合の実行結果。
- Firebase Functions/Rules levelでの保守中write排除、進行中request、background trigger、Service Workerの挙動。
- Admin SDK CLIの実行権限・監査・復旧runbook、PROD環境設計。

## System application action追加確認（SPEC-DEEP-040）

- 初期fetch成功後にlive subscribeするが、subscribe error channel・retry・last-known state・teardown ownerをactionは返さない。
- 初期fetch errorはloggerへ記録しlocal `isMaintenance=true`へ倒すためfail-closedだが、not-found、permission、network、corrupt dataを区別せず、復旧操作や再試行状態を画面へ公開しない。
