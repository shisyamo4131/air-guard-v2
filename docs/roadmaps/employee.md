# Employeeマスター改修ロードマップ

- 状態: EMP-01〜05完了。閲覧互換・参照保護・専用archiveをlocalで受け入れ、最終統合・次工程reviewを完了した。EMP-06は開始指示待ち。
- 目標: Employee通常CRUDをoperation固有のeditor・application処理・保存境界へ移し、個人情報の過剰アクセス、全文上書き、保存前のlive変更、失敗・競合時の不整合を解消する。
- 現在の進捗: 75%
- 部分加点: 行わない。各工程の完了条件と必要な利用者判断・review・検証をすべて満たしてから当該重みを加点する。調査・案の保存を製品実装の達成と混同しない。
- 承認境界（以下は採用経緯。最新方針は次項）: 2026-09-06に計画文書保存・review・文書検証・local commitとEMP-01開始を承認し、[ADR 0056](../decisions/0056-employee-role-and-archive-boundary.md)のactor・閲覧最小化を採用した。同日、[ADR 0057](../decisions/0057-employee-hard-delete-and-archive-deferral.md)の会社管理者・統括だけの従属なし誤登録物理削除、archive延期、他collectionの既存実装維持を採用し作業開始を指示した。この時点の未決事項は後続回答で順次置換した。後続の開始承認は次項を参照する。Dev・Prod・remote・実data・package変更は未承認のままである。
- 実行単位: 最新指示「コミットし、EMP-05を開始してください」により設計4文書をlocal統合し、EMP-05の内部05-A〜Eを順に実施する。各単位の作業・review・検証・local統合を維持し、EMP-05の完了報告で停止する。EMP-06以降、Dev/Prod・実data・remoteは開始しない。
- 最新の採用: [ADR 0060](../decisions/0060-common-archive-purge-and-address-contract.md)により、直接物理削除・archive延期と必要な従属writer変更禁止を置換した。Employeeから別archive collectionへの移動と参照整合性を設計し、住所・座標とarchive/物理削除は共通仕様を参照する。actor・全項目read・退職後通常編集禁止・保険の条件は維持する。最終回答で表示名/作成導線、archive同一7actor read、local段階移行、EMP-05の参照保護/archive、purge後続専用工程、9工程の重み合計100も採用した。その後EMP-04までの実装・local検証・review・文書更新・local統合も承認された。
- 利用者への報告: EMPの作業結果・現在地を報告する際は、本書のマイルストーン表を基にEMP-01〜09の工程名・状態・必要に応じた残作業を一覧で示し、EMP全体の確認済み進捗を併記する。短い作業中の連絡では表を毎回繰り返さず、まとまった報告には必ず付ける。工程内の成果を未確認の割合へ換算せず、部分加点なし・Dev別承認の条件を維持する。
- EMP-05実装前の再確認: 利用者が設計・review・文書化を指示した。[開発者向け実装前契約](../implementation/employee-master.md#emp-05実装前契約)へ経路/field/actor/競合/開放条件/受入例を補い、開発者・受入・securityの指摘を解消した。[レビュー記録](../verification/employee-05-design-review.md)を実装開始時の入力にし、明示承認で実装した。[EMP-05 local実施記録](../verification/employee-05-local.md)に全内部単位の受入れを記録し、完了により55%から75%へ更新した。

## 正本と維持する境界

- 確認済み要件は[現行仕様](../specification.md)、User連携は[ADR 0018](../decisions/0018-user-provisioning-and-employee-link-boundary.md)、退職・誤退職訂正は[ADR 0020](../decisions/0020-employee-retirement-user-offboarding-and-reinstatement.md)を正とし、退職actorへの統括追加だけADR 0056で更新する。1 Employee対最大1 User、通常退職でEmployeeと業務記録を保持、仮Userは先に専用削除、誤訂正でUser/Auth非復元という境界を作り直さない。
- 現経路と依存は[Employee実装調査](../implementation/employee-master.md#現行経路の再照合)、保険の現遷移は[保険調査](../implementation/employee-insurance.md)、未決の回答は[確認事項台帳](../implementation/pending-confirmations.md)、独立問題は[既存FUT](../implementation/future-actions.md)を使用する。破棄済みtaskの案を根拠・承認・進捗にしない。
- [ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)と[ADR 0055](../decisions/0055-scope-discovery-and-acceptance-review.md)、[開発workflow](../runbooks/development-workflow.md)、[checkpoint transition](../runbooks/project-coordination.md#checkpoint-transition)を適用する。新しい全project向けgate・台帳・runbookは追加しない。
- 既存document ID、ACTIVE/RESIGNED、在籍期間、現在master名による過去記録の表示を互換境界にする。過去時点の旧氏名をsnapshotから再現できるという意味ではない。既存通知本文は遡及変更しない。

## 対象と対象外

対象は在職者一覧での作成、基本・国籍・警備員登録・保有資格・3保険、一覧・検索・詳細、Employeeのread/write Rules、必要な専用API・actor policy・Employee固有cache/表示adapterである。Employee画面のUser panelは既存UWB controller/serverを維持してdialog shellだけ専用化する。

対象CRUDではAirItemManager/AirArrayManagerによる永続化、live draft、保存完了制御への依存を除去する。保険・資格はlocal配列を編集していても直後にEmployeeを保存する現経路なのでlocal-only例外とはしない。独立draft内の入力部品を再利用する場合も保存・認可・成功/失敗判定を汎用Managerへ戻さない。既存UWB専用保存を維持する例外はEMP-01で固定し、単なるcomponent名検索だけで目的達成としない。

配置・通知・実績・勤怠・請求・帳票の業務仕様は維持する。ただしEmployeeへの参照を新設/変更/再生成する保存境界、Rules、query用field・必要な既存data対応は、archive成立のための限定した設計対象に追加する。金額計算、他masterのarchive方式、User email同期、本人Self Access、全manager/cache基盤、package、全master一括移行を含めない。

archiveは同IDの別collection移動とし、物理削除はarchive後の別操作とする。確認済み要件は[現行仕様](../specification.md#employeeの操作権限と保持)、設計は[Employee archive設計](../implementation/employee-master.md#employeeのarchive設計)と[共通物理削除案](../implementation/archive-restore.md#物理削除の設計案)を参照する。通常保存・raw snapshot・従属query、日次2collectionと請求の埋込み索引を具体化した。操作表示・archive read・段階移行/工程配分は採用済み。purge実行は後続専用工程に分け、今回のEMP完了には含めない。

## 最終確認用の工程割当案

2026-09-06の最終回答で下表を採用し、重み合計100とEMP-01〜09を確定した。見出しは既存link維持のため残す。必要なarchive/参照保護をEMP-05へ組み込む。各工程の実装開始・完了は別に判定する。

| 工程 | 追加・確定する作業 | 次工程へ渡す条件 |
|---|---|---|
| EMP-02 | 作成・基本・国籍の専用保存と独立draft。Employee原本readを採用7actorへ揃え、client CUD・archive CUD・汎用迂回を閉じる。archive readも同じ7actorに揃える。未移行の警備/資格/保険editorはlocalだけread-only | 他section/未知field/lifecycleを保持。User panel・退職・訂正は既存専用処理を維持。APIのwire/結果・draft/認可共通部をEMP-03へ渡す |
| EMP-03 | 警備員登録・資格を移行し再開。資格は期待配列と位置で行を特定 | 同名行/名称変更/他行同時変更を誤上書きしない。保険editorは未移行停止のまま |
| EMP-04 | 3保険を専用保存へ移し再開。履歴復元を含む6操作・局所期待値と巻き戻さない保険別世代値を検証 | 通常Employeeの全writerを保護し、旧全文writerを残さない |
| EMP-05 | 既存reader/cache互換に加え、参照writer/Rules、日次2種・請求の検索用field、限定整合確認の手段、User削除trigger停止、専用archiveと通常候補からの除外を実装 | 参照あり拒否・競合両順序・埋込み参照・旧writer拒否がlocalで成立。archive後も権限に応じたreadを検証。実data対応はEMP-09の別承認 |
| EMP-06 | 一覧・検索・作成導線・User shellを整える。統括退職actorを専用policyへ反映し、UWB既存条件を回帰 | Employee画面の到達する通常CRUDに旧Manager保存がない。正常/空/失敗・権限喪失を確認 |
| EMP-07〜09 | 独立課題→Local統合→別承認Devの既存順序 | 個別工程の必須未達を独立課題や最終確認へ先送りしない |

EMP-05の内部順序はreader/参照契約→参照writer・index保持→旧trigger/再生成対処→専用archive→競合/表示回帰。重み20は内部で部分加点せず、全受入れ完了後に加点した。EMP-05完了報告で停止し、EMP-06は別の開始指示を待つ。

物理削除は今回、共通仕様と実装可能な設計案までとする。実行機能・定期処理・保持期間・最小ID記録の運用は後続の専用工程へ分離することを採用済み。FUT-0146で管理し、後続purgeの未完をEMPの達成として加点しない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 内容と完了条件 |
|---|---:|---:|---|---|
| EMP-01 契約・対象確定 | 10 | 10 | Completed | actor・保存/競合・住所/座標・archive形式/従属/閲覧・表示名/作成導線・段階移行/提供工程を確定し、仕様・必要ADR/CONF/FUTへ反映する。独立review・文書検証によりEMP-02の入力・保存・test前提を確認して報告する。 |
| EMP-02 作成・基本・国籍 | 20 | 20 | Completed | 専用保存・独立draft・7actor read/直接CUD拒否、住所と派生field・局所競合・異field保持を実装した。独立reviewの指摘を修正し、domain 1180件・Emulator 172件・修正後build・実UI作成/基本/国籍/取消/再読込/通知・backend照合・cleanupを確認。[検証記録](../verification/employee-02-04-local.md)を参照。 |
| EMP-03 警備員登録・資格 | 10 | 10 | Completed | 専用保存・原配列位置・raw期待値を実装。同名資格・名称変更・対象行削除・2画面競合/再選択、警備登録/解除9field・非対象保持を直接UI/backendで確認。解除値の不一致を修正し独立再review、domain1191件・Emulator173件・修正版build・cleanupを完了。[検証記録](../verification/employee-02-04-local.md)を参照。 |
| EMP-04 3保険の保存 | 15 | 15 | Completed | 3保険×6操作の専用保存、raw map/巻き戻さない世代値、部分patch・独立draftを実装。独立reviewの不存在getter指摘を修正し、domain1227件・Emulator174件・専用build・6操作/他2保険分離/2画面競合の実UIとbackend・cleanupを確認。[検証記録](../verification/employee-02-04-local.md)を参照。 |
| EMP-05 閲覧互換・参照保護・アーカイブ | 20 | 20 | Completed | 7actorの原本/archive read、現在認可と期間cache、参照writer/Rules・背景索引・限定整合確認・旧削除trigger無作用・専用archiveを実装した。独立review、最終domain1456件・Emulator180件、fresh buildと各内部単位の代表実UI/backend、cleanupを確認。12従属・競合両順序・raw保持・unknown確認・通常候補/旧draft除外を受け入れた。[最終matrixと証拠](../verification/employee-05-local.md#05-e-統合次工程review)を参照。通常API公開・実data・DevはEMP-09の別承認。 |
| EMP-06 一覧・検索・User画面 | 10 | 0 | Planned | 空・loading・error、古い検索応答、作成導線を契約へ揃える。User panel shellを整理し、既存User provision/deleteと退職・訂正の許可拒否を維持する。到達するEmployee CRUDのManager依存・旧model mutation経路を再検索し、操作証拠と照合する。 |
| EMP-07 独立課題の一括確認・修正 | 5 | 0 | Planned | FUTの対象一覧・方針・影響・test・Devを阻害する問題を利用者と一括確認し、合意した独立問題だけ設計review・修正・検証する。対象なしなら根拠ある分類確認で完了し、加点のために実装を増やさない。 |
| EMP-08 Local統合確認 | 5 | 0 | Planned | 各工程の代表操作証拠を前提に、全目的と最終diff・必須gate・独立review・直接回帰・UI・cleanupを対応づける。初回確認をここへ集中しない。未達があれば該当工程を未完として扱う。 |
| EMP-09 Dev反映・受入れ | 5 | 0 | Deferred / 別承認 | マスタ一連改修後の集約受入れで、旧client、必要な既存data、対象service、復旧を確認して反映し、権限別操作と関連readを受け入れる。必要なmigrationは対象・backup・dry-run・apply・post-checkを別承認する。 |

重み合計は100として確定した。全項目readはroleなし等の過剰readを許可しない。EMP-02で原本/archiveの認可と直接client CUD拒否を揃え、未移行editorはlocal read-onlyとする。混在payloadでも迂回できないことを確認し、EMP-03/04で専用writer完成後に再開する。EMP-05でreader互換と参照保護・archiveを確認し、EMP-06でUser shellと統括退職actorを整える。EMP-09まで個別remote反映は行わない。

## 工程別の操作・data・証拠

各実装工程で、同一tenantの許可actor、read-only、roleなし、未知/直接permission、不正claim、無効/仮User、他tenant、super-userを、EMP-01で確定したmatrixに照らして確認する。合成dataを使い、現物の個人情報はfixtureへ持ち込まない。

| 工程 | 操作とdata前提 | 期待結果 | 確認方法・証拠 |
|---|---|---|---|
| EMP-02 | 標準/外国籍、住所手入力、任意code、ACTIVE/RESIGNED/誤訂正後の既存Employeeを作成・編集 | 在職者は所有fieldと派生fieldだけ変更。退職者は通常更新を拒否。User/予約/退職field（不存在を含む）は不変。住所送信は判断済み方式だけ | operation test、保存前後data、Emulator陰性、editorから保存して再読込するUI |
| EMP-02〜04 | 取消・権限拒否・不正入力・保存前競合・連打・保存後応答未着 | 確定拒否はwrite 0とdraft保持。結果不明は成功/未保存を断定せず再読込照合。旧draftの自動再送、重複作成、二重history操作なし | 制御可能な非同期test、保存前/保存後の失敗注入、UI feedback、正本data比較 |
| EMP-02〜04 | 2 actorの別section保存、同section先行保存、別保険・同保険、資格別行同時変更 | 別field変更を保持。通常fieldは採用したlistener通知/再読込とlast-write-winsの限界を確認。保険mapと巻き戻さない世代値/資格配列/採用した相関fieldは保存境界で古いraw期待値を拒否 | transaction/局所期待値の対象test、Emulator競合、代表2画面確認 |
| EMP-03 | 登録有無の往復、資格0/複数/同名legacy/名称変更/削除 | 承認された従属初期化。対象行を誤らず他行保持。新しい資格IDのpackage導入を既定にしない | operation test、配列の前後比較、代表編集UI |
| EMP-04 | 3保険それぞれの未加入/適用除外/手続中/加入済み/historyありに6操作 | 在職者の許可3actorで現行遷移・日付/番号条件だけ成功。退職者は全操作拒否。3つの保存field取り違え、history差替え、喪失/復元でmapが元に戻った後の古い要求を拒否 | 遷移表の全行test、保存境界、成功/拒否/応答不明の比較、代表UI |
| EMP-05 | 管制・勤怠等のreader、空cache、初期選択ID、期間内退職者、氏名変更、削除、権限/tenant変更中の遅延応答 | 許可actorは全項目を読めるが閲覧だけで更新できない。原簿氏名・国籍/性別/在籍期間を維持し、非許可actor・他tenantを拒否。現client管理cacheを破棄し旧応答を無視。既存page条件も維持 | Rules get/list/archives/nested陰性、表示/cache単体、既存queryと直接readerのUI。DTO/projection試験は不要 |
| EMP-05 | archiveと参照保存の競合、従属12対象（9 query・3 document取得）、日次2種/請求の埋込み、索引欠損、遅延再生成、同ID再作成、旧削除event | 参照あり/検査失敗はwrite 0。archive先行なら新規参照拒否、参照先行ならarchive拒否。原本とarchiveを原子的に移動し、他Employee/User/Auth・金額は不変 | 操作/Rules test、Emulator競合両順序、参照不変/1人追加のread測定、archive UIと再読込。実dataはEMP-09の別承認 |
| EMP-06 | 在職/退職検索、空検索、入力race、仮User作成削除、Employee-only/仮User/本登録User連携、誤退職訂正 | 確定した一覧挙動、既存UWB許可拒否・予約整合を維持。通常編集でAuth/Userを復元・同期しない | 検索/controller test、既存UWB回帰、正規UIとbackend assertionを分離した証拠 |
| EMP-07〜09 | 独立FUTの合意scope、最終統合、後日のDev権限別操作 | 必須未達を先送りせず、localとDevを区別して受け入れる | 対象確定記録、目的と証拠の対応、最終gateの独立exit、環境終了・cleanup結果 |

既存UWBのtestは再利用候補だが、通常CRUD・保険・資格の安全性を証明するものではない。既存testの実測成功を今回の証拠へ転記しない。空cache等の直接互換と別機能全業務の受入れを区別する。

## 工程終了時の次工程レビュー

利用者の2026-09-06指示に基づき、Employeeの各工程報告には、現在工程の目的達成に加えて次工程を考慮した独立reviewを含める。既存のcheckpoint callback/completion reportへ、次の内容をまとめる。

- 次工程が受け取るfield・API・reader・writer・actor・data前提と、現在工程の成果が一致するか。
- 次工程で現在工程の保護/互換性を破壊しないか。未移行経路、旧allow、cache、schema、rollbackの不足がないか。
- 次工程開始前に必要な利用者判断・未検証と、それを解消する担当・確認方法。
- 次工程の変更で失効する検証証拠と、直接回帰として再確認する対象。
- 「次工程へ進める」「判断/修正が必要」を理由付きで報告する。前者では既存の開始承認範囲に従う。今回のEMP-02〜04は連続実施し、範囲外は開始指示を待つ。

現在工程の必須条件未達は、次工程の予定へ付け替えず現在工程を未完とする。次工程の実装や全体再設計を、reviewだけの承認から始めない。EMP-09では次の運用・残課題への影響を同じ観点で確認する。

## 独立問題の扱い

[既存FUT](../implementation/future-actions.md)へ、発見工程、再現根拠、影響、現在工程を妨げない理由、対応予定を同一原因へ統合する。FUT-0075、0079、0126、0143、0159、0181のうち今回目的に必要な部分は対応工程の必須条件であり、EMP-07への送り先にはしない。FUT-0076の既存UWBは統括退職追加部分を除き維持回帰、FUT-0077の実再雇用/将来退職、FUT-0078のrestore/匿名化、保険監査制度や全manager改修は将来の別判断とする。誤登録archiveのactor/従属拒否と物理削除の設計・提供工程はEMP-01で確定し、archive実装はEMP-05、purge実行は後続専用工程とする。物理削除の運用未決を理由に通常CRUDやarchiveを一律延期しない。

## 互換性・移行・復旧

- Employee単一正本・全項目read・既存購読を維持する。閲覧項目を制限するための新API・projection・通知・polling・data移行は不要であり、方式選定をEMP-02の前提から外す。
- 既存Classのaccessor・instanceof・検索/表示互換を維持する。全項目の取得を許可しても、更新はoperation所有fieldへ限定し全文setへ戻さない。
- 実効schema変更、他機能への明確な影響、確実な変換必要性がある場合だけ既存dataを必要範囲で確認する。入社日変更が期間検索へ影響する点はEMP-02で扱う。全件診断・一括修復・package更新を一律の前提にしない。
- 自宅geocodingは将来の現場・自宅経路図のため取得・保存を継続する。CONF-0120の必要性・用途・閲覧actor・失敗時の住所保存/旧座標消去/未取得通知は回答済み。最新住所/座標整合・log・Employee専用境界と共通入口の扱いを確定し、未解決のままEMP-02を完了しない。他masterの住所保存実装は今回変更せず、経路図や実provider接続・全件座標更新は対象外とする。Employee参照保護の限定例外とは区別する。
- 未反映codeは所有差分を対象に安全に戻せるが、反映後はPIIの広域read/write再開放を復旧の既定にしない。影響操作の停止と互換修正を検討し、data変換の復旧は承認済みbackup・手順へ従う。User/Authの旧UID復元を行わない。
- EMP-05のcache破棄は新実装が管理するmemory・永続cache・遅延応答を対象とする。旧clientや取得済みの複製PIIを回収できたとは主張せず、旧client併存条件をEMP-09で確認する。

## 検証選択と現在の次作業

今回の採用反映は[検証policy](../../governance/verification-policy.json)の文書・進捗classに加え、権限・安全仕様変更としてgovernance-permissions-agentsのcomprehensive 5 gateを選ぶ。製品実装・project共通規則・release手順の変更には広げない。review後にcached diff checkでも検証する。

後続実装は実diffのUI/application/data-contract等のunionから選択し、直接test→対象回帰→最終状態のcompletion gateを実行する。UI・logic・Rules変更の基本集合はproject-docs、domain-full、local-emulator-suite、local-ui-build、diff-checkであり、build実行・permission定義・release等の該当classはpolicyどおり追加する。環境・実行承認がないgateは記載だけを根拠に実行しない。各commandの結果・exit・証拠失効・省略理由をcompletion reportへ残す。

EMP-01の確定後、EMP-02〜05の専用保存・独立draft・認可・参照保護/archive・代表UIと工程ごとのreview/検証/統合を完了した。次作業はEMP-06の一覧・検索・User shellと統括退職actorで、開始指示待ちである。Dev/Prod・実data・外部作用・関連packageは未承認/未実施のままである。EMP-05の20点を全受入れ完了で加算し55%→75%とした。重み合計100・部分加点なし・親製品進捗へ非合算の条件は変えない。

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

対象は仕様、ADR 0020/0033/0056とADR索引、CHANGELOG、Employee/Company/User/認可の既存実装文書、CONF/FUT、Employee/Company/親roadmapの15文書。code・Rules・package・data・agent設定は変更しない。archiveの同document状態更新案は[方式比較](../implementation/employee-master.md#employeeのarchive設計)に残し、方式採用を先取りしない。comprehensive 5 gateのexact commandは[検証policy](../../governance/verification-policy.json)に従い、結果と独立exitは本作業のcommand reportで確認する。

### EMP-01誤登録物理削除採用のreview

2026-09-06、baseline `891a2604bdeaa2b981ae0bedda02b5fd6021b1b5`からのPM所有文書差分を、EMP-01-DELETE-IMPACT（現経路）、EMP-01-DELETE-SEC-REVIEW（security）、EMP-01-DELETE-DOC-REVIEW（文書・次工程）がread-onlyで確認した。対象は次の10文書で、製品code・Rules・package・実dataへの変更はない。

- `CHANGELOG.md`、`docs/specification.md`
- `docs/decisions/0056-employee-role-and-archive-boundary.md`、`docs/decisions/0057-employee-hard-delete-and-archive-deferral.md`、`docs/decisions/README.md`
- `docs/implementation/employee-master.md`、`docs/implementation/pending-confirmations.md`、`docs/implementation/future-actions.md`
- `docs/roadmaps/employee.md`、`docs/roadmaps/airguard-v2.md`

現経路reviewでは、従属catalog未完、他collectionのEmployee参照作成との競合、旧User削除trigger、旧全文setによる再生成、同ID再作成への古い要求が残ると確認し、[実装条件](../implementation/employee-master.md#employeeのarchive設計)へ反映した。security reviewは文書保存を妨げる指摘なし。文書reviewのP2はCHANGELOGの「User/Auth非連鎖削除」が通常退職にも適用されるように読める点であり、誤登録物理削除だけの条件と明記し、通常退職の承認済みUser/Auth処理を維持する文へ修正した。遅延した旧triggerと同ID再作成も実装時の検証項目へ明示した。

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

2026-09-06、baseline `fafbe11a645d63114702977995ac1c2240b97767`から、退職後の通常編集禁止、在職者の保険履歴復元を含む3actor許可・現行遷移維持を仕様と[ADR 0059](../decisions/0059-employee-retired-edit-and-insurance-operation-boundary.md)へ反映した。物理削除延期は承認されておらず、利用者が定義を求めた[削除の5条件](../implementation/employee-master.md#employeeのarchive設計)を具体化した。未対処の同時参照追加と、他collectionを変更しない条件下での方式未確定を、全方式の不可能性から区別する。

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


### EMP-01共通archive・物理削除・住所座標の設計review（2026-09-06）

checkpoint: EMP-01-COMMON。baselineはprimaryの`427426b9ebd4097cda055f36d5dea7ebba2623b6`、branchは`codex/employee-master-roadmap`。利用者が依頼したEmployeeの方式変更と共通仕様整理を、このEmployee設計branchの範囲として扱った。製品code・Rules・package・実dataは変更せず、共通仕様と具体設計のreviewまでを対象とした。

成果は、現行仕様0.8.17の共通データ節、ADR 0060、Site専用archiveの実装照合、未提供purgeの設計案、Employeeの依存catalogと追加IDだけの存在確認、住所/座標の既存実装差である。Siteの物理削除・通常restoreは未提供と明記した。住所の失敗時保存を各masterへ再質問せず、固有の必須項目・用途と分けた。

所有文書は次の15件。新規はADR 0060だけで、他は既存の正本・索引・調査を更新した。

- `CHANGELOG.md`、`docs/README.md`、`docs/specification.md`
- `docs/decisions/0057-employee-hard-delete-and-archive-deferral.md`、`docs/decisions/0058-employee-full-read-and-geocoding-scope.md`、`docs/decisions/0060-common-archive-purge-and-address-contract.md`、`docs/decisions/README.md`
- `docs/implementation/address-geocoding.md`、`docs/implementation/archive-restore.md`、`docs/implementation/authorization-model.md`、`docs/implementation/employee-master.md`、`docs/implementation/future-actions.md`、`docs/implementation/pending-confirmations.md`
- `docs/roadmaps/airguard-v2.md`、`docs/roadmaps/employee.md`

独立調査はEMP-01-COMMON-ARCHIVE-SITE-READ / ARCHIVE-SECURITY / GEO-READ。最終差分はEMP-01-COMMON-DOC-REVIEWとDOC-SECURITYで確認した。一般reviewの共通purgeがUser/Auth直接削除と競合する指摘をmaster対象の明示で解消した。securityの既存予定/実績索引整合、archive文書全体のdelete、tenant/対象種別/操作IDを含む再送識別の3指摘を反映した。DOC-R1とDOC-SEC-R1はいずれも対象範囲の残存指摘なし、設計文書として報告可能とした。実装可能性の具体化と失敗経路のreviewであり、runtime成功や全writer網羅を保証するものではない。

次工程review判定: EMP-01全体は未完。通常保存/氏名/段階移行、archive exact snapshot・閲覧案・全writer/query、既存索引確認方法、工程配分の確定が残る。Billing検索field追加とbackfill、purgeの最小ID記録・保持・実行方式は具体案として区別した。アーカイブと通常CRUDはpurge運用の全決定を待たず先行できる。部分加点なしによりEMPは0%、EMP-02は開始しない。

検証classは権限・安全仕様の文書反映として`governance-permissions-agents`、comprehensive 5 gateを選択。実効schema/code/Rulesの実装差はなく、domain、Emulator、UI build、Dev/Prod generateは今回選択対象外。対応する実装工程で再選択する。remote・provider・実data・競合・既存索引の整合は未検証。初回project-docs-negativeは旧anchor3件・ADR status/索引書式でexit 1となり、修正後の再実行は全fixture期待結果一致、exit 0となった。

| gate | exact command | このcheckpointの結果 |
|---|---|---|
| managed-governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | exit 0。内包renderer-checkもexit 0 |
| project-docs-negative | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 修正後exit 0、全fixture期待結果一致 |
| capacity-regression | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks、exit 0。実session測定ではない |
| project-docs | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終記録を含む状態で実行し、独立exitをcommand reportへ記録 |
| diff-check | `git diff --check` | 最終記録を含む状態で実行し、独立exitをcommand reportへ記録 |

最初の3 gateは後続の仕様文面・review記録追記ではpolicyの失効対象に該当しない。review済みの所有15件だけをstageし、新ADRを含め`git diff --cached --check`を別に行う。最終結果、local commit、worktreeは利用者報告で示す。live remoteは未承認のため照合しない。

確認済み仕様、設計、判断、現在の計画、CONF/FUT、索引、CHANGELOGを同期した。共通仕様はspecification、未実装の保存shapeはimplementationの設計へ置き、別data契約を重複作成しない。既存製品の挙動・実行手順を変更しないためmanual/operations/runbook・他master固有文書は更新せず、共通実装差から参照する。旧仕様はADRの一部置換注記と時点付き履歴へ分離した。managed artifacts、governance/agent設定、既存製品進捗は変更しない。文書のrollbackは所有差分のcorrective commit、製品実装後の復旧はADR 0060の境界に従う。


### EMP-01保存・参照契約の具体化と最終提案review（2026-09-06）

checkpoint: EMP-01-FINAL-CONTRACT。開始baseline `b8fced9af5df4563182f35d5f4d3233883e6761e`、primary branch `codex/employee-master-roadmap`。利用者の作業再開に基づき、EMP-01内の残設計・review・文書保存を実施した。製品code、Rules、package、実dataは変更しない。

所有差分は`docs/implementation/employee-master.md`、`docs/implementation/pending-confirmations.md`、`docs/roadmaps/employee.md`の3文書だけ。通常保存のfield/競合/wire/raw期待値、archiveのexact envelopeとraw保持、12従属先（9 query・3 document取得。最終確定時に内訳の誤記を訂正）、必要なwriter、日次2種と請求の埋込み参照索引、段階移行・提供工程案を具体化した。原本readと保存の保護をEMP-02から揃え、EMP-05へarchiveと参照保護を組み込む案とした。得点・重み・確定済み仕様は変更しない。

EMP-01-FINAL-CONTRACT-PATHSとFINAL-REFERENCE-CONTRACTが現sourceを独立照合した。後者が勤怠・従業員別稼働もOperationResult全体を保存する不足を検出し、本人IDだけでなく埋込み全Employeeを検索する設計へ補正した。dataの不整合を実際に発見した報告ではなく、静的sourceで確認した検査範囲の不足である。

FINAL-DESIGN-REVIEWは、保険mapが喪失/復元後に元へ戻ると古い要求を識別できないP2を検出した。保険別の巻き戻さない世代値・局所期待値・同transaction増加・legacy不存在限定初期化・関連試験を追加し、FINAL-DESIGN-R1で解消した。FINAL-SEC-REVIEWはschema外の世代値とTimestamp精度を表示Classだけから取れないP2を指摘した。converterなしの同一原本snapshotから取得するmemory context、取得失敗時拒否、draft/期待値の同時再読込を明記し、FINAL-SEC-R1で解消した。両R1で最終提案を妨げる追加指摘なし。

次工程review判定: 利用者へ具体的な最終案を提示可能。操作表示/作成導線、archive閲覧、段階移行/物理削除の提供時期の採用回答が未了のため、EMP-01未完・得点0、EMP全体0%を維持する。EMP-02未開始。採用回答後に影響する確認済み仕様・ADR/CONF/FUT・roadmapを反映し、工程完了を報告する。実装開始指示とは区別する。

権限・安全・保存契約の設計案を含む文書変更として、影響不明時のcomprehensive fallback 5 gateを選択した。code/Rules/実効schemaの適用はなく、domain/Emulator/UI build/Dev・Prod generateは実装工程まで選択対象外。技術案の保険世代値や参照索引を実dataへ書いたり、packageへ導入した証拠ではない。

| gate | exact command | このcheckpointの結果 |
|---|---|---|
| managed-governance | `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | exit 0。内包renderer-checkもexit 0 |
| project-docs-negative | `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | 全fixture期待結果一致、exit 0 |
| capacity-regression | `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks、exit 0。実session容量測定ではない |
| project-docs | `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | 最終記録を含む状態で実行し、独立exitをcommand reportへ記録 |
| diff-check | `git diff --check` | 最終記録を含む状態で実行し、独立exitをcommand reportへ記録 |

最初の3 gateは後続の提案文面とreview証拠追記ではpolicy上失効しない。最終3文書をreview後にstageし、`git diff --cached --check`を別実行してlocal commitする。最終結果とworktreeは利用者報告に示す。runtime・競合・全writer接続・index実在/既存data件数/補正・provider・Dev/remoteは未検証である。

未採用提案の具体化なのでspecification/ADR/CHANGELOGは変更せず、既存の設計・CONF・roadmapを参照正本として揃えた。FUTは既存issueを維持し、採用される提供工程だけを後で反映する。新文書・索引・共通runbook・manualを増やさず、実装/運用の挙動は変更しない。governance/agent設定・managed artifactsも不変。文書rollbackは所有3差分のcorrective commitで可能で、実data復旧や旧広域writer再開を意味しない。


### EMP-01最終採用・完了記録（2026-09-06）

checkpoint: EMP-01-ADOPTION。baselineはprimary `C:\Users\seven\projects\AirGuard\air-guard-v2`、branch `codex/employee-master-roadmap`、`eb89e0a4ce9aeb9f1e4635153a1210009d23191e`。利用者の「提案を採用し、確定を承認する」により最終3点を採用した。通常保存/競合・raw期待値・保険別世代値・archive snapshot/従属/必要writerの具体設計も固定した。

- 表示名の明示値を姓名変更より優先し、作成は在職一覧のみ。既存の任意重複可code・独立表示名カナ・検索/在籍期間候補条件を維持する。
- archiveは通常原本と同じ7actorへ全項目get/listを許可し、直接client CUD/restoreを拒否する。通常候補へ混ぜず、archive管理一覧は追加しない。
- EMP-02で原本/archive readと直接CUD拒否を揃え、未移行editorはlocal read-only、EMP-03/04で再開。EMP-05に参照保護とarchiveを含め、purge実行は後続専用工程のFUT-0146へ分離する。保持・最小ID記録・自動実行等の具体運用を自動採用しない。

所有差分は次の8文書のみ。仕様は0.8.17から0.8.18へ更新し、CONF-0065をAnsweredとした。CONF-0061/0064/0123は保持・匿名化・運用等の未回答を残すため一括完了にしない。

- `CHANGELOG.md`
- `docs/specification.md`
- `docs/decisions/0060-common-archive-purge-and-address-contract.md`
- `docs/implementation/employee-master.md`
- `docs/implementation/pending-confirmations.md`
- `docs/implementation/future-actions.md`
- `docs/implementation/archive-restore.md`
- `docs/roadmaps/employee.md`

EMP-01-ADOPTION-REVIEWとEMP-01-ADOPTION-SECが同baselineと上記差分を独立照合した。securityのP2はFUT-0078の「通常退職の保持・非連鎖削除」がUser/Auth非削除とも読める表現だった。通常退職のEmployee/業務保持と既存UWBの本登録User/Auth削除・予約解放、誤登録archiveの非連鎖削除を分離し、EMP-01-ADOPTION-SEC-R1で解消した。設計reviewも追加指摘なし。EMP-01-ADOPTION-CLOSEOUTは完了状態・得点・次工程停止・記録整合を確認し、検証結果の時制を揃える軽微な指摘を反映した。前回従属内訳の8 query・4 document取得は誤記であり、表から9 query・3 document取得＝12対象と再計算して訂正し、両reviewで確認した。

次工程判定: **EMP-02へ渡す設計入力と受入条件は揃った**。利用者採用・契約/工程確定・独立review・文書検証によりEMP-01をCompleted、得点0→10、EMP進捗0%→10%とする。部分加点ではなく契約・対象確定工程の完了による10点であり、製品実装の達成率ではない。親製品roadmapの進捗へ合算しない。EMP-02は開始しておらず、利用者の開始指示を待つ。

検証classは文書/進捗と権限・安全仕様のunionでgovernance-permissions-agentsのcomprehensive 5 gateを選択した。以下は実行完了と独立exitを確認した結果であり、本完了記録の追記後にもproject-docsとdiff-checkを再実行して最終状態を確認する。

| gate / command | 実測結果 | exit |
|---|---|---:|
| `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2` | managed hashes/generated alignment・policy整合。renderer exit 0を含む | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-project-docs-check.ps1` | negative fixtureを含む全期待結果一致 | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/test-codex-session-size.ps1` | 合成fixture 7 checks成功。現在task容量の測定ではない | 0 |
| `powershell -ExecutionPolicy Bypass -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | Markdown 251、ADR 60、roadmap 11、TOML 8の整合 | 0 |
| `git diff --check` | 所有差分の空白検査成功 | 0 |

完了記録の初回検証では進捗行に括弧書きを加えたためproject-docsが`Roadmap progress missing`でexit 1となった。既存validatorの書式に合わせ進捗行を`10%`だけへ戻し、得点根拠は上記本文へ残した。次の検証では状態語`Complete`が既定の`Completed`と一致せずexit 1となったため、validatorと既存roadmapで確認した`Completed`へ訂正後の再検証でexit 0を確認した。最初の3 gateは後続の文言/進捗・review証拠追記ではpolicy上失効しない。review済み8文書だけをstageし、`git diff --cached --check`も別実行して意味のあるlocal commitへ統合する。commitと最終worktreeは利用者報告に示す。

未検証は製品runtime・Rules実行・参照競合・全writer接続・実data/索引・provider・Dev/remote。実効schema/アプリ/Rulesの変更はないためdomain、Emulator、UI build、Dev/Prod generateは今回の選択対象外で、対応実装工程で再選択する。設計上のdata fieldは仕様とEmployee設計契約へ反映し、実装調査の旧保存shapeを適用済みに変えない。新文書・移動・新ADRはなく、既存の文書索引・ADR索引・親roadmapは参照先を維持する。実際のUI/運用変更がないためmanual・operations・他master文書を変更しない。governance/agent設定・managed artifacts・package・実data・外部状態は不変。rollbackは所有文書のcorrective commitで行い、旧広域writerの再開やdata復元には広げない。


### EMP-02〜04連続実施の開始契約（2026-09-06）

実測証拠は[EMP-02〜04 local検証記録](../verification/employee-02-04-local.md)へ集約する。

開始baseline `9f4ec24d783f0c81fd89a056dc0ff4893f0f83a4`、primary branch `codex/employee-master-roadmap`。利用者がEMP-04までの一気通貫作業を明示承認した。上の各工程の対象・受入条件・重みを変えず、工程間の再承認待ちだけを解除する。EMP-05の参照writer/archive・EMP-06の統括退職actor/User shell全面整理・Dev/remote・実data・関連package変更は今回開始しない。既存UWBを維持するためのshell互換はEMP-02の必要範囲とする。

application writerはdeveloper一名、rootは文書・検証/専用UI・review統合・Gitを所有する。最初はEMP-02だけを割り当て、完了条件と次工程reviewを統合後に次baselineを渡す。通常の修正・失敗再検証を合意済み工程内で継続する。

EMP-02の許可3actor/閲覧7actor/拒否actor、ACTIVE/RESIGNED、same-ID作成、独立draft/取消/保存失敗/応答不明、局所raw期待値、別section保持、住所成功/失敗/無変更/古い応答を対象とする。EMP-03は警備解除/資格配列、EMP-04は3保険6操作/巻き戻さない世代値を追加する。合成dataとCodex専用demo/loopback/外部作用denyに限定し、現物dataと外部providerは使用しない。

各実装工程はUI・application・data contract/Rules・permissions・専用buildの該当unionを選び、project-docs、domain-full、local-emulator-suite、local-ui-build、diff-check、managed-governance、project-docs-negative、capacity-regressionを必要な失効範囲で実行する。UI-READY後にreview済みsourceを意味のあるlocal commitへまとめ、clean HEADの専用build/実UI/cleanupを検証してから当該工程を加点する。buildのためのsource commitを工程完了とは扱わない。Dev/Prod generateはrelease-onlyかつ未承認で対象外。rollbackでは影響操作を停止し、旧広域writer・PII readを再開しない。
