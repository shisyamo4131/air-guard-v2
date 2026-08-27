# 開発workflow runbook

- 状態: 運用中
- 最終確認日: 2026-08-27
- 役割: 通常開発の担当、変更単位、UI error・loading、client操作policy

## 担当と変更単位

- application codeの標準実装者はユーザーとする。
- Codexは変更前の現行挙動、仕様、影響、失敗経路、互換性、rollback、確認方法を整理し、ユーザー実装後の差分review、許可済みtest、documentとlocal Gitを管理する。
- Codexの`developer`によるapplication code編集は、ユーザーが対象fileまたは機能境界を明示した補助実装だけで行う。
- `tester`によるtest code編集は明示されたtest scopeだけで行い、application codeを変更しない。
- 認証・認可・tenant分離は一括改修せず、独立して説明・review・rollbackできる最小segmentを1件ずつ扱う。

## 非同期UI操作のerror・loading責務

2026-08-17に、特定機能へ限定しないproject共通原則として次を確定した。

- `AirArrayManager`または`AirItemManager`がsubmitを管理するCRUDでは、operation handlerはerrorを握りつぶさずmanagerへrejectを伝播する。managerの`error` eventを`useBaseManager`、`useLogger`、`useErrorsStore`、`useMessagesStore`へ接続し、component内で同じerrorを重複して`logger.error()`または`errors.add()`へ渡さない。
- manager管理下のCRUDはmanager固有の処理中状態を使用し、理由なくglobal loadingを重ねない。確認、取消、処理中、失敗後のdialog維持はmanagerの契約として扱う。
- manager外の独立操作は、`useLoadingsStore.add()`、`try`、成功message、`catch`での`logger.error({ error })`、`finally`でのloading削除を基本形とする。errorをcallerへ再伝播するか吸収するかはoperationの成功条件として明示する。
- Callableはserver側で内部情報を含まないcode・利用者向けmessageへ変換する。clientは安全なmessageをfeedback経路へ渡し、UID、会社ID、内部例外、秘密情報を画面へ表示しない。
- `useLogger`へ`useErrorsStore()`を渡した場合、`logger.error()`がErrors Storeとerror色messageの登録を兼ねる。同じerrorへ`errors.add()`を併用しない。
- error/loading基盤全体のtyped error、retry、owner、reference count、取消し、layout lifecycleはFUT-0136、FUT-0137、FUT-0139で継続する。Air managerの責務分割はFUT-0181へ統合し、現時点では低優先度の構造整理として扱う一方、既知のdisable・single-flight等の安全上の不具合は同FUTの重大度を維持する。

## Client操作policyとcomposableの責務

2026-08-17に、特定機能へ限定しないproject共通原則として次を確定した。判断理由は[ADR 0019](../decisions/0019-client-operation-policy-composable-boundary.md)を正とする。

- ドメイン上の操作可否をclientで事前検証する場合、Vue、component、Firebase transportへ依存しない純粋policyを設ける。
- application composableがpolicyをreactiveな状態へ適用し、操作可否、安定した拒否理由、実行処理をcomponentへ提供する。
- componentはrole、permission、対象状態のpolicyを再実装せず、composableの結果を表示と操作へ反映する。
- composableはrequest送信直前にもpolicyを再評価し、拒否状態では送信しない。
- client事前判定を認可境界として扱わず、serverはidentity、actor、tenant、対象、入力、最新状態を必ず再検証する。
- field単体の必須、文字数、書式validationはこの構造を強制せず、既存validatorまたはcomponent ruleを使用できる。
- 既存機能は一括移行せず、新規機能と改修対象機能からpolicy、composable、component接続、server共通条件parity testを小segmentで追加する。

認証・認可segmentは、実装前に次を揃えます。

```text
segment: <一つの入口・権限・data境界>
current-behavior: <codeとtestから確認した現行挙動>
threat-or-failure: <actor、前提、操作、影響>
in-scope: <今回変更するfile・rule・contract>
out-of-scope: <後続segmentへ残す境界>
proposed-contract: <許可・拒否・状態遷移>
compatibility-and-data: <既存利用者・data・migrationへの影響>
rollback: <code、rule、data、外部作用を戻す条件と方法>
tests: <許可経路、拒否経路、tenant境界、失敗経路>
user-confirmation: <実装前判断と実装後確認>
```

開発環境:

```powershell
npm run dev
```
