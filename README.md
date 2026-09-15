# 教會冰破問答

繁體中文兩隊冰破遊戲：主持喺電腦開房，TV 投影大螢幕，手機用房號旁觀。唔使登入、唔使撳鈴。

**正式公開網（已認領 Cloudflare 帳戶，永久）：**  
https://church-quiz.deciduous-crayfish.workers.dev/

## 公開網站（Cloudflare）

任何人用瀏覽器就可以開，**唔使 Cloudflare Access、唔使登入**。

| 頁面 | 網址 |
| --- | --- |
| 入場 | https://church-quiz.deciduous-crayfish.workers.dev/ |
| 主持台 | https://church-quiz.deciduous-crayfish.workers.dev/host |
| 大螢幕 | 主持台撳「開大螢幕」，或 `/d/房號` |
| 手機旁觀 | 掃 QR，或 `/play/房號` |

例：大螢幕 `https://church-quiz.deciduous-crayfish.workers.dev/d/ABCD`

## 點玩

1. 主持打開 [主持台](https://church-quiz.deciduous-crayfish.workers.dev/host)。
2. **後台模式**：睇到答案、改隊名／題庫／圖片。
3. 開場後會入 **遊戲模式**（投影俾大家一齊玩）：睇唔到答案，棋盤＋**啱 / 錯 / 補答 / 唔補答**。
4. 隨時可以撳頂欄「後台／遊戲」切換。手機旁觀仍然用 `/play/房號`。

規則：4 類 × 3 分值（10 / 30 / 50）共 12 格。答錯扣分，對手可以補答。補答只改分數，下一格永遠由對手揀。可以打和，分數可以負。

題目喺主持台 **後台** 可以直接改（題幹、答案、題型），韓劇可以上傳劇照。儲存後呢部電腦再開新房會用返。

## 本機開發

```bash
npm install
npm test
npm run build
npx wrangler dev
```

瀏覽器開 `http://127.0.0.1:8787/host`。

## GitHub 同 Cloudflare 會唔會自動同步？

**GitHub 有最新 code，唔等於 Cloudflare 公開網自動更新。** 要 `main` 有新 commit 先會觸發 deploy。

已加 GitHub Action（`.github/workflows/deploy.yml`）：push 去 `main` 就會 build 同 deploy 去  
https://church-quiz.deciduous-crayfish.workers.dev/

第一次要喺 GitHub repo 加兩個 Secrets（Settings → Secrets and variables → Actions）：

1. `CLOUDFLARE_API_TOKEN` — [開 Workers 權限嘅 API token](https://dash.cloudflare.com/profile/api-tokens)（用「Edit Cloudflare Workers」範本）
2. `CLOUDFLARE_ACCOUNT_ID` — Cloudflare dashboard 右側 **Account ID**

加完之後，之後每次 `git push origin main`（或 `npm run ship`）就會更新公開網。

唔好再用 `wrangler deploy --temporary`，否則會開一條新嘅臨時網，過陣又會消失。

本機手動 deploy：

```bash
npx wrangler login
npm run deploy
```
