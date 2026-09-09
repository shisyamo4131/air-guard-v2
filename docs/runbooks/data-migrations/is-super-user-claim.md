# `isSuperUser` claimの正規化

- 状態: Confirmed / related repository
- 役割: 関連repository `air-guard-v2-admin-sdk`にあるclaim正規化commandの実行手順
- 所有境界: この文書はAirGuardV2からの実行案内だけを扱い、関連repositoryの実装を変更しない。


関連repository `air-guard-v2-admin-sdk`の`migration is-super-user-claim`は、所属済みAuthentication User、Company、同一UIDの本登録Userが整合する場合だけ、未設定の`isSuperUser`を`false`へ正規化します。既定はdry-runで、不正claim、identity不整合、読取errorがある場合はapply前に停止します。Emulatorまたは明示的なDev環境だけを許可し、Prod環境では拒否します。

```powershell
# Emulator: dry-run -> apply -> dry-run
npm run cli:emulator -- migration is-super-user-claim
npm run cli:emulator -- migration is-super-user-claim apply
npm run cli:emulator -- migration is-super-user-claim

# Dev: 個別のremote data操作承認後だけ、同じ順序で実行
npm run cli:dev -- migration is-super-user-claim
npm run cli:dev -- migration is-super-user-claim apply
npm run cli:dev -- migration is-super-user-claim
```

実行前に対象環境、復旧可能性、件数だけを出力することを確認します。dry-runの`invalidIdentity`、`invalidClaim`、`errors`がすべて0の場合だけapplyへ進み、apply後のdry-runで`eligibleMissing`が0であることを確認します。
