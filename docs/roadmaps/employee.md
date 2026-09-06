# Employeeマスター改修ロードマップ

- 状態: EMP-01進行中（actor・全項目閲覧・自宅座標の用途と取得失敗時保存・他collection変更禁止・退職後編集禁止・保険操作条件を確定、削除実装契約・工程配分と技術設計は判断中）
- 目標: Employee通常CRUDをoperation固有のeditor・application処理・保存境界へ移し、個人情報の過剰アクセス、全文上書き、保存前のlive変更、失敗・競合時の不整合を解消する。
- 現在の進捗: 0%
- 部分加点: 行わない。各工程の完了条件と必要な利用者判断・review・検証をすべて満たしてから当該重みを加点する。調査・案の保存を製品実装の達成と混同しない。
- 承認境界: 2026-09-06に計画文書保存・review・文書検証・local commitとEMP-01開始を承認し、[ADR 0056](../decisions/0056-employee-role-and-archive-boundary.md)のactor・閲覧最小化を採用した。同日、[ADR 0057](../decisions/0057-employee-hard-delete-and-archive-deferral.md)の会社管理者・統括だけの従属なし誤登録物理削除、archive延期、他collectionの既存実装維持を採用し作業開始を指示した。他の未決仕様、工程追加/重み配分、EMP-02以降の実装、Dev・Prod・remote・実data・package変更は未承認である。
- 実行単位: 今回は一気通貫で進めず、工程ごとに作業・review・報告を行い、次工程の開始指示を待つ。合意済み工程内の通常修正にcommand/fileごとの再承認は追加しない。
- 最新の部分採用: [ADR 0058](../decisions/0058-employee-full-read-and-geocoding-scope.md)により、ADR 0056の項目限定readを全項目readへ置き換えた。自宅座標は将来の現場・自宅経路図に必要として取得・保存を継続する。他collectionの保存処理・RulesはEmployee存在確認の追加も含めて変更しない。以下の計画はこの境界を適用し、末尾の以前のreview記録は当時の履歴として扱う。
- 利用者への報告: EMPの作業結果・現在地を報告する際は、本書のマイルストーン表を基にEMP-01〜09の工程名・状態・必要に応じた残作業を一覧で示し、EMP全体の確認済み進捗を併記する。短い作業中の連絡では表を毎回繰り返さず、まとまった報告には必ず付ける。工程内の成果を未確認の割合へ換算せず、部分加点なし・Dev別承認の条件を維持する。

## 正本と維持する境界

- 確認済み要件は[現行仕様](../specification.md)、User連携は[ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)、退職・誤退職訂正は[ADR 0020](../decisions/0020-employee-retirement-user-offboarding-and-reinstatement.md)を正とし、退職actorへの統括追加だけADR 0056で更新する。1 Employee対最大1 User、通常退職でEmployeeと業務記録を保持、仮Userは先に専用削除、誤訂正でUser/Auth非復元という境界を作り直さない。
- 現経路と依存は[Employee実装調査](../implementation/employee-master.md#現行経路の再照合)、保険の現遷移は[保険調査](../implementation/employee-insurance.md)、未決の回答は[確認事項台帳](../implementation/pending-confirmations.md)、独立問題は[既存FUT](../implementation/future-actions.md)を使用する。破棄済みtaskの案を根拠・承認・進捗にしない。
- [ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)と[ADR 0055](../decisions/0055-scope-discovery-and-acceptance-review.md)、[開発workflow](../runbooks/development-workflow.md)、[checkpoint transition](../runbooks/project-coordination.md#checkpoint-transition)を適用する。新しい全project向けgate・台帳・runbookは追加しない。
- 既存document ID、ACTIVE/RESIGNED、在籍期間、現在master名による過去記録の表示を互換境界にする。過去時点の旧氏名をsnapshotから再現できるという意味ではない。既存通知本文は遡及変更しない。

## 対象と対象外

対象は在職者一覧での作成、基本・国籍・警備員登録・保有資格・3保険、一覧・検索・詳細、Employeeのread/write Rules、必要な専用API・actor policy・Employee固有cache/表示adapterである。Employee画面のUser panelは既存UWB controller/serverを維持してdialog shellだけ専用化する案とする。

対象CRUDではAirItemManager/AirArrayManagerによる永続化、live draft、保存完了制御への依存を除去する。保険・資格はlocal配列を編集していても直後にEmployeeを保存する現経路なのでlocal-only例外とはしない。独立draft内の入力部品を再利用する場合も保存・認可・成功/失敗判定を汎用Managerへ戻さない。残存例外の採否はEMP-01で固定し、単なるcomponent名検索だけで目的達成としない。

配置・通知・実績・勤怠・請求・帳票への現在の実装scopeは、Employeeの表示・read・cache・identityの直接互換に限定し、それらのFirestore writer、再集計、snapshot契約は変更しない。Customer、Site、Outsourcer等の既存実装も維持する。Employeeメール変更によるUser email同期は追加しない。archive新機能・restore・匿名化・実際の再雇用・将来日退職・本人Self Access画面、全manager/cache基盤の改修、package公開・導入は対象外とする。誤登録Employeeの物理削除だけを新たな対象として扱う。

archive新機能はFUT-0078の将来工程へ戻し、誤登録の物理削除を採用済みの設計対象とする。統括の退職許可も実装差として維持する。削除の具体契約、従属catalog・並行writer・旧削除trigger・旧全文writer・再試行/同ID再作成をEMP-01で整理する。他collectionのwriter変更が必要なら現承認範囲外として、必要箇所・代替・検証・工程配分を提示し、安全条件を満たせない間は削除を開放しない。通常CRUDの付随作業やEMP-07の独立問題へ黙って混ぜない。下表の重みは旧提案を保持し、削除の工程/配分が未決の間は計画全体の確定・EMP-01完了を主張しない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 内容と完了条件 |
|---|---:|---:|---|---|
| EMP-01 契約・対象確定 | 10 | 0 | In progress | actor・全項目read・座標用途と失敗時保存・変更範囲・退職後編集禁止・保険操作条件は確定。最新住所と座標の整合、code/氏名/候補、operation所有fieldと競合・段階移行を判断する。統括退職・物理削除の依存、他collectionを変更しない条件との整合、工程配分も確定し、採用範囲だけ仕様・必要ADRへ反映する。独立reviewでEMP-02の入力・保存・test前提が揃ったことを確認し報告する。 |
| EMP-02 作成・基本・国籍 | 20 | 0 | Planned | 独立draft、同ID/create-onlyと結果照合、基本/国籍のexact field保存、住所入力、派生field、従属field初期化、採用した同field競合契約・異field保持を実装する。対象operationの権限・型・fieldを保存境界で強制し、旧allowによる迂回も閉じる。未移行editorの停止/先行保存互換をEMP-01で決定し、代表UI保存・再読込・失敗を確認する。 |
| EMP-03 警備員登録・資格 | 10 | 0 | Planned | 登録情報と資格配列を別operationとして保存する。同名・名称変更・削除・別行追加・古い配列の再送で他行を失わず、保険・基本情報・lifecycleへ書かない。対象actor、従属初期化、拒否・成功のdata比較と代表UIを確認する。 |
| EMP-04 3保険の保存 | 15 | 0 | Planned | 各保険の承認済み遷移だけをserverで検証し、対象保険の現在値/historyと局所的期待値を照合する。live非mutation、保存await、確定拒否時のwrite 0、応答不明時の照合、二重history変更防止を確認する。監査制度全面刷新を暗黙追加しない。 |
| EMP-05 閲覧権限・既存reader互換 | 20 | 0 | Planned | 原本の全項目readと既存購読を維持し、現在Auth/User・identity由来tenant・既知roleの認可を揃える。Employee/archivesと汎用Rules、既存query・Class表示、cold cache、初期選択ID、期間内退職者、更新/削除反映、権限喪失を検証する。項目限定API・DTO/projection・新しい通知やpollingは追加しない。 |
| EMP-06 一覧・検索・User画面 | 10 | 0 | Planned | 空・loading・error、古い検索応答、作成導線を契約へ揃える。User panel shellを整理し、既存User provision/deleteと退職・訂正の許可拒否を維持する。到達するEmployee CRUDのManager依存・旧model mutation経路を再検索し、操作証拠と照合する。 |
| EMP-07 独立課題の一括確認・修正 | 5 | 0 | Planned | FUTの対象一覧・方針・影響・test・Devを阻害する問題を利用者と一括確認し、合意した独立問題だけ設計review・修正・検証する。対象なしなら根拠ある分類確認で完了し、加点のために実装を増やさない。 |
| EMP-08 Local統合確認 | 5 | 0 | Planned | 各工程の代表操作証拠を前提に、全目的と最終diff・必須gate・独立review・直接回帰・UI・cleanupを対応づける。初回確認をここへ集中しない。未達があれば該当工程を未完として扱う。 |
| EMP-09 Dev反映・受入れ | 5 | 0 | Deferred / 別承認 | マスタ一連改修後の集約受入れで、旧client、必要な既存data、対象service、復旧を確認して反映し、権限別操作と関連readを受け入れる。必要なmigrationは対象・backup・dry-run・apply・post-checkを別承認する。 |

重み合計は100。閲覧方式の簡素化後も重みは暫定配分を保持し、削除の配分と合わせてEMP-01で確定する。全項目readの採用はroleなし等の過剰readを許可する意味ではなく、read/writeすべての対象条件が揃う前に「CRUD保護完了」と表現しない。EMP-02〜04の暫定許可は移行済みoperationのfieldを変更できないことを、複数operationを混ぜたpayloadでも確認する。EMP-06でshellを整理する画面も、EMP-05で認可と既存readerの互換を確認する。EMP-09まで個別のremote反映は行わない。

## 工程別の操作・data・証拠

各実装工程で、同一tenantの許可actor、read-only、roleなし、未知/直接permission、不正claim、無効/仮User、他tenant、super-userを、EMP-01で確定したmatrixに照らして確認する。合成dataを使い、現物の個人情報はfixtureへ持ち込まない。

| 工程 | 操作とdata前提 | 期待結果 | 確認方法・証拠 |
|---|---|---|---|
| EMP-02 | 標準/外国籍、住所手入力、任意code、ACTIVE/RESIGNED/誤訂正後の既存Employeeを作成・編集 | 在職者は所有fieldと派生fieldだけ変更。退職者は通常更新を拒否。User/予約/退職field（不存在を含む）は不変。住所送信は判断済み方式だけ | operation test、保存前後data、Emulator陰性、editorから保存して再読込するUI |
| EMP-02〜04 | 取消・権限拒否・不正入力・保存前競合・連打・保存後応答未着 | 確定拒否はwrite 0とdraft保持。結果不明は成功/未保存を断定せず再読込照合。旧draftの自動再送、重複作成、二重history操作なし | 制御可能な非同期test、保存前/保存後の失敗注入、UI feedback、正本data比較 |
| EMP-02〜04 | 2 actorの別section保存、同section先行保存、別保険・同保険、資格別行同時変更 | 別field変更を保持。通常fieldは採用したlistener通知/再読込とlast-write-winsの限界を確認。保険map/資格配列/採用した相関fieldは保存境界で古い期待値を拒否 | transaction/局所期待値の対象test、Emulator競合、代表2画面確認 |
| EMP-03 | 登録有無の往復、資格0/複数/同名legacy/名称変更/削除 | 承認された従属初期化。対象行を誤らず他行保持。新しい資格IDのpackage導入を既定にしない | operation test、配列の前後比較、代表編集UI |
| EMP-04 | 3保険それぞれの未加入/適用除外/手続中/加入済み/historyありに6操作 | 在職者の許可3actorで現行遷移・日付/番号条件だけ成功。退職者は全操作拒否。3つの保存field取り違えとhistory差替えを拒否 | 遷移表の全行test、保存境界、成功/拒否/応答不明の比較、代表UI |
| EMP-05 | 管制・勤怠等のreader、空cache、初期選択ID、期間内退職者、氏名変更、削除、権限/tenant変更中の遅延応答 | 許可actorは全項目を読めるが閲覧だけで更新できない。原簿氏名・国籍/性別/在籍期間を維持し、非許可actor・他tenantを拒否。現client管理cacheを破棄し旧応答を無視。既存page条件も維持 | Rules get/list/archives/nested陰性、表示/cache単体、既存queryと直接readerのUI。DTO/projection試験は不要 |
| EMP-06 | 在職/退職検索、空検索、入力race、仮User作成削除、Employee-only/仮User/本登録User連携、誤退職訂正 | 確定した一覧挙動、既存UWB許可拒否・予約整合を維持。通常編集でAuth/Userを復元・同期しない | 検索/controller test、既存UWB回帰、正規UIとbackend assertionを分離した証拠 |
| EMP-07〜09 | 独立FUTの合意scope、最終統合、後日のDev権限別操作 | 必須未達を先送りせず、localとDevを区別して受け入れる | 対象確定記録、目的と証拠の対応、最終gateの独立exit、環境終了・cleanup結果 |

既存UWBのtestは再利用候補だが、通常CRUD・保険・資格の安全性を証明するものではない。既存testの実測成功を今回の証拠へ転記しない。空cache等の直接互換と別機能全業務の受入れを区別する。

## 工程終了時の次工程レビュー

利用者の2026-09-06指示に基づき、Employeeの各工程報告には、現在工程の目的達成に加えて次工程を考慮した独立reviewを含める。既存のcheckpoint callback/completion reportへ、次の内容をまとめる。

- 次工程が受け取るfield・API・reader・writer・actor・data前提と、現在工程の成果が一致するか。
- 次工程で現在工程の保護/互換性を破壊しないか。未移行経路、旧allow、cache、schema、rollbackの不足がないか。
- 次工程開始前に必要な利用者判断・未検証と、それを解消する担当・確認方法。
- 次工程の変更で失効する検証証拠と、直接回帰として再確認する対象。
- 「次工程へ進める」「判断/修正が必要」を理由付きで報告する。前者でも自動開始せず、利用者の開始指示を待つ。

現在工程の必須条件未達は、次工程の予定へ付け替えず現在工程を未完とする。次工程の実装や全体再設計を、reviewだけの承認から始めない。EMP-09では次の運用・残課題への影響を同じ観点で確認する。

## 独立問題の扱い

[既存FUT](../implementation/future-actions.md)へ、発見工程、再現根拠、影響、現在工程を妨げない理由、対応予定を同一原因へ統合する。FUT-0075、0079、0126、0143、0159、0181のうち今回目的に必要な部分は対応工程の必須条件であり、EMP-07への送り先にはしない。FUT-0076の既存UWBは統括退職追加部分を除き維持回帰、FUT-0077の実再雇用/将来退職、FUT-0078のarchive/restore/匿名化、保険監査制度や全manager改修は将来の別判断とする。誤登録物理削除の採用済みactor/従属拒否と必要な設計はEMP-01で扱い、延期しない。

## 互換性・移行・復旧

- Employee単一正本・全項目read・既存購読を維持する。閲覧項目を制限するための新API・projection・通知・polling・data移行は不要であり、方式選定をEMP-02の前提から外す。
- 既存Classのaccessor・instanceof・検索/表示互換を維持する。全項目の取得を許可しても、更新はoperation所有fieldへ限定し全文setへ戻さない。
- 実効schema変更、他機能への明確な影響、確実な変換必要性がある場合だけ既存dataを必要範囲で確認する。入社日変更が期間検索へ影響する点はEMP-02で扱う。全件診断・一括修復・package更新を一律の前提にしない。
- 自宅geocodingは将来の現場・自宅経路図のため取得・保存を継続する。CONF-0120の必要性・用途・閲覧actor・失敗時の住所保存/旧座標消去/未取得通知は回答済み。最新住所/座標整合・log・Employee専用境界と共通入口の扱いを確定し、未解決のままEMP-02を完了しない。他masterの保存・Rulesは変更せず、経路図や実provider接続・全件座標更新は今回の対象外とする。
- 未反映codeは所有差分を対象に安全に戻せるが、反映後はPIIの広域read/write再開放を復旧の既定にしない。影響操作の停止と互換修正を検討し、data変換の復旧は承認済みbackup・手順へ従う。User/Authの旧UID復元を行わない。
- EMP-05のcache破棄は新実装が管理するmemory・永続cache・遅延応答を対象とする。旧clientや取得済みの複製PIIを回収できたとは主張せず、旧client併存条件をEMP-09で確認する。

## 検証選択と現在の次作業

提案保存・既存事実訂正は[検証policy](../../governance/verification-policy.json)のproject-guidance-metadata/documentation-onlyで扱い、project-docsとdiff-checkを選ぶ。未追跡文書はreview後のcached diff checkでも検証する。これは製品permission、project共通規則、release手順を変更する承認ではない。

後続実装は実diffのUI/application/data-contract等のunionから選択し、直接test→対象回帰→最終状態のcompletion gateを実行する。UI・logic・Rules変更の基本集合はproject-docs、domain-full、local-emulator-suite、local-ui-build、diff-checkであり、build実行・permission定義・release等の該当classはpolicyどおり追加する。環境・実行承認がないgateは記載だけを根拠に実行しない。各commandの結果・exit・証拠失効・省略理由をcompletion reportへ残す。

現在はactor・全項目read・座標用途・他collection変更禁止を仕様・ADR 0056〜0058・既存CONFへ反映し、残る保存条件を[CONF-0061](../implementation/pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)と[保存・read契約案](../implementation/employee-master.md#emp-01の保存読取り契約案)で扱う。今回の権限仕様採用は`governance-permissions-agents`としてcomprehensive 5 gateを選択する。以前のreviewで確認した旧3依存guardの不足、原本削除のUser背景処理、同時参照作成との整合は未解決である。他collectionの保存・Rulesへの存在guard案は対象外と確定したため、その追加を承認待ちの実装案として進めない。Employee単独で削除を開放できる根拠はまだない。runtime/dataの検証結果ではない。

統括の退職は現catalog・policy・陰性testへ未反映。誤登録物理削除はactor/従属拒否を採用済みだが、exact契約・競合・工程配分が未決で未実装。archive新機能は将来工程へ延期し、その詳細判断を今回のCRUD前提にしない。Employee以外の統括権限の整合は[親roadmap](airguard-v2.md#次の作業)で後続管理し、他collectionの既存実装と過去完了点を今回変更しない。回答・依存契約・reviewが残る間はEMP-01を完了せず、EMP-02の実装へ進まない。

## 計画reviewの記録

2026-09-06、source baseline `3881712cb3e80bee532f067b135a72207376b42a`をPMと専門agentが独立照合し、現経路・実装可能性/test・securityの3視点で調査した。対象はEmployee UI/Rules/Functions、installed schema/adapter、直接reader、既存test、仕様/ADR/CONF/FUTである。静的reviewであり実data・runtime・remoteは未確認だった。

- EMP-PATHS-1〜3: whole-document更新、保険/資格のlive変更、User shellとUWBの分離、到達する勤怠Select、DTO/accessor/instanceofとcache、current master名表示を確認。reader互換を専用工程へ集約し、非公開field補完・partial DTO保存を禁止する案で解消。
- EMP-REVIEW-1〜4: 保存await、局所競合、資格identity、住所入力、結果不明・二重実行、未移行editorの前提を指摘。writer先行→全reader切替の順と工程内代表検証へ補正し、計画提示を妨げる追加blockingなしを確認。
- EMP-SEC-1〜3: 過剰PII read/write、archives個別/汎用許可、自宅送信/log、現保険historyの意味、既存UWB保護を確認。全actor判断、旧allow閉鎖、read API認可、cache範囲、送信継続時の依存、保護を戻さない復旧案で解消。

上記は計画上の指摘解消であり、未決仕様の採用・製品脆弱性の修正・test成功を意味しない。EMP-01で追加reviewした結果、通常可逆fieldすべてへの期待値比較はADR 0031を根拠に一律必須とはできず、局所範囲と代替を判断案へ戻した。また、旧保険/資格の全文writerを残すだけでは段階Rules拒否時のUI成功誤表示を防げないため、未移行editorの一時停止/先行保存互換の選択をEMP-01へ加えた。これらは前回案の具体化・補正であり、利用者の未採用判断を変更済み仕様とはしない。

### EMP-01判断資料の文書review

以下はactor部分採用前の初回判断資料保存時の履歴である。2026-09-06、同source baselineのPM文書差分をEMP-01-DOC-PATHS（現経路/保存/read）、EMP-01-DOC-SEC（認可/PII）、EMP-01-DOC-REVIEW（計画/次工程/文書整合）が独立確認した。read APIのexact入力・取得上限/paging・境界拡張拒否の記載漏れと、無条件の「PII未返却」という曖昧な受入表現を修正し、EMP-01-DOC-SEC-R1で2件の解消を確認した。当時の判断資料の提出を妨げる残存指摘はなかった。未決判断があるため、EMP-01完了・加点・実装開始とは扱わなかった。

対象差分は本書、`docs/roadmaps/README.md`、`docs/roadmaps/airguard-v2.md`、`docs/implementation/current-coordinator-handoff.md`、`docs/implementation/employee-master.md`、`docs/implementation/employee-insurance.md`、`docs/implementation/pending-confirmations.md`、`docs/implementation/future-actions.md`、`docs/manual/employees.md`の9文書。manualは現sourceの退職者空検索0件への事実訂正である。

初回保存時は個別案が未採用のため仕様・data contract・ADR・CHANGELOGを更新せず、索引と再開案内を更新した。今回のactor部分採用では仕様・ADR・CHANGELOG・関連CONF/FUTを更新する。保存shape・実装・運用手順を変更していないためdata contractのshape定義、manual、operations、managed artifactsは更新しない。runtime、実data、Dev/remote、後続実装のtestは未検証である。

### EMP-01権限部分採用のreview

2026-09-06、baseline `05f03d47c18e442893cba59f00640daa89b2b14b`の文書差分をEMP-01-ADOPT-SEC-FINALとEMP-01-ADOPT-DOC-REVIEWで確認した。新しい統括退職まで旧UWBの実装済み総括へ含まれる曖昧さを修正し、EMP-01-ADOPT-DOC-R1で解消確認した。文書保存を妨げる残存指摘はなく、EMP-02開始は上記の未決判断があるため準備未完了である。

対象は仕様、ADR 0020/0033/0056とADR索引、CHANGELOG、Employee/Company/User/認可の既存実装文書、CONF/FUT、Employee/Company/親roadmapの15文書。code・Rules・package・data・agent設定は変更しない。archiveの同document状態更新案は[方式比較](../implementation/employee-master.md#archive保存方式の比較未採用)に残し、方式採用を先取りしない。comprehensive 5 gateのexact commandは[検証policy](../../governance/verification-policy.json)に従い、結果と独立exitは本作業のcommand reportで確認する。

### EMP-01誤登録物理削除採用のreview

2026-09-06、baseline `891a2604bdeaa2b981ae0bedda02b5fd6021b1b5`からのPM所有文書差分を、EMP-01-DELETE-IMPACT（現経路）、EMP-01-DELETE-SEC-REVIEW（security）、EMP-01-DELETE-DOC-REVIEW（文書・次工程）がread-onlyで確認した。対象は次の10文書で、製品code・Rules・package・実dataへの変更はない。

- `CHANGELOG.md`、`docs/specification.md`
- `docs/decisions/0056-employee-role-and-archive-boundary.md`、`docs/decisions/0057-employee-hard-delete-and-archive-deferral.md`、`docs/decisions/README.md`
- `docs/implementation/employee-master.md`、`docs/implementation/pending-confirmations.md`、`docs/implementation/future-actions.md`
- `docs/roadmaps/employee.md`、`docs/roadmaps/airguard-v2.md`

現経路reviewでは、従属catalog未完、他collectionのEmployee参照作成との競合、旧User削除trigger、旧全文setによる再生成、同ID再作成への古い要求が残ると確認し、[実装条件](../implementation/employee-master.md#誤登録物理削除への切替で残る実装条件)へ反映した。security reviewは文書保存を妨げる指摘なし。文書reviewのP2はCHANGELOGの「User/Auth非連鎖削除」が通常退職にも適用されるように読める点であり、誤登録物理削除だけの条件と明記し、通常退職の承認済みUser/Auth処理を維持する文へ修正した。遅延した旧triggerと同ID再作成も実装時の検証項目へ明示した。

次工程判定は「判断・設計が必要」。今回採用したactor・誤登録削除・archive延期を次工程へ渡せるが、削除catalog/競合/再送/trigger/工程割当と、既存のexact閲覧field、住所送信、氏名・保険・段階writerの判断が未完了である。EMP-01の完了・加点やEMP-02の自動開始はしない。他collectionの既存実装を変えずに削除安全性を満たせると断定せず、必要な範囲変更は理由・代替とともに利用者へ提示する。archive将来工程の詳細決定は今回の開始条件から外す。

確認済み仕様・保持の意味は仕様/ADR、計画はroadmap、実装差と未決事項は既存implementation/CONF/FUTへ反映した。Employeeの現保存shapeを変更していないため、実装調査の「データ契約」は旧実装の記録として維持する。現UI・運用・他master・UWBの挙動は変更せず、manual、operations、他master文書、UWBの過去完了証拠は更新しない。既存索引・再開案内はEmployee roadmapへ到達でき、新ADRだけADR索引に追加した。governance/agent設定とmanaged artifactsは変更しない。

文書でのpermission・保持方針変更として`governance-permissions-agents`のcomprehensive 5 gateを選択する。code/schema/Rulesの実装差、migration、build実行はないためdomain、Emulator、UI build、Dev/Prod generateは今回の検証対象に選ばず、対応実装工程で必要なgateを再選択する。remote未承認のためlive照合・data確認・deployは未実施。

| gate | exact command | 証拠 |
|---|---|---|
| managed-governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | exit 0。renderer-checkもexit 0 |
| project-docs-negative | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 全fixtureの期待結果一致、exit 0 |
| capacity-regression | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks、exit 0。実session容量測定ではない |
| project-docs | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終Markdown状態で実行し、結果/独立exitを本checkpointのcommand reportへ記録 |
| diff-check | `git diff --check` | 最終worktreeで実行し、結果/独立exitをcommand reportへ記録 |

最初の3 gateはこのreview記録の追記ではpolicy上の失効条件に該当しない。新ADRを含むreview済み10文書だけstageし、`git diff --cached --check`も別に行う。後続実装でcode/Rules/schema等を変更した場合、この文書検証をruntimeや削除安全性の成功証拠として流用しない。

### EMP-01再開・全項目閲覧と座標用途の反映

2026-09-06、baseline `ff45699f1513af22ddb32c5380be64bb9675f22e`から、利用者の「他collectionの保存処理・Rulesも変更しない」「現時点では全項目OK」「将来、配置先の現場と従業員の自宅の経路図を描画したい」を反映した。項目限定readの比較と自宅座標取得停止案を今回の前提から外し、参照writerへの存在guard案は対象外と明記した。まとまった報告にEMP-01〜09の一覧を付ける指示も本書へ反映した。

所有差分は次の10文書。製品code・Rules・schema・保存shape・実data・他masterの挙動は変更していない。

- `CHANGELOG.md`、`docs/specification.md`
- `docs/decisions/0056-employee-role-and-archive-boundary.md`、`docs/decisions/0058-employee-full-read-and-geocoding-scope.md`、`docs/decisions/README.md`
- `docs/implementation/authorization-model.md`、`docs/implementation/employee-master.md`、`docs/implementation/pending-confirmations.md`、`docs/implementation/future-actions.md`
- `docs/roadmaps/employee.md`

EMP-01-DELETE-PLAN/BILLINGの静的調査を参照保存候補表へ集約した。Employee以外のwriterを変えずに通常運用中の参照競合を防げる根拠はなく、遅延同期されたBilling等の埋込み参照も原本実績の不存在だけでは除外できない。削除記録や索引・全件scanを自動採用せず、従属の定義・安全条件・工程配分を未決として維持する。

EMP-01-FULLREAD-SEC-REVIEWとEMP-01-FULLREAD-DOC-REVIEWが10文書をread-onlyで確認した。CONF-0111の「exact read field未決」がEmployeeにも見える指摘を修正し、EMP-01-FULLREAD-DOC-R1で解消・追加指摘なしを確認した。基本入力表も通常編集3actorへ同じ入力範囲を認める採用条件と揃えた。これは文書整合のreviewであり、実装・削除の競合・provider・Devを安全と検証したものではない。

以下は全項目閲覧反映時のreview履歴である。次工程判定は「条件の確定が必要」。read方式の比較は解決したが、住所/座標失敗時の保存、氏名・退職後訂正・保険・段階writer、物理削除の成立条件/工程配分は残る。住所保存を継続し古い座標を消して未取得を知らせる案を利用者へ確認中で、回答前には採用しない。EMP-01は進行中・0点、全体0%を維持し、EMP-02は開始しない。

仕様・判断・未決事項・計画と索引/CHANGELOGを更新した。保存shape・既存UI・運用・他masterの変更がないため、data contractのshape、manual、operations、他master文書は更新しない。親roadmapと再開案内は本書を正本として参照済みのため重複更新しない。governance/agent設定・managed artifactsは変更しない。

permission仕様反映として`governance-permissions-agents`のcomprehensive 5 gateを選択した。code/schema/Rules実装・build・migrationは今回行わず、domain、Emulator、UI build、Dev/Prod generateは選択対象外。runtime・remote・実provider接続・実dataは未検証である。

| gate | exact command | 証拠 |
|---|---|---|
| managed-governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | exit 0、含まれるrenderer-checkもexit 0 |
| project-docs-negative | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 全fixture期待結果一致、exit 0 |
| capacity-regression | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks、exit 0。実session容量測定ではない |
| project-docs | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | この記録を含む最終状態で再実行し、独立exitをcommand reportに残す |
| diff-check | `git diff --check` | この記録を含む最終状態で実行し、独立exitをcommand reportに残す |

最初の3 gateはこの文書追記でpolicy上失効しない。新ADRを含む所有10文書だけをreview後にstageし、`git diff --cached --check`を別実行してlocal commitする。結果・commit・最終worktree状態は利用者報告へ記録する。

### EMP-01座標失敗時保存の回答反映と残質問

2026-09-06、baseline `c1483686e3e3fb2051fd0133cac74f993059096b`から、利用者のYESを仕様・ADR 0058・CONF-0117/0120・FUT-0141/0143へ反映した。座標取得だけが失敗した新規作成・住所変更では住所を保存し、古い座標を消して未取得を知らせる。住所不変の通常編集は既存座標を保持する。入力・認可・競合・Firestore保存失敗まで成功扱いにしない。

EMP-01-GEO-ANSWER-REVIEWが、`CHANGELOG.md`、`docs/specification.md`、`docs/decisions/0058-employee-full-read-and-geocoding-scope.md`、`docs/implementation/employee-master.md`、`docs/implementation/pending-confirmations.md`、`docs/implementation/future-actions.md`、本書の7文書をread-onlyで確認し、文書保存を妨げる指摘なしとした。実装・provider・競合の検証ではない。

以下は座標回答反映時に提示した3案の履歴である。退職後編集と保険の最新回答は後続の節とADR 0059を参照する。当時は未採用案であり、物理削除の延期や新しい操作権限を自動確定しない。

1. 他collectionの保存・Rulesを維持し、作成・閲覧・更新・退職の権限制御を先行、物理削除は安全条件が整う後続工程へ分ける案。誤登録削除の採用要件は取り消さないが、提供時期・完了条件・工程配分が変わるため判断を要する。現承認条件で通常運用中の並行参照追加を防げる根拠は未確認。
2. 退職後も会社管理者・統括・人事が通常情報を訂正できる案。退職状態・日付の訂正は専用操作を維持し、User/Auth復元・業務履歴の再生成へ拡張しない。
3. 保険の履歴復元も通常編集の3actorへ認め、手続中操作は現行遷移を維持する案。現行の手続中復元不可は維持し、先に取下げ必須・復元は会社管理者だけ等の未採用制限を追加しない。

氏名・codeの既存の業務上の意味を維持する方向で技術案を具体化し、新採番・候補制限を追加しない。保存方式・局所競合・座標未取得表現・段階writer移行・工程配分は設計と受入条件のreviewが残る。質問数を減らしたことを技術設計完了と混同せず、EMP-01進行中、EMP-02未開始、全体0%を維持する。

仕様採用を含む文書変更は純粋なdocumentation-onlyに該当しないため、policyの未分類影響のcomprehensive 5 gateを選択する。managed-governance（内包rendererを含む）、project-docs-negative、capacity-regressionを前節のexact commandで実行し、それぞれexit 0。容量試験は合成fixture 7 checksであり実session測定ではない。追記後のproject-docs・diff-checkとstage後のcached diff-checkは別々に実行してcommand reportへ独立exitを残す。最初の3 gateは文書追記による失効条件に該当しない。

製品code・Rules・schema・実data・governance設定は未変更。仕様・ADR・現状との差・未決事項・進捗・CHANGELOGを更新し、保存表現の実装がないため既存data shape・manual・operationsを変更しない。新文書はなく既存索引を維持する。runtime/build/Emulator/Dev・実provider接続は対象外で未実施。review済み所有7文書だけlocal commitし、Git状態を報告する。

### EMP-01退職後編集・保険回答と削除条件の説明

2026-09-06、baseline `fafbe11a645d63114702977995ac1c2240b97767`から、退職後の通常編集禁止、在職者の保険履歴復元を含む3actor許可・現行遷移維持を仕様と[ADR 0059](../decisions/0059-employee-retired-edit-and-insurance-operation-boundary.md)へ反映した。物理削除延期は承認されておらず、利用者が定義を求めた[削除の5条件](../implementation/employee-master.md#削除を許可するための判定項目)を具体化した。未対処の同時参照追加と、他collectionを変更しない条件下での方式未確定を、全方式の不可能性から区別する。

EMP-01-DELETE-CONDITIONSがsource根拠と最小条件をread-onlyで確認し、EMP-01-RETIRED-ANSWER-DOC-REVIEWがPMの9文書を確認して文書保存を妨げる指摘なしとした。次工程では座標取得待ちを含む編集中の退職を保存境界で拒否し、EMP-02〜04で退職者への直接更新拒否・data不変・draft保持、EMP-06で既存の専用誤退職訂正を回帰確認する。削除方式・工程配分・技術設計が残るため、EMP-01進行中・0点、EMP-02未開始を維持する。

所有差分は`CHANGELOG.md`、`docs/specification.md`、`docs/decisions/README.md`、新ADR 0059、`docs/implementation/employee-insurance.md`、`docs/implementation/employee-master.md`、`docs/implementation/pending-confirmations.md`、`docs/implementation/future-actions.md`、本書。仕様・認可/状態契約・実装との差・CONF/FUT・工程と索引を揃えた。保存shape・既存dataは変更せず、現UIを説明するmanual・operationsは実装時に更新する。他master、governance/agent設定、managed artifactsは変更しない。

権限仕様変更として`governance-permissions-agents`のcomprehensive 5 gateを選択した。下記の各command結果・独立exitはcommand reportへ残す。

| gate | exact command | 結果 |
|---|---|---|
| managed-governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | exit 0。内包renderer-checkもexit 0 |
| project-docs-negative | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 全fixture期待結果一致、exit 0 |
| capacity-regression | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks、exit 0 |
| project-docs | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終追記後に再実行しcommand reportへ結果を記録 |
| diff-check | `git diff --check` | 最終追記後に実行しcommand reportへ結果を記録 |

最初の3 gateはこの追記でpolicy上失効しない。新ADRを含む所有9文書だけstageし、`git diff --cached --check`を別実行してlocal commitする。code・Rules・schemaの実装差がないためdomain/Emulator/UI buildは対象外。runtime・削除競合・実provider・Dev/remote・実dataは未検証で、文書gate成功をその代用にしない。
