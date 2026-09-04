# Customer archive safetyロードマップ

- 状態: In progress
- 開始日: 2026-09-04
- 現在の進捗: 90%
- 部分加点: なし
- 完了条件: 誤登録・重複Customerを参照なしの場合だけ監査付きでarchiveでき、同時・後続参照と同ID再作成を拒否し、通常Userのrestore・archive閲覧・物理deleteを提供せず、local実装・自動test・Codex専用local UI・独立review・文書・Git統合・別途承認するDev反映と受入れを完了する。
- 正本: [現行仕様](../specification.md#取引先現場取極め)、[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)、[実装設計](../implementation/customer-archive-safety.md)

## 承認境界

2026-09-04に、利用者は`CUSTOMER-03-ARCHIVE-SAFETY-DESIGN`として仕様・ADR・roadmap・実装設計の正本化を承認した。続いてCAS-02だけについて、`gpt-5.3-codex-spark`の別`Developer` taskへFunctions実装と単体testを委譲し、coordinatorがreview・差戻し・受入れを行うlocal試験運用を承認した。Spark試験は実装前に中止し、CAS-02は通常サブエージェント運用で完了した。利用者は同日にSpark利用案を棄却し、CAS-03/04をprimary coordinator配下の通常サブエージェント分割で開始することを承認した。

CAS-02のexact ownership、test、書込みlease、差戻し、独立review、完了gate、反省会は[CAS-02実行契約とSpark Developer試験記録](../implementation/customer-archive-cas02-developer-trial.md)を正とする。CAS-03/04の承認範囲はlocalのRules・Functions参照guard・client/UI・関連test・Codex専用build/UI・独立review・文書・local Git統合までとする。CAS-05、Dev/Prod、remote/data、migration、package変更は含まない。restore、物理delete、自動purge、retention決定、generic package修正、3参照collectionのpermission全体見直し、Customer code一意性・検索拡張は別の作業単位とする。

## 設計契約

- `archiveCustomer`専用Callableが、検証済みidentityからcompanyとactorを導出し、会社管理者またはstrict known preset由来の`customers:write`だけを許可する。
- exact inputは`customerId`、理由、`operationId`。一つのtransactionでactor、active Customer、同ID archive、Sites、OperationResults、Billingsを読み、参照・衝突・不正状態ではwrite 0にする。
- `Customers_archive/{customerId}`はversion 1 envelopeと同ID tombstoneを兼ねる。上書きせずcreateし、active Customerを同じtransactionで削除する。
- 3参照collectionのcustomerId新規設定・変更は、`Customers/{customerId}`の存在をRulesとserver writerで必須にする。contractStatusは存在条件に使用しない。
- Customer createは同ID archiveがある場合に拒否する。追加lock collectionは作らない。
- archiveのclient read/CUD、generic delete/restore、通常User restore、物理delete、purgeを拒否する。将来の運営者inspection/restoreは別仕様とする。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| CAS-01 仕様・失敗経路・security設計 | 20 | 20 | Completed | ADR 0046、実装設計、2026-09-04の独立security review、project-docsとdiff-check |
| CAS-02 専用Callable・監査・冪等性 | 25 | 25 | Completed | commit `74d0eb4d`、domain 873/873、Emulator 123/123、targeted log test、独立security/general review、反省会記録 |
| CAS-03 参照writer barrier・Rules回帰 | 30 | 30 | Completed | commits `8e6eb1d5`・`c99b8169`、domain 889/889、Emulator 142/142、security 5/5、独立review |
| CAS-04 UI・local受入れ・最終review・Git統合 | 15 | 15 | Completed | commit `8db79a2e`、domain 913/913、Emulator 142/142、専用build、[local UI受入れ](../verification/customer-archive-local-acceptance.md)、独立general/security review |
| CAS-05 Dev反映・利用者受入れ | 10 | 0 | Deferred | マスタデータ管理改修後のbounded Dev releaseと権限別受入れ |

重み合計100。各マイルストーンの証拠がすべて揃った場合だけ加点する。CAS-01は設計だけの完了で、製品にarchive機能が実装されたことを意味しない。

## CAS-01 検証記録

- `CUSTOMER-03-ARCHIVE-SAFETY-SECURITY-REVIEW`: read-only security reviewerが現行Rules、generic adapter、3参照writer、archive read、same-ID create、Admin SDK bypassを確認した。archive transactionだけでは後続参照を止められないためwriter guardが必要、追加lock collectionは不要という判断をADR 0046へ反映した。変更・test・network・remote/data操作は0。
- `CUSTOMER-03-DOC-CONSISTENCY-REVIEW`: read-only reviewerが正本、roadmap、ADR、implementation、FUT/CONF、索引を確認した。冪等retryをactor UID・operation ID・正規化済みreasonの全一致へ補正し、archive read拒否の未実装表現、仕様日付/version、permission catalog由来actorを修正した。reviewerによる変更・testは0。
- `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2`: TOML 8件、Markdown 223件、ADR 46件、roadmap 7件を検証しexit status 0。
- `git diff --check`: exit status 0。LFからCRLFへの将来変換warningだけで、whitespace errorは0。

上記commandはreview指摘反映後に個別実行した。この検証記録の追加で文書gateが失効するため、最終差分で同じ2 gateを再実行してCAS-01完了を確定する。

## 後続実装の検証選択

予定する影響classはUI、application logic、data contract/Rules。completion gateのunionは`project-docs`、`domain-full`、`local-emulator-suite`、`local-ui-build`、`diff-check`。実装中は対象unit・Rules testから始め、最終状態でunionを一度実行する。`generate-dev`、`generate-prod`、deploy、remote/data確認は別承認であり、このroadmapへの記載だけでは実行を許可しない。

CAS-01完了時点では設計文書だけを変更し、製品runtimeを変更しなかったため、document整合の`project-docs`と`diff-check`だけを実行した。CAS-02以降の実装がなかった同時点ではruntime gateを成功証拠にせず、plannedとして残した。

## 互換性・移行・rollback

active Customerの26-field schemaは維持する。Rules update guardはcustomerId変更時へ限定し、既存documentの無関係field更新を止めない。archive形状はversioned envelopeになるため、既存flat archiveがremoteに存在する場合は自動解釈・上書き・変換をせず別migration判断へ分離する。

機能rollbackはarchive入口を先に止め、archive済みIDがある間は参照guard、same-ID create拒否、archive client拒否を残す。code rollbackでarchive削除・自動restoreを行わない。CAS-01のdocumentだけは通常のGit revertで戻せる。

## 未確認・別承認

- remote Firestore edition、IAM、App Check、deployed code、実Customer/archive/reference件数とshape。
- 法令・社内規程上の保持期間、operator identity、inspection/restore運用。
- Dev/Prod、remote read/write、migration、package変更、secret、Stripe、通知。

## 次工程

CAS-02は[実行契約と反省会記録](../implementation/customer-archive-cas02-developer-trial.md)に従い完了した。CAS-03はRules、Billing server writer、test、security/general reviewを通常サブエージェントへ分割して完了した。CAS-04はclient/UI、Codex専用build・local UI受入れ、独立review、local Git統合まで完了した。次はCAS-05だが、Dev反映・利用者受入れはマスタデータ管理の一連の改修後へ延期し、別承認する。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-09-04 | 20% | +20 | 現行Rules・generic adapter・Customer/Site/OperationResult/Billing writerを照合し、専用Callable、transaction、3参照barrier、archive tombstone、client非公開、generic restore非利用を利用者承認済み仕様・ADR・実装設計へ固定した。application・Rules・test・Devは未着手。 |
| 2026-09-04 | 45% | +25 | CAS-02専用Callable、version 1 archive、same-operation retry、safe error/logをlocal実装し、domain 873/873、Emulator 123/123、独立review、commit `74d0eb4d`、反省会を完了した。CAS-03/04、Rules、client/UI、参照writer、Dev/remoteは未着手。 |
| 2026-09-04 | 75% | +30 | CAS-03のarchive非公開・same-ID tombstone・3参照RulesとBilling server transaction barrierをlocal実装した。nested Billing path、transaction retry log、move失敗の偽陽性をreview差戻しで補正し、domain 889/889、Emulator 142/142、security再監査5/5、独立review、commits `8e6eb1d5`・`c99b8169`を確認した。CAS-04 UIとDev/remoteは未着手。 |
| 2026-09-04 | 90% | +15 | CAS-04のwrite actor限定archive action、確認dialog、reason、single-flight、安全なerror表示、成功後一覧遷移をlocal実装した。domain 913/913、Emulator 142/142、専用build、write/read-only actor・参照拒否・高速double-click・成功archiveのlocal UI受入れ、独立general/security review、commit `8db79a2e`を確認した。CAS-05のDev/remote反映・利用者受入れは未実施・別承認。 |
