## Autocomplete（マスタデータ）

### 対象コレクション

- Customer（取引先）
- Site（現場）
- Employee（従業員）
- Outsourcer（外注先）
- Article（商品）

### 特記事項

#### SiteAutocomplete

- `Site` は `customer` 未設定での登録が可能。
- リスト表示では取引先名を併記しているが、未設定であるため `N/A` と出力される。
- `useFetchCustomer` コンポーザブルを利用しているが、**検索に失敗** したのか、**取引先が未設定** なのかを判断することができないため、`N/A` の出力を許容するものとする。
