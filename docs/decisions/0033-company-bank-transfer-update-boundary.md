# 0033 Company振込先の専用更新・読取境界

- 日付: 2026-08-30
- 状態: Accepted
- 一部置換: 2026-09-09の[ADR 0064](0064-sensitive-firestore-document-boundaries.md)により、Company振込先をCompany rootへ保持する判断と、本体と同じread境界を無条件に維持する判断を置換した。field validation、専用Callable、更新actor、super-user拒否、client直接write拒否、競合・帳票境界は、分割設計で個別に見直すまで維持する。
- 関連する新原則: 2026-09-09の[ADR 0066](0066-pre-production-document-level-last-write-wins.md)は通常更新をdocument単位last-write-winsへ変更した。振込先は機微・機密情報であり、分割・actor・writerをFGA checkpointで確定するまで、本ADRの専用Callable、相関validation、競合制御を安全側の例外境界として維持する。
- 関連仕様: `docs/specification.md`の「Company設定とtenant lifecycle」
- 関連判断: [ADR 0017](0017-callable-auth-identity-gate.md)、[ADR 0031](0031-proportional-data-boundary-and-change-safeguards.md)
- 関連ロードマップ: [Company部分更新](../roadmaps/company-partial-updates.md)
- 一部置換: 2026-09-06の[ADR 0056](0056-employee-role-and-archive-boundary.md)により通常業務の振込先更新actorへ統括を追加した。以下の会社管理者限定は当初判断の履歴であり、専用Callable、field、identity、super-user拒否等の条件は維持する。製品実装への反映は後続整合対象である。

## 背景

現行のCompany振込先は`bankName`、`branchName`、`accountType`、`accountNumber`、`accountHolder`の5 fieldを`AirItemManager`で編集し、Company clone全体をFirestore rootへ`set()`する。同社の有効な本登録Userなら会社管理者でなくてもRules上この5 fieldを直接変更でき、変更値はlive Companyを参照する請求PDFへ到達する。別actorやserverが更新したCompany field、Stripe・maintenance等の同居field、hydrate対象外の未知fieldを古いcloneで上書きまたは消失させるriskもある。

現行legacy schemaは口座fieldを個別optionalとして扱い、銀行名・支店名・口座名義の上限が確認済み仕様より短く、5 fieldのall-null/all-complete相関を強制しない。`accountType=普通`だけが既定値として残る空口座もある。編集中のlistener更新はdraftを黙って置換し、帳票は口座名義を印字しない。

## 決定

- 振込先はCompany rootに保持する。同社の有効な本登録UserがCompany rootと振込先を読める現行境界を維持し、この変更だけを理由に別documentまたはserver projectionへ分割しない。
- 振込先を変更できるactorは、検証済みidentityとcurrent Authが一致し、同じtenantのUserが存在して`isTemporary=false`、`disabled=false`、`isAdmin=true`である本登録会社管理者だけとする。`isSuperUser=true`のidentityは拒否する。
- 専用`updateCompanyBilling` Callableを使用する。requestからcompany IDやdocument pathを受け取らず、identityのcompany IDとUIDからactor・Company pathを導出し、同一transactionでactor Userと最新Companyを読む。
- inputはexact `{changes}`のnon-empty plain recordとし、変更keyを振込先5 fieldのsubsetだけに限定する。`invoiceNumber`、profile、通常設定、取極め、表示順、Stripe、maintenance、`uid/updatedAt`、unknown fieldを受け付けない。
- 最新Companyへchangesを重ね、現行`invoiceNumber`をserver側validation contextとして共有billing parserで検証する。`invoiceNumber`はCompany基本情報operationの所有を維持し、振込先operationでは永続化しない。
- 振込先は5 fieldすべてnull、または5 fieldすべてcompleteのどちらかだけを許可する。銀行名・支店名はtrim後各100 grapheme以内、口座種別は普通・当座、口座番号は先頭0を保持したASCII数字1〜7桁、口座名義はtrim後200 grapheme以内とし、CR/LF・control characterを拒否する。
- 画面は独立draftを使い、明示的なクリア操作で5 fieldすべてをnullへ戻せる。legacyの他4 fieldが空で`accountType=普通`だけの状態は未登録として表示し、openまたはno-op saveでdataを変更しない。その他のpartial legacy値はcompleteへの修復または全null化だけを許可する。
- 編集中に振込先5 fieldの外部変更を検出した場合は保存を停止し、「最新値を読み直す」だけを提供する。現在draftを破棄して再入力させ、共通revision、expected value、lock、ledgerは導入しない。
- Firestoreへは実際に変化した振込先fieldとserver timestampの`updatedAt`、identity UIDの`uid`だけを`transaction.update()`する。Company全体set、Company instance spread、client metadataを使わない。no-opはwrite 0とする。
- Rulesは振込先5 fieldのclient直接変更を会社管理者・super-userを含む全actorへ拒否する。振込先と他fieldを同時に変更するclient requestも全体拒否し、Company基本情報の既存保護と未移行operationの無関係field互換を維持する。
- 完全な振込先だけを、口座名義を含めて請求PDFへ印字する。不完全・不正な振込先は印字せず、長い口座名義等をrender testで確認する。請求確定時issuer snapshotは後続Billing改修の責務とする。
- request payload、Company snapshot、振込先5 fieldの値を個別・集合のいずれでもlogへ出さない。public errorは定型code/message、success responseは`success`、`updated`、`updatedFields`だけとする。既存rootの`uid/updatedAt`は未移行clientが変更できるため、このcheckpointだけでsecurity-grade auditとは扱わない。

## 理由

振込先は請求書の支払先へ到達するため、同社の任意Userによる直接変更を許容できない。一方、読取actorは現在のCompany rootと同じであり、保存期間・削除・query・size・実測競合にも別documentを必要とする根拠がない。Company rootを維持しつつ、厳密なactor再検証、相関validation、exact field updateを一つのoperationへ限定することが最小の安全対策である。

外部変更時の再読込必須は、5 fieldの相関を保ち、どの口座が保存されたかを利用者に明確にする。revision等を全Companyへ広げず、通常編集として局所的に扱う。

## 代替案

- client部分更新とRulesだけで会社管理者・field・相関を検査する案: grapheme、legacy partial repair、current Auth/actor再照合、機密log境界をRulesへ集約するより専用Callableの方が責務を限定できるため採用しない。
- 振込先を会社管理者だけが読める別documentへ移す案: 利用者は現行の同社User readを維持する判断を採用したため、このcheckpointでは分割しない。read actorを狭める要件が生じた場合だけ再検討する。
- 明示再確認後のlast-write-winsを許可する案: completeな5 fieldの組を別actorの更新後に古いdraftで置換する誤認riskがあるため採用しない。
- `invoiceNumber`も振込先operationへ移す案: 現在のCompany基本情報editor・Callableとのownership重複を生むため採用しない。

## 影響

- 利用者: 会社管理者だけが振込先を編集できる。super-userと非管理者はCompany設定pageの既存閲覧境界が残っても編集control・server保存を利用できない。全項目クリアと外部変更後の再読込が明示される。
- application: 旧Bank activator＋CompanyManagerを専用editor/application composableへ置換し、既存profile writerの責務分割を再利用する。通常設定、取極め、表示順の旧writerは後続checkpointまで残る。
- Functions・Rules: 新Callableとexact field reservationを追加する。旧clientの振込先直接writeはRules反映後に拒否されるため、Client/Functions/Rulesを同じbounded Dev releaseで整合させる。
- data: local設計・実装ではmigrationしない。legacy default-onlyは表示時に未登録へ正規化するがno-opでは書き戻さない。Devのpartial bank分布はremote変更前のbounded read-only preflightで確認する。
- progress: CPU-03は振込先と通常設定の両operation、local検証、受入れが揃うまで得点しない。契約承認だけでは30%から加点しない。

## 移行とrollback

利用者実装は専用schema/editor/composable/Callable、Rules reservation、domain・Emulator・render testを一つのlocal checkpointとして行う。Company profile、通常設定、取極め、表示順、Stripe、maintenance、関連package、Dev dataを同時変更しない。local実装に問題があればreview済みcommitを安全にrevertし、history rewriteを行わない。

Dev反映は対象commit、Client/Functions/Rules、Company件数、bank shapeのmasked集計、backup、rollback release、停止条件、post-check、利用者受入れを固定した別の明示承認を必要とする。Rulesだけを戻して低権限Userの直接writeを再開することを安全なrollbackとみなさない。data repairが必要な場合は対象とbefore/afterを固定した別migrationとする。

## 検証

- domain: exact payload、全partial組合せ、全null、complete、legacy default-only、repair、leading zero、trim、grapheme、control、enum、no-op、changed-only、metadata、overposting、log/response非露出。最新Companyの`invoiceNumber`がvalid・prefix付き・invalidの各contextを検証し、振込先更新が`invoiceNumber`を永続化せず、invalid contextではwrite 0となることを確認する。
- identity/tenant: company ID・document path注入、`companyId/isSuperUser/email_verified` claimの欠損・型不正、tokenとcurrent AuthのUID・email・company・super-user不一致、current Auth不存在・disabled、actor User不存在・company不一致・temporary・disabled・非管理者・super-userを拒否し、検証済みidentityのtenantだけを更新する。
- Firestore Rules/Emulator write: 5 field各々の追加・変更・`deleteField()`、whole-document replacementによるfield欠落、振込先と他fieldの複合client writeを会社管理者・非管理者・super-user・temporary・disabled・未認証・他tenantで拒否する。Company profile拒否、未移行無関係field互換、root create/delete拒否を回帰する。
- Firestore Rules/Emulator read: 振込先5 fieldを含むCompany rootについて、同社の有効な本登録Userをadmin・role・super-user flagにかかわらず現行境界どおり許可し、temporary・disabled・未認証・他tenantを拒否する。
- integration: public export、共通Auth identity gate、Callable transaction、Company他field不変、server metadata、full domain・隔離Emulator回帰。
- UI/PDF: 独立draft、再読込専用競合、明示clear、権限control、完全bankだけの口座名義込み印字、長値layout、利用者local受入れ。
- document: project documentation validator、managed governance validator、renderer `-Check`、diff check。

## 再検討条件

振込先の読取を会社管理者または請求担当へ限定する要件が確定した場合、Company rootのread actorが狭まる場合、複数client versionをDev/Prodで併存させる場合、issuer snapshotが実装されて振込先変更の発効・訂正・履歴要件が変わる場合、または再読込だけで防げない具体的な競合事故が確認された場合。
