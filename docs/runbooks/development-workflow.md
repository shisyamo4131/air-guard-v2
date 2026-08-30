# 開発workflow runbook

- 状態: 運用中
- 最終確認日: 2026-08-29
- 役割: 通常開発の担当、変更単位、UI error・loading、client操作policy

## 担当と変更単位

- ユーザーが仕様、影響、rollback、検証条件を理解して明示承認したcheckpointまたはfeature boundary内では、Codexの`developer`をapplication実装の標準担当とする。
- Codex coordinatorは変更前の現行挙動、仕様、影響、失敗経路、互換性、rollback、確認方法を整理し、承認済みsegmentの実装、自動検証、独立review、必要なin-app UI smoke、document、roadmap、ADR、local Git統合を管理する。
- `developer`は承認済みscopeのapplication code、必要なFunctions・Firebase Rules・関連設定だけを変更し、隣接機能、未承認仕様、別repository、外部作用へ拡張しない。
- `tester`はcoordinatorが明示したtest scopeでtest codeを編集し、application codeを変更しない。承認済みcheckpointの検証に必要な個々のtest fileについて、利用者のfile-by-file承認は要求しない。
- UIまたは利用者操作へ影響するfeatureは、Codexの自動検証と必要なin-app UI smoke後も利用者受入れ待ちとし、別途承認された実際の利用環境で利用者が最終UI acceptanceを完了するまで最終完了としない。
- application implementation fileを1 fileずつ利用者が確認する手順は、checkpointが明示した場合だけ適用する。通常は承認済みsegment単位で連続実装・検証し、変更挙動、security境界、test、残存risk、rollback、利用者確認項目をまとめて提示する。
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

## Firestore Rulesを狭める改修順序

判断理由は[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)を正とする。Rules変更だけを無条件に先行releaseせず、次を確認してcutover方式を選ぶ。

1. 対象pathと全caller、whole-document replacement、対象環境、data件数、旧client併存、許容停止時間、外部作用を棚卸しする。
2. 将来Rulesが許可するpath、field、actor、operationを固定し、operationが所有するexact field updateを実装・検証する。
3. 新規pathは最初のdocument作成前にclient denyを確立する。候補Rulesのlocal実装・Emulator成功だけをdeploy readinessとみなさない。
4. 正式release前のDevで全件を一つのbounded maintenance内にbackup・変換・post-checkでき、旧clientを継続利用しない場合は、Rules、Functions、client、migrationを同じmaintenanceのcoordinated cutoverとして扱う。長期互換層、runtime mode、dual reader/writerを既定にしない。
5. production、複数client version、許容できない停止、bounded maintenanceへ収まらない件数・外部作用がある場合だけ、現行Rules下へ将来CRUDを先行導入し、旧・候補Rules双方の回帰、既存機能継続、旧writer 0件後にRulesを閉じる互換releaseを採用する。
6. deploy後は対象方式に応じ、Rules receipt、許可・拒否経路、migration post-check、主要UI、rollback先を確認する。

既存許可を直ちに閉じないとdata exposureが継続する緊急incidentは通常手順の例外とする。影響する機能、停止範囲、暫定対応、rollback、陰性testを固定した別checkpointとして利用者の明示承認を得る。

## 必要十分なdata設計

- 一つの業務対象は一つのdocumentを既定とする。読取actor、保存・削除・復旧条件、増加し続ける量、具体的なsize、独立query、field限定updateで解消できない実測競合がある場合だけ分割する。
- writer権限、画面、フォーム、責務名だけでは分割しない。server認可とexact field allowlistで表現できる場合は同一documentを維持する。
- 通常画面はreal-time listenerとfield限定updateを既定とし、可逆な通常編集はlast-write-winsを受容する。
- expected value、revision、transaction、idempotency、lock、ledgerは、権限・利用停止、削除、金銭、外部service、複数resource、復旧困難なdata loss、二重実行の具体的被害へ限定する。
- 追加の複雑性は、具体的な故障、影響、より単純な対策で防げない理由、対象operationへの限定を説明できる場合だけ採用する。

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
