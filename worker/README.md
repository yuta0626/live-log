# LIVE LOG LiveFans取得Worker

このWorkerは、LIVE LOG（GitHub Pages）からLiveFansの公演ページ本文を取得するための小さな中継APIです。

## この方式を用意した理由

GitHub Pages上のJavaScriptからLiveFansを直接取得すると、ブラウザのCORS制限により本文を読めません。Jina Readerや公開CORS中継も、今回の診断ログでは本文不足・429などで安定しませんでした。

Cloudflare Workerをサーバー側の取得窓口にし、LIVE LOGはWorkerから返されたHTMLを解析する構成を検討します。Workerは任意URLを受け取らず、数字のLiveFans公演IDだけを受け付けます。

## ファイル

- `livefans-proxy.js`: Worker本体

## デプロイ方法（後で必要になる作業）

1. Cloudflareにログインし、Workers & Pagesから新しいWorkerを作成
2. Quick Editを開き、`livefans-proxy.js` の内容を貼り付けてDeploy
3. 発行された `https://<worker-name>.<account>.workers.dev` のURLを控える
4. 次のURLをブラウザで開き、LiveFansのHTMLが返るか確認

```
https://<worker-name>.<account>.workers.dev/event?id=165476
```

正常ならHTML本文が表示されます。エラーの場合はHTTP 502などになり、LiveFans側の応答または取得失敗を示します。

## 制限

- 取得先は `https://www.livefans.jp/events/<数字>` に固定
- ブラウザからの呼び出し元はLIVE LOGのGitHub Pagesドメインに限定
- 無料プランの利用枠内での運用を想定
- Workerを用意しただけではLIVE LOG本体とはまだ接続されません。接続処理は、WorkerからLiveFans本文を実際に取得できることを確認してから行います。
