# 0029 Firestore Rules互換CRUD先行と段階的閉鎖

- 日付: 2026-08-29
- 状態: Superseded
- 置換: [ADR 0031 必要十分なdata境界と変更保護](0031-proportional-data-boundary-and-change-safeguards.md)
- 関連仕様: 開発ガバナンスと進捗管理、Company設定とtenant lifecycle
- 関連判断: [0016 FireModel CRUDの利用境界](0016-firemodel-crud-boundary.md)、[0025 Company Configuration Boundary](0025-company-configuration-boundary.md)
- 置換する範囲: ADR 0025の移行順序のうち、既存Company CRUDの互換確認よりpre-containment Rules deployを先行させる記述。CCBのtarget schema、actor、migration、backup、activation契約は置換しない。

## 背景

> 2026-08-30: 本ADRの互換releaseを全改修の既定とする規則は置換された。ADR 0031は、正式release前の少数Dev dataを短いmaintenanceで全件変換・検証できる場合、長期互換層を必須にしない。production、旧client併存、停止困難、大規模data、外部作用がある場合には本ADRの互換release方式を選択肢として再利用できる。

Firestore Rulesを先に狭めると、現在許可されているClient/Server callerが将来境界へ移る前に既存機能を停止させる。一方、Rulesだけを後回しにして新規のprivate pathへdocumentを作ると、generic fallbackが意図せずread/writeを許可する可能性がある。AirGuardV2ではCompany rootの全体set、AirItemManagerの編集draft、Functions/Admin SDKのwhole-document writer、候補pre-containment Rulesが別々に存在し、local Rules test成功だけでは既存Company CRUDのrelease互換を証明できなかった。

## 決定

既存pathのRules許可を狭める改修は、次の順序を必須とする。

1. 現行Rulesと全callerを棚卸しし、既存CRUD、暗黙のwhole-document set、trigger・scheduled処理、operator、Admin SDKを把握する。
2. 将来Rulesが許可するpath、field、actor、operationを固定する。
3. 現行Rulesを維持したままClient/Serverを将来境界へ移す。既存pathから新pathへ正本を切り替える機能は、同じoperation入口が旧正本だけをexact partial updateする互換mode、新正本だけを更新するactive mode、移行中の通常writeを拒否するstaged modeを明示し、無期限dual-writeを行わない。部分更新、operation別handler、Callable、transaction等は対象機能の整合性・監査・競合・offline要件に合わせる。共通manager、AirArrayManager、AirItemManager、FireModelの基本CUDは必須ではない。
4. 現行Rulesと候補Rulesの両方で、既存正常系、actor拒否、tenant拒否、stale・競合、部分失敗、旧clientを回帰する。
5. 対象環境へClient/Serverを先行導入し、既存CRUDの継続、将来境界外write 0件、旧writer 0件を確認する。
6. 最後にRulesを閉じ、deployed receiptと同じ回帰を確認する。

新規pathは既存機能を持たないため、最初のdocument作成前にgeneric fallbackから除外してdenyを確立する。新規pathのdenyを先行させることと、既存pathの許可を先に閉じることを混同しない。

CCBでは4つの専用Callableをmarker-aware operationとする。`LEGACY`はmarker未activeかつ全target不存在を必須とし、scope別canonical `expectedValue`が現在legacy projectionと一致する場合だけ、既知legacy business fieldと既存legacy更新metadataをtransactionのpartial updateで変更する。root whole-set、reserved CCB field、Settings、PrivateSettings、SettingAudits writeは0件とする。`STAGED`はtargetが存在してmarker未activeの状態で、maintenance中のmigrationだけに限定し、通常設定writeとsignupを拒否する。`ACTIVE`はSettingsの`expectedRevision`を必須とし、profile/billing/operationsはauditと同一transaction、arrangementはauditなしでSettingsだけを更新する。legacy期間へauditを遡及せず、stagingからactivationまで同じmaintenance内で完了してdual-writeを採用しない。新規signupはmaintenance開始前までlegacy rootだけを作成する。maintenanceはpre-containment Rules deploy前に開始してsignupを停止し、cutover後はactive rootとcomplete target setを作成する。

既存許可を維持するとdata exposureが継続する緊急incidentだけは例外とし、影響する既存機能、停止範囲、暫定Client/Server対応、rollback、陰性testを固定した別checkpointで利用者の明示承認を得る。

## 理由

- Security Rulesを最終防御境界として強化しながら、既存利用者のCRUDを計画外に停止させない。
- UI componentのdraft更新とFirestoreの部分更新を区別し、永続化範囲をoperation単位で検証できる。
- local候補Rulesの成功、Client/Server release、remote ruleset receiptを別々の証拠として扱える。
- 同じ手順をCompany以外のCustomer、Site、Employee、Billing等の段階改修へ再利用できる。

## 代替案

- Rulesを先に閉じて失敗したcallerを後から直す案: 既存機能を意図せず停止し、rollback中もclient/server/rulesの組合せが不明確になるため採用しない。
- 新規pathをgeneric fallbackのまま先に作る案: privateまたはserver-owned dataがclientへ露出し得るため採用しない。
- 全CRUDを一律CallableまたはFireModelへ統一する案: 機能ごとのatomicity、監査、offline、競合要件を失うため採用しない。

## 影響

- 実装: Rules変更を伴うsegmentはcaller inventory、将来CRUD、dual-rules test、旧writer 0件gateを持つ。
- release: Client/Server互換releaseとRules閉鎖releaseを区別し、候補Rules sourceだけをdeploy readinessとしない。
- test: 現行Rulesと候補Rulesの同一回帰matrix、実component submit path、正確なwrite path・field、拒否・stale・部分失敗を確認する。
- compatibility: CCBのLEGACY modeではscope別expected-value競合、reserved field不変、root whole-set 0、Settings/audit write 0を確認する。STAGEDでは通常write・signup拒否、ACTIVEではexpected revision、exact Settings path、audit atomicityを確認する。
- data: 新規pathの作成はdeny receipt後、既存pathのactivationやcleanupは旧writer 0件後に行う。
- task: project-specific governanceの実装・release安全境界を変更するinstruction-chain changeであり、managed AGENTSの内容変更有無にかかわらず、検証・commit後にaffected taskの交代を必要とする。

## 移行とロールバック

各segmentは現行Rules下で互換Client/Serverを導入できる単位へ分ける。CCBはLEGACY partial-update modeを含む同じCallable releaseへ戻せる間だけRules閉鎖前rollbackを許し、root whole-setを再有効化しない。STAGED以降はmaintenanceを維持し、active mode対応済みreleaseへroll forwardまたは戻す。Rules閉鎖後は新Rules対応済みの既知releaseへ戻し、旧whole-document writerを再有効化しない。new pathのdeny receipt、Client/Server release、旧writer 0件、Rules releaseの証拠を別々に保存する。

## 再検討条件

Firestore以外の認可基盤へ移行する場合、Rules versioningと段階的traffic切替を自動保証するrelease基盤を導入する場合、または緊急incidentの頻度から専用のbreak-glass手順が必要になった場合。
