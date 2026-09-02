# STRIPE-05 Dev release verification receipt

- 状態: Verified / immutable execution evidence
- Evidence ID: STRIPE-05-DEV-RELEASE-001
- 実施日: 2026-09-02
- 対象環境: Dev
- release checkpoint: STRIPE-05-DEV-RELEASE-001
- acceptance checkpoint: STRIPE-06-DEV-USER-ACCEPTANCE-001
- release source commit: c3b29c59903928159f0d1c6f2ee3852b6ad7b46c
- 関連判断: [ADR 0038](../decisions/0038-legacy-stripe-scaffold-removal.md)
- 関連roadmap: [Company legacy Stripe情報削除](../roadmaps/company-stripe-removal.md)

## 承認済み境界

- Firebase projectはair-guard-v2-dev、Firestore databaseは(default)。
- Rules、Functions、Hostingの反映、Firestore全体snapshot、Company 4件を上限とする旧Stripe 2 field削除、post-check、画面確認を対象とした。
- Stripeは未使用で、外部からAirGuardへの更新経路がないため、maintenanceと外部Stripe確認を行わない。
- migration専用backup、旧fieldの自動復元、Prod、Git push、main mergeは対象外とした。

## 事前確認

- repository、branch、release source commit、clean、primary-only worktreeを確認した。
- Dev Firestore (default)はSTANDARD / FIRESTORE_NATIVE / asia-northeast1 / PITR保持604800sだった。
- credentialは設定有無、JSON形式、service account種別、project一致だけを確認し、path・内容を出力しなかった。
- release前のmigration dry-runはCompany 4件、旧field対象4件、StripeData 0件、finding 0件だった。
- dry-run plan digestは50a41204b047d0d6c778ac96440d94e861d91a53546b53477b5d0cb7f53d5f5dだった。

## Release結果

- Firestore Rulesはcompileとreleaseに成功した。
- Functionsは40件を更新し、deploy commandはexit 0だった。
- Hostingは同じDev生成物180 filesを反映し、deploy commandはexit 0だった。
- 配信されたindex、Service Worker、参照asset 26件はlocal生成物と一致した。
- indexとService Workerはno-store, must-revalidate, no-cache、version付きassetはimmutableだった。

## Firestore snapshot

- 承認済みのFirestore全体snapshotを一度だけ実行した。
- 初回commandはexport完了後のprogress出力とJSONが混在し、receipt parserがexit 7となった。snapshot自体を再実行せず、read-only照合へ切り替えた。
- 対象prefixのmetadata objectは1件、対応operationも1件で、done=trueかつerrorなしだった。
- snapshot output hash: 05c85a9cd4e3b9634b7965a4c7c7490dbfb93bb2a9e4003466e1fc7dee6efc8e
- metadata hash: 03ae9f9eb6b7029b4173ecba37bcff5bfd26ba37fba4bad545290597f6e76746
- operation hash: 9c9cf7f200599fdba03ce11d7b1335d799f545371d31778b136c0ff729863656

## Migration結果

- snapshot後のfresh dry-runでも計画digestと件数が一致した。
- applyは4 Companyをtransaction内で再確認し、stripeCustomerIdとsubscriptionだけを削除した。apply commandはexit 0だった。
- StripeData、Companyの他field、Company subcollectionは変更していない。
- 独立processのpost dry-runはexit 0で、Company 4件、旧field 0件、StripeData 0件、finding 0件だった。
- clean plan digestはbff67442558a561896e64960697db29c55b2956e350cfd0ea580d6d093d69ca1だった。

## Remote・画面確認

- 反映後60分のFunctions ERRORは0件だった。
- 会社管理者Chromeでdashboardと会社設定を読み込み、Stripe表示がないことを確認した。
- 廃止済み/settings/checkoutはdashboardへ戻った。
- 観測したChrome拡張由来のmessage-channel errorはapplication failureと分離した。
- 利用者はDev反映後の確認を問題なしとして受け入れた。

## 完了判定

STRIPE-01からSTRIPE-06までの契約、local実装・検証、利用者用Emulator migration、Dev release・migration、post-check、利用者acceptanceが完了した。完了時点の進捗と境界は[roadmap](../roadmaps/company-stripe-removal.md)を正本とする。

本receiptは上記実行のimmutable evidenceであり、後続の現在状態を表さない。後続状態は該当する現行仕様、roadmap、current handoffを参照する。
