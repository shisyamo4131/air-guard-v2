# Company部分更新ロードマップ

- 状態: Active
- 開始日: 2026-08-30
- 現在の進捗: 50%
- 部分加点: なし
- 完了条件: Companyの全whole-document writerをoperation別の変更field保存へ移し、schema validation、actor/field境界、real-time競合表示、local自動検証、必要なCodex in-app UI smoke、bounded Dev反映、利用者による実際の利用環境での最終UI acceptanceまで完了する
- 正本: [現行仕様](../specification.md#company設定とtenant-lifecycle)、[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)、[ADR 0033](../decisions/0033-company-bank-transfer-update-boundary.md)、[ADR 0035](../decisions/0035-company-display-order-update-boundary.md)、[ADR 0036](../decisions/0036-terminated-site-display-order-visibility.md)

## 境界

このroadmapはCompany documentを無条件に分割しない。`AirItemManager`・`AirArrayManager`をproject全体から一括削除せず、Companyの基本情報、振込先、通常設定、表示順を独立したoperationとして段階移行する。Company既定取極めはoperationへ移行せず、UI/writerを撤去する。

document共通validationはFireModel/Class schema、operation固有fieldと追加条件は共有operation contractを正本とする。画面は独立draftを編集し、保存前に最新Companyへ変更fieldを重ねて検証する。Firestoreへ保存するのは実際に変わったfieldと更新metadataだけとする。

単純な可逆更新はRulesで保存境界を完全に表現できる場合だけclient部分更新を選ぶ。複雑なvalidationや厳密なactor確認を要するoperationは専用Callableを使う。Dev deploy、remote検証、実data migrationは別のbounded承認を必要とする。

利用者承認済みcheckpoint内のapplication、Functions、Rules、自動test、必要なCodex in-app UI smokeはCodexが担当する。Codex UI smoke後もUIへ影響するoperationは利用者受入れ待ちとし、利用者が別途承認された実際の利用環境で最終UI acceptanceを完了するまでmilestoneを完了しない。file-by-file確認はcheckpointが明示した場合だけ要求する。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 完了証拠 |
|---|---:|---:|---|---|
| CPU-01 schema/editor境界の確定 | 10 | 10 | Completed | project rules、仕様、ADR、Company operation一覧、共通validationとdraft競合契約を確定する |
| CPU-02 Company基本情報の部分更新 | 20 | 20 | Completed | 専用editor/writer、管理者境界、変更fieldだけの保存、server timestamp、schema/operation validation、回帰testを完了する |
| CPU-03 振込先・通常設定の部分更新 | 20 | 0 | In progress | 2 operationの実装・自動test・Codex UI smokeは完了し、通常設定の利用者最終UI acceptanceも完了した。振込先の残る最終UI acceptance待ち |
| CPU-04 Company既定取極め撤去・表示順の部分更新 | 20 | 20 | Completed | Company既定取極めUI/writer撤去、`siteOrder`・`scheduleOrder`専用更新、Rules、競合UI、自動検証、利用者による項目1〜14・権限・二画面競合・終了済みSite表示の最終確認を完了した |
| CPU-05 旧Company writer除去・local受入れ | 15 | 0 | Not started | Company全体`set/update()` caller 0、Rules/Functions回帰、listener競合表示、主要画面再読込を確認する |
| CPU-06 bounded Dev反映・利用者受入れ | 15 | 0 | Not started | 承認済みreleaseでDevへ反映し、利用者受入れ、error確認、rollback確認を完了する |

重みは合計100。各マイルストーンは記載した証拠がすべて揃った場合だけ加点する。

## 現在の次工程

1. 利用者が実際の利用環境で、振込先の会社管理者表示、5項目登録、明示clear、競合時の再読込、請求書PDFの口座名義と長文配置を最終確認する。
2. Dev反映はCPU-05のlocal受入れと旧Company writer 0件を確認した後の別承認とする。

## 進捗履歴

| 日付 | 進捗 | 変更 | 根拠 |
|---|---:|---:|---|
| 2026-08-30 | 0% | 0 | AirItemManager/AirArrayManagerをFirestore CRUDの既定から外し、schema validationを維持したoperation固有editorへ段階移行する方針を利用者が採用した。実装・local受入れ・Dev反映は未完了。 |
| 2026-08-30 | 30% | +30 | project rules・仕様・ADRへeditor境界を反映し、Company基本情報10 fieldを独立draft、最新live値との合成validation、変更fieldだけのCallable保存、server timestamp・更新者、編集中変更通知へ移行した。会社管理者以外の編集controlを隠し、Rulesで同fieldのclient直接変更を拒否した。全domain 659件と隔離Emulator 99件が成功した。振込先以降、local UI、Dev反映は未完了。 |
| 2026-08-30 | 30% | 0 | 利用者local確認で権限と更新metadataは合格した。基本情報cardのtitle消失、dialog全体scroll、競合時の曖昧な上書きcontrolを修正し、Company基本情報は最新値の再読込だけを許可する契約へ更新した。全domain 659件は成功した。利用者による修正版UI再確認、振込先以降、Dev反映は未完了のため進捗は据え置いた。 |
| 2026-08-30 | 30% | 0 | 利用者が修正版をlocal環境で再確認し、基本情報cardのtitle、dialog本文だけのscroll、外部更新後の再読込専用UIを受け入れた。先に合格した権限・更新metadataと合わせてCPU-02のlocal受入れを完了した。振込先以降とDev反映は未完了のため進捗は据え置いた。 |
| 2026-08-30 | 30% | 0 | CPU-03の振込先について、同社User read維持、会社管理者専用Callable、5 field exact validation、client直接write拒否、再読込専用競合、明示clear、口座名義込み帳票をADR 0033で承認した。application・Rules・test・local受入れ・通常設定・Dev反映は未完了のため加点しない。 |
| 2026-08-30 | 30% | 0 | ADR 0034で、承認済みcheckpoint内のCodex実装・自動検証・必要なin-app UI smokeと、利用者による実際の利用環境での最終UI acceptanceを標準責任へ変更した。product実装・検証・受入れの新しい完了証拠はなく、CPU-03のCodex implementation checkpointはPM-12 activation後に開始するため進捗を据え置いた。 |
| 2026-08-30 | 30% | 0 | CPU-03の振込先を専用editor/Callableへ移し、会社管理者境界、5 field all-null/all-complete、changed-only保存、client直接write拒否、再読込専用競合、明示clear、口座名義込みPDFと長文headerを実装した。振込先・PDF対象17件、全domain 676件、専用Emulator 102件、Codex in-app UIの管理者保存反映が成功した。CPU-03は通常設定と利用者最終UI acceptanceが未完了のため加点しない。 |
| 2026-08-30 | 30% | 0 | 利用者確認で、基本情報・振込先の保存中も入力欄が操作でき、自分の保存結果を外部更新として一瞬表示する問題が見つかった。両editorへ入力・全操作ボタンの明示的な無効化、処理側の保存中再読込拒否、validation前single-flight、自己保存reflection識別、失敗時の真正競合復元を追加し、会社情報12件、振込先19件、全domain 688件が成功した。Codex専用UIは製品画面到達前のNuxt `ECONNRESET`で未確認、CPU-03の通常設定と利用者最終UI acceptanceも未完了のため進捗を据え置いた。 |
| 2026-08-30 | 30% | 0 | 利用者が実際の環境で、基本情報・振込先の保存中に入力欄と全操作buttonが使用不可になること、自分の保存結果では外部更新警告が一瞬表示されないこと、本当の外部更新では警告が維持されることを確認し、保存中制御補正を受け入れた。CPU-03の通常設定と振込先全体の残る最終確認、CPU-04以降、Dev反映は未完了のため進捗を据え置いた。 |
| 2026-08-30 | 30% | 0 | CPU-03の通常設定4 fieldを専用editor/Callableへ移し、会社管理者境界、changed-only保存、legacy勤怠値のcanonical検証、欠損時の非移行互換、client直接write拒否、保存中制御、再読込専用競合を実装した。対象19件、全domain 707件、専用Emulator 104件、Codex in-app UIの保存中全操作無効・反映・自己保存警告なし・復元・console error 0件が成功した。Company document分割、data migration、Dev反映は行っていない。CPU-03は利用者の実際の環境での最終UI acceptance待ちのため加点しない。 |
| 2026-08-30 | 30% | 0 | 利用者が実際の環境で、通常設定4項目の表示・1項目保存、保存中の全入力・操作無効、自己保存時の外部更新警告非表示、真正な外部更新時の再読込、非管理者・super-userの編集拒否を確認し、通常設定operationを受け入れた。CPU-03は振込先の残る利用者最終UI acceptance、CPU-04以降、Dev反映が未完了のため進捗を据え置いた。 |
| 2026-08-30 | 30% | 0 | CPU-04でCompany既定取極めUI/writerを撤去し、会社管理者またはfield別既知preset actorによる`siteOrder`・`scheduleOrder`専用Callable、client直接write拒否、独立draft、再読込専用競合、保存中制御、削除済みSite参照の除外を実装した。専用14件、全domain 721件、専用Emulator 106件、security review 4/5が成功した。Codex UI smokeは起動templateから製品画面へ遷移せず未完了で、利用者最終UI acceptanceも未完了のためCPU-04を加点しない。 |
| 2026-08-31 | 30% | 0 | 利用者確認は項目1〜10・13が合格し、一般利用者が稼働予定・配置管理へアクセスできないことも確認した。二画面確認は未保存変更のない画面が保存後の順へ追従したため正常であり、dirty競合は再確認を要する。終了済み現場でも突発予定が発生する業務に合わせ、既存Siteは状態にかかわらず表示順へ残し、missing/deletedだけを除外するよう補正した。専用15件、全domain 722件と一般review GOを確認した。残る利用者最終UI acceptanceまでCPU-04を加点しない。 |
| 2026-08-31 | 30% | 0 | 利用者はdirty競合を再確認して失敗と報告した。その後、利用者が開いていた同じ会社管理者Chrome 2画面をCodexが通常操作し、両方へ異なる未保存順を作成して片方だけ保存したところ、もう片方は未保存順を維持し、外部更新警告を表示して保存を無効化した。確認変更は元の順へ戻した。観測差が解消していないため利用者受入れ完了とはせず、CPU-04を加点しない。 |
| 2026-08-31 | 30% | 0 | 利用者は、未保存変更がない画面は他画面の保存結果を自動反映し、未保存変更がある画面だけが自身の順を維持して警告・保存無効となる区別を確認し、二画面競合を受け入れた。CPU-04は終了済みSite表示の最終確認が残るため加点しない。 |
| 2026-08-31 | 50% | +20 | 利用者が実際の利用環境で終了済み現場も並べ替えに表示されることを確認した。先に合格した項目1〜13、一般利用者の画面非表示、二画面競合と合わせてCPU-04の最終UI acceptanceを完了した。 |
