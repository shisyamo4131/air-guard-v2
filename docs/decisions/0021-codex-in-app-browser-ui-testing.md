# 0021 Codexインアプリブラウザによるlocal UI検証

- 日付: 2026-08-25
- 状態: Accepted
- 関連仕様: 現段階のlocal UI検証条件
- 関連判断: [0006](0006-user-prepared-authenticated-browser-testing.md)、[0014](0014-codex-dedicated-local-test-data.md)

## 背景

Codex専用EmulatorとNuxt開発サーバーはloopbackで起動できても、Nuxt/Viteの初回module変換が終わる前にブラウザを開くと、HTTP 200のまま「AirGuardを起動しています・・・」からhydrationしないことがあった。利用者のChromeを標準前提にすると、起動、接続、sign-inを人へ戻す必要があり、繰り返す権限別UI検証の再現性と効率を下げる。

2026-08-25に、Emulator ready、Nuxtの`Vite client warmed up`、loopback HTTP、初回module graphの2巡probeを待ってからCodexインアプリブラウザを初めて開く手順を試し、cold restart 3回すべてでreloadなしに製品topへ到達した。保存済み合成accountによるsign-inから`/dashboard`到達も確認した。

## 決定

- Codex専用local UI testは、Codexが専用Emulator、Functions、Nuxt前景process、合成data、インアプリブラウザを管理する経路を標準とする。利用者のChrome起動またはsign-inを通常の前提にしない。
- 初回browser navigationより前に`All emulators ready`、`Vite client warmed up`、loopback root、現在の初回Vite/Nuxt module graphを2巡probeし、全requestがbounded time内にHTTP 200で完了したことを確認する。module件数はsourceから発見した実数を記録し、固定値へしない。
- 起動templateまたはHTTP 200だけを成功としない。予熱後の初回navigationで製品landmarkへ到達しない場合は通常reloadで成功扱いせず、停止してserver readiness、module request、console、既知の起動blocking要因を診断する。
- 保存済みbrowser sessionを優先する。session喪失時は専用loopback Auth Emulator内の合成accountだけへ一時random passwordを設定できる。saved-dataを変更せず、Emulator停止によって失効させる。
- secure password controlを通常typingできない場合だけ、製品の可視な表示切替control、通常の一文字ずつのkeyboard入力、即時再maskを使用する。平文中はscreenshot、DOM、console、network観測を停止し、値をrepository、terminal、prompt、応答、logへ残さない。
- 利用者準備済みChromeは、利用者sessionを使う受入れまたはインアプリブラウザ障害時の補助経路として維持する。ユーザーが起動したprocessとChromeはCodexが停止しない。

## 理由

製品codeやbrowser securityを弱めず、利用者の手動準備に依存しない再現可能なlocal UI検証ができる。起動完了条件をHTTP 200から実際のVite warm-upと製品landmarkへ引き上げることで、起動中画面を接続成功と誤判定せず、失敗時の調査範囲も限定できる。

## 代替案

- 利用者Chromeだけを標準にする案: 安全な補助経路ではあるが、繰り返し検証の準備を利用者へ戻すため標準にはしない。
- 起動templateで一度reloadする案: cold-startの不安定性を隠し、初回navigationの回帰を検出できないため標準手順から外す。
- 毎回専用buildを作る案: buildは実行ごとの明示承認が必要で時間も大きいため、dev経路の診断用fallbackに限る。
- credentialをrepositoryまたはsaved-dataへ平文保存する案: 漏えい・再利用riskがあるため採用しない。

## 影響

- 利用者: 通常のCodex専用UI testではChrome起動と事前sign-inが不要になる。監視を希望する場合はCodex Desktop内の同じbrowser tabを確認する。
- data/security: 対象はdemo project、loopback、合成account/data、外部作用denyだけである。実data、利用者用local、Dev、Prod、remote serviceへ一時credential手順を拡張しない。実行前後にsaved-data指紋不変を確認する。
- 実装: application code、test code、dependency、package metadataは変更しない。起動blocking要因FUT-0005・FUT-0008・FUT-0096・FUT-0178は将来改修として残る。
- test: cold restart、module probe、製品landmark、sign-in、dashboard、console、process終了、port閉鎖、saved-data不変を個別証拠として記録する。
- 運用: Firebase EmulatorとNuxtは既存の承認済みsandbox外前景processとして起動し、Codexが起動したprocessだけを終了する。

## 互換性・移行

既存のChrome受入れ、Codex専用saved-data、UI操作契約、外部作用denyを維持する。運用文書とproject rulesを更新し、instruction-chain変更として全active taskを完全新規taskへ交代する。環境・data migrationはない。

## Rollback

この文書変更commitを通常のrevert commitで戻し、ADR 0006の利用者準備済みChromeを標準経路へ戻す。hard reset、history rewrite、saved-data置換は行わない。

## 再検討条件

- Nuxt/Vite更新後に2巡のmodule probeでも初回navigationが安定しない。
- Browser pluginがsecure credential入力またはvisibilityの異なる安全な標準機能を提供する。
- 起動blocking要因のapplication修正により、module予熱が不要になったことを複数cold restartで確認する。
- demo以外の環境、実端末、remote受入れを対象にする必要が生じる。
