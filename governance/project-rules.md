# AirGuardV2 Project Rules

- Status: Active
- Owner: AirGuardV2 project
- Common governance: `governance/common-governance.md`
- Rule: このファイルはAirGuardV2固有の要件を追加する。managed common governanceを弱めたり置き換えたりしない。

## Project and Current Scope

- AirGuardV2は警備会社向けのマルチテナント業務管理Webアプリケーションであり、現在は試験運用を行いながら開発している。
- application codeの標準実装者は利用者とする。Codexは設計、仕様整理、調査、検証、review、document管理、local Git管理を担当し、利用者の明示依頼がない限りapplication codeを編集しない。
- 原則として変更対象はこの`air-guard-v2` repositoryと、利用者が明示した依頼範囲だけとする。
- Codexの利用者向け応答は日本語で行う。
- 実装事実、利用者が承認した仕様、提案、未確認事項、履歴を区別する。

## Required Reading and Sources of Truth

1. 生成されたroot `AGENTS.md`を読む。
2. この`governance/project-rules.md`を読む。
3. `docs/README.md`から作業種別に必要な最小文書集合を選ぶ。
4. 関連コード、Firebase Rules、設定、テスト、運用証拠を照合する。

- 現在確認済みの仕様は`docs/specification.md`、進捗は`docs/roadmaps/**`、重要判断は`docs/decisions/**`、実行・復旧手順は`docs/operations.md`を正本とする。
- `docs/implementation/**`はコードから確認した実装事実、FUT、CONF、coverage、deep-review証拠であり、確認済み仕様の正本ではない。
- `DEFINITION.md`、`DESIGN.md`、`HISTORY.md`、`definitions/**`は参考・履歴として扱い、現行仕様またはAccepted ADRと競合する場合は正本にしない。
- 重要文書の追加、改名、移動、廃止時は、`docs/README.md`または該当indexと参照linkを同じ変更で更新する。

## Product and Domain Boundaries

- Authentication、custom claims、Firebase Rules、`companyId`によるtenant分離、個人・顧客・勤怠・請求data、Stripe、通知を高risk境界として扱う。
- frontend store、業務class、property/getter用語、関連packageの責務は`docs/specification.md`と関連ADRを参照する。
- `air-firebase-v2`、client/server adapter、`air-guard-v2-schemas`、`air-guard-v2-admin-sdk`は調査に必要な範囲で事前承認なく読取り可能だが、変更対象ではない。
- 関連repositoryを変更する場合は、対象、必要性、影響を受ける利用側、互換性、公開・導入順序、代替案を提示し、利用者の明示承認を得る。AirGuardV2側だけで安全に解決できるかを先に検討する。
- `air-vuetify-v3`はこのrepository内のfile参照packageである。変更時は利用箇所とpackage境界を確認する。

## Project-specific Roles and Workstreams

- primary taskをcoordinatorとし、別のcoordinator subagentは作らない。
- AirGuardV2の全Codex taskは、利用者がrepositoryとして管理する`C:\Users\seven\projects\AirGuard\air-guard-v2`へ直接接続する。Codex専用worktreeを作成・使用せず、task作成・交代・再起動後の変更なしcallbackでcwdとGit top-levelがこのpathそのものであることを確認する。不一致時はfile変更、Git mutation、process起動、外部作用を開始せず利用者へ報告する。
- base rolesは`developer`、`tester`、`code_explorer`、`docs_researcher`、`reviewer`とする。認証済み画面操作が必要な場合だけ`ui_tester`、security境界がある場合だけ`security_reviewer`を使う。
- roleごとの具体的な権限と報告契約は`.codex/agents/*.toml`を正とする。
- application codeの書込みは原則として利用者だけが行う。`developer`は利用者が範囲を明示した補助実装でのみ使用し、その場合のCodex側application code書込みを`developer`へ集中させる。
- Codex coordinatorは設計・仕様、脅威と失敗経路の整理、差分review、検証計画・結果、document、roadmap、ADR、local branch・stage・commitを管理する。利用者の未コミットapplication codeを独自判断で修正、破棄、stage、commitしない。
- `tester`は利用者またはcoordinatorが明示的に委譲したtest fileを編集できる。explorer、researcher、reviewer、UI tester、security reviewerはread-onlyとする。
- 専門taskは原則stage・commitせず、checkpoint ID、正確な変更file、diff、test、未確認事項、承認境界、worktree状態をcoordinatorへ返す。coordinatorが受入れたfileだけをcommit・統合する。

## Project-specific Approval and Safety Boundaries

- 質問、比較、検討、診断、途中確認、完了報告を、code変更、仕様変更、merge、push、deployの承認とみなさない。
- 重要な仕様変更前に、現行仕様、変更案、理由、利用者・data・互換性・移行・運用への影響、rollback、確認方法を提示し、利用者の明示承認を得る。
- 実装・修正・改修は作業単位ごとに利用者とbranch境界を確認し、原則として機能単位の`codex/<feature>` branchで行う。Codexは合意済み作業単位のlocal branch作成・切替、review済みfileのstage・commitを担当できる。利用者のapplication codeをcommit対象に含める場合は、対象差分と検証状態を利用者と確認する。
- 利用者が機能branch上の動作を確認して明示承認するまで`main`へmergeしない。
- `main`への直接commit、`main`へのmerge、Git push、history rewrite、Prod deploy、npm公開、実dataの作成・更新・削除、data migration、外部service変更はそれぞれ別の明示指示を必要とする。
- Devは利用者の会社と協力会社が利用する非本番の試行環境であり、正式運用準備または正式運用開始の完了判定をDev deployの前提にしない。利用者が対象commit、Firebase service、data影響、backup、rollback、停止条件、検証を含む一つのbounded Dev release checkpointを明示承認した場合、そのrunbook内の静的生成、deploy、remote検証をcommandごとに再承認せず実行できる。対象service・data・期間の拡張、新しいdata migration、破壊的repair、Prodへの適用は別の明示指示を必要とする。
- `.env`値、秘密鍵、access token、Firebase Admin資格情報、Stripe secret、Webhook secret、本番の個人・顧客・勤怠・請求dataをrepository文書、prompt、log、応答へ転記しない。
- 破壊的操作前に対象環境、対象data、復旧方法を確認する。

## Project-specific Implementation and Verification

- PowerShellとUTF-8を標準とし、既存の設計、命名、責務分割を確認してから変更する。
- repository文書に必須引数を含む正規commandが記録されている場合は、そのcommandを省略・短縮せず正確に使用する。managed governance validatorは`powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1 -ProjectPath C:\Users\seven\projects\AirGuard\air-guard-v2`を正規commandとし、scriptのdefault project pathへ依存しない。
- `npm audit fix`と`npm audit fix --force`を無条件に実行しない。lockfile、互換性、破壊的変更、root/functions双方への影響を先に確認する。
- Codexは未承認の静的生成・buildを実行しない。利用者が承認したbounded Dev release checkpointでは、記録済みのexact commandによるDev用静的生成・buildを実行し、生成結果を同checkpointのdeploy証拠にできる。Prod build、対象外artifact、別releaseへの再利用は承認を拡張せず、deploy・package更新を含む正確なcommandと復旧手順は`docs/operations.md`を参照する。
- 利用者用local serverは`.env.local`、Codex専用local UI環境は専用設定を使い、いずれもloopbackへ限定する。LAN公開は実行ごとの利用者承認を必要とする。
- CodexはADR 0014と`docs/operations.md`の隔離条件を満たす専用demo projectについて、追加承認なしにEmulator、Functions、local server、Codex管理processを起動・停止し、合成Authentication accountと合成dataを作成・更新・削除してよい。`.codex-test/saved-data`、`.codex-test/ui-candidate`、`.codex-test/isolated-saved-data`、専用runtimeまたは通常のCodex専用test sessionにある合成dataの作成・変更・削除、予約migration、candidate acceptance・promotionは、操作ごとの利用者承認を必要としない。上位のCodexまたはBrowser安全policyがaction-time confirmationを要求する場合は、その確認を省略しない。利用者用local環境、Dev、Prod、remote service、実dataへこの許可を拡張しない。
- Codex専用環境の起動前にproject、bind先、未起動serviceからのremote到達、外部API・Stripe・mail・FCM等への作用を確認し、fail-closedで隔離できなければ実行しない。利用者用Emulatorは従来どおり対象実行ごとの明示許可を必要とする。
- Windows上でFirebase CLIを使うCodex専用Emulator suiteは、Firebase CLIがWindows user configstoreへアクセスする既知の必要性があるため、既存のCodex専用demo data承認境界の範囲で最初からworkspace sandbox外の承認済みprocessとして実行する。sandbox内での予備失敗を必須手順にしない。この例外はdemo project、loopback、合成data、外部作用denyに限定し、network、利用者用local環境、Dev、Prod、remote service、実dataの許可を拡張しない。
- 利用者用Emulatorは`--import=./saved-data`を使い、明示指示なしに`--export-on-exit`または同等操作で`saved-data`を上書きしない。Codex専用環境は`.codex-test`配下の専用saved-data、candidate、isolated fixture、runtimeだけを使い、利用者用`./saved-data`を読込・変更しない。
- Codex専用local UI検証は、Codexが専用Emulator、Functions、local server、合成account/data、Codexインアプリブラウザを準備して完結させる標準経路とする。利用者のChrome起動・sign-inを通常の前提にしない。初回navigation前にEmulatorの`All emulators ready`、Nuxtの`Vite client warmed up`、loopback HTTP応答、初回module graphの2回のbounded probe成功を確認する。起動templateまたはHTTP 200だけを成功証拠にせず、予熱後の初回navigationで製品landmarkへ到達できなければ失敗として停止・診断する。
- Codex専用Auth credentialは、loopbackのdemo projectにある実在情報を含まない合成accountだけへ使用する。保存済みbrowser sessionを優先し、session喪失時はrunning Auth Emulator内だけの一時random passwordを利用できるが、saved-data、repository、terminal、応答、screenshot、DOM・console・network観測へ値を残さない。password入力controlを通常typingできない場合に限り、製品の可視な表示切替control、通常keyboard入力、即時再maskを使用できる。平文表示中はread-only観測も停止し、Emulator終了で一時credentialを失効させ、saved-data指紋不変を確認する。利用者用local、Dev、Prod、remote service、実accountまたは永続credentialへこの例外を拡張しない。
- CodexがブラウザUIの挙動または受入れ証拠を取得する場合は、可視画面上で実利用者が行える通常のpointer・keyboard操作だけを使用する。可視・有効で通常のactionability条件を満たすcontrolへのclick、一文字ずつのtyping、通常のkey操作、scroll、drag、可視optionの選択は許可する。`fill`・`clear`、DOM property・valueの直接変更、event・handler・component method・`requestSubmit`・client APIの直接呼出し、force操作、disabled・hidden・overlayの回避は禁止する。`localStorage`、`sessionStorage`、IndexedDB、cookie、Firebase Auth persistenceを直接変更して挙動・受入れ状態を作ってはならない。初期URL open、reload、clean browser context準備は非UIの環境準備に限り、画面内navigationや製品flowの証拠には数えない。read-onlyのDOM・ARIA・screenshot・console・network観測は許可するが、状態を変更してはならない。Emulator OOB確認、backend verifier、export・importは非UIの準備またはassertionとしてUI操作証拠と分離する。
- 数百件規模の合成documentを扱う場合は段階的に投入し、応答遅延、memory、Emulator logを監視する。約1000件でEmulatorが停止した利用者経験をlocal riskとして扱い、同規模の一括投入は停止条件と復旧方法を定めた別の明示承認なしに行わない。これはFirebaseの公式上限とは扱わない。
- Dev deployとremote検証は、承認済みbounded Dev release checkpointの対象・期間・runbook内で積極的に行える。正式運用準備の未完了だけを理由にDev環境証拠の取得を延期しない。実data migration、破壊的repair、checkpoint外のdata変更、Prod deployは対象操作ごとの明示承認なしに行わない。
- 実施していない確認を成功と記載しない。技術的に実施できない場合は、確認済み範囲、未確認範囲、利用者の確認観点を報告する。
- 認証・認可・tenant分離の既知Critical問題を最優先とし、既存構造を一括置換せず、利用者が仕様と影響を理解できる最小segmentへ分ける。各segmentは現行挙動、攻撃・失敗経路、変更契約、互換性、rollback、陰性testを先に整理し、利用者の実装後にCodexが差分reviewと許可済み検証を行う。
- local Emulator環境はtest用1社だけを扱う。Dev環境は利用者の会社と協力会社の2社が試用するremote環境であり、正式運用前の変更を実際の利用条件で積極的にdeploy・検証する。ただし実dataと実accountを含むため、承認済みbounded Dev release checkpoint外の接続・変更、未計画のdata操作、秘密情報の観測を行わず、一般公開していないことをsecurity controlの代替とはみなさない。
- project-owned document validatorとmanaged governance validatorの両方を実行し、application testの実施有無と区別して報告する。

## Project-specific Progress and Reporting

- 正式運用準備の公式進捗は`docs/roadmaps/airguard-v2.md`だけを正とし、100点加重・milestone単位の無部分加点で管理する。
- scope追加または判定訂正で進捗が低下する場合は、変更前、変更後、理由、証拠をroadmapと利用者向け報告へ記録する。
- 未回答の確認・承認事項は直ちに報告し、回答後に正本と次taskの指示へ反映する。
- 完了報告では、変更した挙動とfile、仕様・ADR・roadmap・manual・operationsの整合、実行した検証、未検証事項、残存risk、設定・移行、利用者の次の操作を示す。

## Project-specific Task Lifecycle

- 長期作業はreview可能なcheckpointを1件ずつ割り当て、完了・失敗・仕様質問・承認境界で一度だけcallbackし、coordinatorのreview後に次へ進む。
- callback失敗時は繰り返し送信せず、完全な結果を当該taskへ残して停止する。coordinatorはstateを安全に1回だけ再取得し、照合不能なら同じ割当を再送しない。
- 標準の作業session終了条件は「安全に独立実行できる作業が尽きた時点」とする。
- `容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認`は、model token/context windowではなく現在taskの永続session JSONL容量を実測する指示として扱う。`docs/README.md`から`docs/runbooks/project-coordination.md`へrouteし、現在task IDを明示したproject-local scriptを使う。最新・最終更新sessionを推測しない。
- coordinatorと専門taskのsession handoff閾値は300 MiB、Codex全体の参考警告値は10 GiBとする。task ID不明、session一致0件・複数件、script失敗、全体scan不完全時は推測せず該当判断を停止する。task閾値未到達時に経過時間やtoken/context推測から交代を提案しない。閾値到達時は新規割当を止め、基準commit、進捗、checkpoint、未統合作業、test、承認事項、次の指示をrepositoryへ記録する。
- coordinator交代は利用者の明示承認を必要とする。新taskはforkせず連番名で作成し、repositoryからの再開、権限、callback経路、最初のfile限定commitを検証し、archive可能な状態を利用者へ報告する。
- taskのarchiveは利用者だけが行う。Codexは旧taskのarchiveを実行・依頼せず、新taskの直接repository接続、変更なしcallback、権限、最初のfile限定commitの検証完了を利用者へ報告して待機する。利用者がarchiveを完了するまで、旧新taskに重複した作業を割り当てない。
- common governance、生成`AGENTS.md`、project-wide permissions、approval policy、coordinator責務、delegation/Git統合、callback/handoff、安全境界を変更した場合はinstruction-chain変更としてaffected taskを交代する。
- 2026-08-11のmanaged governance再構築に伴うtask交代は履歴上完了済みとする。今後はinstruction-chain変更が生じた場合だけ、利用者が承認した手順に従ってaffected taskを交代し、交代完了までは新規application作業を開始しない。
