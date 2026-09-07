# 0050 Outsourcerをlive masterとして保持し通常archiveを提供しない

- 日付: 2026-09-04
- 状態: Accepted
- 関連仕様: [Outsourcer master](../specification.md#外注先)
- 関連判断: [0031 必要十分なデータ境界](0031-proportional-data-boundary-and-change-safeguards.md)、[0044 Customer状態フラグ](0044-customer-status-as-descriptive-flag.md)、[0046 Customer archive参照barrier](0046-customer-archive-reference-barrier.md)

## 背景

Outsourcerは外注警備員個人ではなく、特定の協力会社を表すmasterである。同じOutsourcer IDを配置へ複数明細として登録でき、配置予定、稼働実績、配置通知、請求表示、帳票がlive Outsourcerから名称等を取得する。

installed schemaは`logicalDelete=true`で、generic adapterにはlive documentを`Outsourcers_archive`へ移す処理と逆方向のrestoreがある。しかし、参照確認はSiteOperationSchedulesとOperationResultsだけで、ArrangementNotificationsを含まない。参照確認とarchive transactionの間には競合余地があり、restoreはactive同IDを上書きし得る。archive後はlive ID取得が失敗し、過去の表示名が欠落する可能性がある。

OUT-01ではclientのlive deleteとarchive writeを拒否し、製品UIから削除入口を除去した。OUT-03では`contractStatus`を検索・配置等へ影響しない説明用フラグと確定したため、通常運用でmasterをlive collectionから除去する必要はない。

## 決定

- Outsourcerは通常の製品運用ではlive masterとして保持し、archive、restore、物理deleteを提供しない。
- 誤登録、重複、取引終了を理由とするarchiveも行わない。必要に応じて名称・備考・`contractStatus`を通常の権限と保存契約で訂正するが、statusはOUT-03どおり検索・配置・実績等を制限しない。
- 製品UI、application action、Callableにarchive／restore／delete入口を設けず、generic `delete()`／`restore()`をOutsourcerの正規経路として使用しない。
- `Outsourcers/{docId}`のclient deleteと`Outsourcers_archive/{docId}`のclient create/update/deleteを拒否する現行Rulesを維持する。既存archiveの同一tenant read境界は本判断で変更しない。
- live documentの自動purge、保持期限、匿名化、archive migrationを追加しない。既存live/archive dataへ一括変更を行わない。

## 理由

協力会社masterをliveのまま保持すれば、過去と現在の配置・通知・実績・請求・帳票が同じIDで名称を解決できる。配列参照を持つ複数writerへ新しい競合制御を導入せず、現在の業務要件を満たせるため、専用archive transaction、参照barrier、restore operationを追加するより単純で安全である。

## 代替案

- Customerと同様の専用archive Callableを追加する案: Outsourcerは複数の配列・通知documentから参照され、後続参照を止める恒久barrierの影響が大きい。通常archiveの必要性が確認されていないため採用しない。
- 参照0件だけgeneric archiveする案: 参照確認漏れ、確認後の競合、監査metadata欠落、restore上書きを解消できないため採用しない。
- TERMINATEDだけarchiveする案: statusを説明用フラグとするOUT-03に反し、過去表示を壊し得るため採用しない。
- 利用者向けごみ箱とrestoreを追加する案: active/archive同ID競合、権限、監査、参照整合の追加要件が必要であり、現在は採用しない。

## 影響と互換性

- 現在のUI、application action、Rulesはすでに本判断を満たしており、製品runtimeの変更は不要である。
- live Outsourcerのdocument形状、ID、status、検索・配置・実績、同一IDの重複配置を変更しない。
- 既存archive documentの有無・形状はremote未確認である。本判断で読取り、変換、復元、削除を行わない。
- schema package、generic adapter、Functions、index、Dev/Prod、remote dataは変更しない。

## 移行とrollback

data migrationはない。判断自体を撤回する場合は、まずarchiveの必要性、全参照catalog、並行writer、監査、same-ID tombstone、restore、保持、既存archiveを含む新しい仕様を承認する。文書と回帰testだけは通常のGit revertで戻せるが、現行のclient破壊操作拒否を先に解除しない。

## 検証

- domain source contractでOutsourcerのpage、Manager、Card、application actionにarchive／restore／delete入口がないことを確認する。
- Firestore EmulatorでACTIVE／TERMINATEDの双方についてlive delete、archive create/update/delete、nested fallback迂回が拒否されることを確認する。
- 同一tenantの既存live/archive read境界と、OUT-03のstatus非依存候補契約を回帰確認する。
- change classは`data-contract-schema-migration`とし、completion gateは`project-docs`、`domain-full`、`local-emulator-suite`、`diff-check`を使用する。UI sourceを変更しないため`local-ui-build`は省略し、Dev/Prod・remote/data操作は別承認とする。

## 再検討条件

法令・契約・社内規程等により協力会社masterの削除または匿名化が必要になった場合、live保持が具体的な容量・性能・情報管理上の問題を起こした場合、または運営者による個別復旧が必要になった場合に、通常productから分離した新しいcheckpointとして再検討する。
