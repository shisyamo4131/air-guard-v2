# 0048 SiteのCustomer変更と既存実績snapshot

- 日付: 2026-09-04
- 状態: Accepted
- 関連仕様: `docs/specification.md` の「取引先・現場・取極め」
- 関連判断: [0046 Customer archiveの参照barrierと監査境界](0046-customer-archive-reference-barrier.md)

## 背景

現行applicationとinstalled Site schemaは、customerId設定済みのSiteを同じ会社の別Customerへ変更できる。変更時は変更先Customerを取得してSiteの埋込みcustomerを更新し、一度設定したcustomerIdを未設定へ戻すことだけを拒否する。2026-08-11のCONF-0047でもCustomer変更を許可し、既存OperationResultのcustomerIdを履歴snapshotとして自動変更しない方針が回答済みだった。

一方、現行仕様には過去の請求整合性を理由にSiteのCustomer変更を許可しない記述が残り、source・回答履歴・正本が衝突していた。Customer archiveのCAS-03ではcustomerId変更時の参照先存在barrierを実装するため、Aから存在するBへの変更を許可するか拒否するかをRulesとtestで確定する必要が生じた。

## 決定

- Siteは、同じ会社の`Customers` collectionに存在する別Customerへ変更できる。Customerの`contractStatus`は存在条件に使わず、TERMINATED Customerも対象にできる。
- 一度設定したSite.customerIdを未設定へ戻す操作は提供しない。この境界は別Customerへの変更許可とは区別する。
- customerId変更時はSiteの埋込みcustomerを変更先Customerから更新する。Customer archiveの参照barrierは、変更先が同じ会社のactive collectionに存在することをRulesと該当server writerで検証するが、customerIdの同値固定には使わない。
- SiteのCustomer変更だけを理由に、既存OperationResult・BillingのcustomerIdを自動変更しない。これらは作成・同期時点の履歴snapshotとして維持する。
- 変更後に新規作成される、または別の更新条件でSiteから再同期されるOperationResultは、その時点のSiteとCustomerを使う。空更新へ暗黙の再適用・移管処理を持たせない。
- 既存実績へCustomer・Agreementを再適用する必要が生じた場合は、対象、変更前後、Billing影響、発行済み請求書の除外、actor、reason、rollbackを定める明示操作として別途設計する。
- 本判断は変更元Siteのstatus別編集権限を変更しない。現行applicationはTERMINATED Siteにも編集入口を表示するが、CONF-0048で確定した将来のread-only・限定訂正境界をFUT-0062で実装するときはそちらを優先する。Customer変更許可をTERMINATED中の通常編集許可として解釈しない。

## 理由

現在の業務操作とsourceはCustomer変更をすでに提供しており、過去実績はOperationResult・Billing自身のcustomerIdで保持できる。Siteの現在の所属変更と過去実績の書換えを分離することで、変更操作を維持しながら履歴を暗黙に改変しない。

Customer archiveのbarrierは、archive後または他tenantのCustomerを新しい参照先にすることを防ぐための存在条件である。これをimmutabilityへ拡張せず、確認された故障に比例した最小条件にする。

## 代替案

- 初回設定後のcustomerIdを完全に固定する案: 現行UI・schema・回答済み運用と一致せず、Customer変更を必要とする業務を失うため採用しない。
- Site変更時に既存OperationResult・Billingを一括移管する案: 過去実績と請求の意味を暗黙に変え、対象・発行状態・監査・rollbackが未定義のため採用しない。
- customerIdのunsetも許可する案: 仮登録へ戻す意味と下流影響が未定義で、利用者の今回の確認範囲にも含まれないため採用しない。

## 影響

- 仕様: SiteのCustomer変更禁止を撤回し、同社Customerへの変更、unset拒否、既存実績snapshot維持を確定する。
- application/data: 現行UI・schemaはAからBへの変更をすでに許可しているため、この判断だけでruntimeや既存dataを変更せず、migrationも行わない。
- CAS-03: Rules testは同社の存在するCustomerへのAからBを許可し、missing、archive-only、他tenantを拒否する。Customer存在barrierをimmutabilityとして実装しない。
- future work: 埋込みCustomer同期の順序・部分失敗と、既存実績への明示的再適用operationは独立課題として残る。

## 互換性と移行

現行application挙動を正本へ合わせる変更であり、既存UI操作と保存形式を維持する。既存Site、OperationResult、Billingの書換え、検出、移行は不要である。remote dataは本判断で確認・変更しない。

## rollback

本判断の文書だけは通常のGit revertで戻せる。将来runtimeをCustomer変更禁止へ変更する場合は、既存利用者への影響、UI、schema、Rules、既存Site、下流snapshot、移行要否を新しい仕様変更として承認する。正本だけを戻して現行UIを非準拠状態にしない。

## 検証

- 文書整合: 現行仕様、CONF/FUT、Site実装台帳、Customer archive設計とroadmapが変更許可で一致する。
- source inventory: tracked application、Rules、testにAからBの変更禁止ロジックまたは現行コメントがないことを確認する。
- CAS-03 Rules/Emulator: 同社のACTIVE/TERMINATED Customerへの設定・変更を許可し、missing、archive-only、他tenantを拒否する。customerId不変updateとdeleteをbarrierだけで拒否しない。
- source/Emulator: 既存OperationResult・BillingをSite変更だけで自動更新しないことを維持する。

## 再検討条件

Site変更時に既存実績を移管する業務要件が生じた場合、unsetが必要になった場合、埋込みCustomer同期の不整合が再現された場合、または請求済みdataとの具体的な矛盾が確認された場合に再検討する。
