# Employeeマスター改修ロードマップ

- 状態: EMP-01進行中（actorと誤登録物理削除・archive延期を確定、削除実装契約・工程配分と他仕様は判断中）
- 目標: Employee通常CRUDをoperation固有のeditor・application処理・保存境界へ移し、個人情報の過剰アクセス、全文上書き、保存前のlive変更、失敗・競合時の不整合を解消する。
- 現在の進捗: 0%
- 部分加点: 行わない。各工程の完了条件と必要な利用者判断・review・検証をすべて満たしてから当該重みを加点する。調査・案の保存を製品実装の達成と混同しない。
- 承認境界: 2026-09-06に計画文書保存・review・文書検証・local commitとEMP-01開始を承認し、[ADR 0056](../decisions/0056-employee-role-and-archive-boundary.md)のactor・閲覧最小化を採用した。同日、[ADR 0057](../decisions/0057-employee-hard-delete-and-archive-deferral.md)の会社管理者・統括だけの従属なし誤登録物理削除、archive延期、他collectionの既存実装維持を採用し作業開始を指示した。他の未決仕様、工程追加/重み配分、EMP-02以降の実装、Dev・Prod・remote・実data・package変更は未承認である。
- 実行単位: 今回は一気通貫で進めず、工程ごとに作業・review・報告を行い、次工程の開始指示を待つ。合意済み工程内の通常修正にcommand/fileごとの再承認は追加しない。

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
| EMP-01 契約・対象確定 | 10 | 0 | In progress | actor方針と誤登録物理削除・archive延期を前提に、exact read field、退職後編集、保険遷移/訂正、住所送信、code/氏名/候補、read方式、operation所有fieldと競合方針を判断する。統括退職・物理削除の依存、他collectionを変更しない条件との整合、工程配分も確定し、採用範囲だけ仕様・必要ADRへ反映する。独立reviewでEMP-02の入力・保存・test前提が揃ったことを確認し報告する。 |
| EMP-02 作成・基本・国籍 | 20 | 0 | Planned | 独立draft、同ID/create-onlyと結果照合、基本/国籍のexact field保存、住所入力、派生field、従属field初期化、採用した同field競合契約・異field保持を実装する。対象operationの権限・型・fieldを保存境界で強制し、旧allowによる迂回も閉じる。未移行editorの停止/先行保存互換をEMP-01で決定し、代表UI保存・再読込・失敗を確認する。 |
| EMP-03 警備員登録・資格 | 10 | 0 | Planned | 登録情報と資格配列を別operationとして保存する。同名・名称変更・削除・別行追加・古い配列の再送で他行を失わず、保険・基本情報・lifecycleへ書かない。対象actor、従属初期化、拒否・成功のdata比較と代表UIを確認する。 |
| EMP-04 3保険の保存 | 15 | 0 | Planned | 各保険の承認済み遷移だけをserverで検証し、対象保険の現在値/historyと局所的期待値を照合する。live非mutation、保存await、確定拒否時のwrite 0、応答不明時の照合、二重history変更防止を確認する。監査制度全面刷新を暗黙追加しない。 |
| EMP-05 個人情報read・直接reader互換 | 20 | 0 | Planned | 最小read API/必要な表示用dataと全直接readerを一体で切り替える。現在Auth/User、identity由来tenant、公開field・値・検索情報・error、exact入力・用途に応じた取得上限/paging、Employee/archivesと汎用Rulesを確認する。DTOを全文Employeeとして扱わない表示/cache adapter、cold cache、初期選択ID、期間内退職者、更新反映、権限喪失を検証する。 |
| EMP-06 一覧・検索・User画面 | 10 | 0 | Planned | 空・loading・error、古い検索応答、作成導線を契約へ揃える。User panel shellを整理し、既存User provision/deleteと退職・訂正の許可拒否を維持する。到達するEmployee CRUDのManager依存・旧model mutation経路を再検索し、操作証拠と照合する。 |
| EMP-07 独立課題の一括確認・修正 | 5 | 0 | Planned | FUTの対象一覧・方針・影響・test・Devを阻害する問題を利用者と一括確認し、合意した独立問題だけ設計review・修正・検証する。対象なしなら根拠ある分類確認で完了し、加点のために実装を増やさない。 |
| EMP-08 Local統合確認 | 5 | 0 | Planned | 各工程の代表操作証拠を前提に、全目的と最終diff・必須gate・独立review・直接回帰・UI・cleanupを対応づける。初回確認をここへ集中しない。未達があれば該当工程を未完として扱う。 |
| EMP-09 Dev反映・受入れ | 5 | 0 | Deferred / 別承認 | マスタ一連改修後の集約受入れで、旧client、必要な既存data、対象service、復旧を確認して反映し、権限別操作と関連readを受け入れる。必要なmigrationは対象・backup・dry-run・apply・post-checkを別承認する。 |

重み合計は100。EMP-05までPIIの過剰readは未対処であり、read/writeすべての対象条件が揃う前に「CRUD保護完了」と表現しない。EMP-02〜04の暫定許可は移行済みoperationのfieldを変更できないことを、複数operationを混ぜたpayloadでも確認する。EMP-06でshellを整理する画面も、EMP-05で必要なread adapterを先に接続する。EMP-09まで個別のremote反映は行わない。

## 工程別の操作・data・証拠

各実装工程で、同一tenantの許可actor、read-only、roleなし、未知/直接permission、不正claim、無効/仮User、他tenant、super-userを、EMP-01で確定したmatrixに照らして確認する。合成dataを使い、現物の個人情報はfixtureへ持ち込まない。

| 工程 | 操作とdata前提 | 期待結果 | 確認方法・証拠 |
|---|---|---|---|
| EMP-02 | 標準/外国籍、住所手入力、任意code、ACTIVE/RESIGNED/誤訂正後の既存Employeeを作成・編集 | 所有fieldと派生fieldだけ変更。User/予約/退職field（不存在を含む）は不変。住所送信は判断済み方式だけ | operation test、保存前後data、Emulator陰性、editorから保存して再読込するUI |
| EMP-02〜04 | 取消・権限拒否・不正入力・保存前競合・連打・保存後応答未着 | 確定拒否はwrite 0とdraft保持。結果不明は成功/未保存を断定せず再読込照合。旧draftの自動再送、重複作成、二重history操作なし | 制御可能な非同期test、保存前/保存後の失敗注入、UI feedback、正本data比較 |
| EMP-02〜04 | 2 actorの別section保存、同section先行保存、別保険・同保険、資格別行同時変更 | 別field変更を保持。通常fieldは採用したlistener通知/再読込とlast-write-winsの限界を確認。保険map/資格配列/採用した相関fieldは保存境界で古い期待値を拒否 | transaction/局所期待値の対象test、Emulator競合、代表2画面確認 |
| EMP-03 | 登録有無の往復、資格0/複数/同名legacy/名称変更/削除 | 承認された従属初期化。対象行を誤らず他行保持。新しい資格IDのpackage導入を既定にしない | operation test、配列の前後比較、代表編集UI |
| EMP-04 | 3保険それぞれの未加入/適用除外/手続中/加入済み/historyありに6操作 | 承認された状態遷移・日付/番号条件だけ成功。3つの保存field取り違えとhistory差替えを拒否 | 遷移表の全行test、保存境界、成功/拒否/応答不明の比較、代表UI |
| EMP-05 | 管制・勤怠等のreader、空cache、初期選択ID、期間内退職者、氏名変更、権限/tenant変更中の遅延応答 | 必要なcurrent master名・期間等だけ解決。当該actor・用途へ公開を許可していないfield/値を返さず、誤った国籍/性別/在職既定表示なし。現client管理cacheを破棄し旧応答を無視 | API projection/入力上限/境界拡張拒否のassertion、Rules get/list/archives/nested陰性、表示/cache単体、直接readerのUI |
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

- Employee単一正本を既定とし、閲覧actor差と必要な更新反映を満たす最小read APIを第一候補として比較する。1回fetchへの置換を購読と同等とはしない。必要なら限定した業務projectionを比較し、新pathの最初のwrite前のdeny、同期・stale対策・backfill・復旧まで設計する。方式未決では依存実装へ進まない。
- DTOは全文Employeeと分ける。class accessor、必須field、instanceof依存を満たすために非公開PIIを返さず、必要なEmployee固有adapterを用意する。partial DTOを全文writerへ渡さない。
- 実効schema変更、他機能への明確な影響、確実な変換必要性がある場合だけ既存dataを必要範囲で確認する。入社日変更が期間検索へ影響する点はEMP-02で扱う。全件診断・一括修復・package更新を一律の前提にしない。
- 自宅geocodingの停止/継続はCONF-0120で判断する。継続時は用途・actor・precision・log・外部送信条件を先に固定する。共通APIへの変更が必要なら他master影響を説明したsegmentとして扱い、未解決のままEMP-02を完了しない。停止時の既存座標削除も別のdata操作である。
- 未反映codeは所有差分を対象に安全に戻せるが、反映後はPIIの広域read/write再開放を復旧の既定にしない。影響操作の停止と互換修正を検討し、data変換の復旧は承認済みbackup・手順へ従う。User/Authの旧UID復元を行わない。
- EMP-05のcache破棄は新実装が管理するmemory・永続cache・遅延応答を対象とする。旧clientや取得済みの複製PIIを回収できたとは主張せず、旧client併存条件をEMP-09で確認する。

## 検証選択と現在の次作業

提案保存・既存事実訂正は[検証policy](../../governance/verification-policy.json)のproject-guidance-metadata/documentation-onlyで扱い、project-docsとdiff-checkを選ぶ。未追跡文書はreview後のcached diff checkでも検証する。これは製品permission、project共通規則、release手順を変更する承認ではない。

後続実装は実diffのUI/application/data-contract等のunionから選択し、直接test→対象回帰→最終状態のcompletion gateを実行する。UI・logic・Rules変更の基本集合はproject-docs、domain-full、local-emulator-suite、local-ui-build、diff-checkであり、build実行・permission定義・release等の該当classはpolicyどおり追加する。環境・実行承認がないgateは記載だけを根拠に実行しない。各commandの結果・exit・証拠失効・省略理由をcompletion reportへ残す。

現在はactor方針を仕様・ADR 0056・既存CONFへ反映し、exact read field等の残る判断を[CONF-0061](../implementation/pending-confirmations.md#conf-0061-employee個人情報の閲覧編集保持権限)と[保存・read契約案](../implementation/employee-master.md#emp-01の保存読取り契約案)で扱う。今回の権限仕様採用は`governance-permissions-agents`としてcomprehensive 5 gateを選択する。EMP-01-ADOPT-SECとEMP-01-ARCHIVE-IMPACTは、actor変更と既存保護の分離、旧3依存guardだけでは不十分なこと、原本削除のUser背景処理、同時参照作成との整合を確認した。runtime/dataの検証結果ではない。

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
