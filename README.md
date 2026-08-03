# Portfolio API

`kokage-studio.com` の公開コンテンツとCMSを支える Cloudflare Workers APIです。Hono、D1、R2を使用します。公開APIは公開済みデータだけを返し、`/api/v1/admin/*` はCloudflare Access JWTを署名・issuer・audience・有効期限まで検証します。

## ローカル開発

Node.js 22.12以上を使用します。

```sh
npm ci
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply portfolio --local
npm run dev
```

ローカルでだけ `DEV_AUTH_BYPASS=true` が有効です。ホストが `localhost` または `127.0.0.1` でない要求には適用されません。本番では必ず `false` にします。

## Cloudflareの準備

1. `wrangler d1 create portfolio` と `wrangler r2 bucket create portfolio-images` を実行します。
2. D1 `portfolio` のIDが `wrangler.jsonc` の `DB` bindingに設定されていることを確認します。
3. Zero TrustでGoogleをIdPにし、`kokage-studio.com/admin/*` とAPIの `/api/v1/admin/*` を同じAccess Applicationで保護します。
4. Access Application AUDを `ACCESS_AUD`、チームドメイン（例: `team.cloudflareaccess.com`）を `ACCESS_TEAM_DOMAIN` に設定します。
5. `ALLOWED_ORIGINS=https://kokage-studio.com` とし、`api.kokage-studio.com` のcustom domainを有効化します。
6. `npx wrangler d1 migrations apply portfolio --remote` 後にデプロイします。migration 0002が既存公開内容を初期投入します。

JWTを転送できない構成では、AccessをAPI custom domainにも直接適用してください。CMSのブラウザ要求にAccess cookieと `Cf-Access-Jwt-Assertion` が付与される構成をステージングで確認します。

## セキュリティと障害対応

- SQL値はすべてD1 bindを使用し、slugは許可文字だけに制限します。
- URLはHTTP(S)のみ、本文はフロントで許可リスト方式にsanitizeします。
- 画像は5MiB以下のJPEG/PNG/GIFに限定し、宣言MIMEとmagic bytesを照合します。R2 keyはUUIDです。
- 更新はversionによる楽観ロックです。409時は再読み込みして競合内容を確認します。
- CORSは完全一致allowlistです。Access停止時に管理APIを公開してはいけません。
- D1はCloudflareのバックアップ/PITRを有効化し、R2 lifecycleと監査ログを運用方針に合わせて設定します。

## 検証・デプロイ

`npm run lint && npm run typecheck && npm test && npm run build`。GitHub Actionsには `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` をEnvironment secretとして登録します。main push時だけCDが実行されます。
