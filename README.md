# 教會冰破問答

繁體中文兩隊冰破遊戲：主持喺電腦開房，TV 投影大螢幕，手機用房號旁觀。唔使登入、唔使撳鈴。

## 公開網站（Cloudflare）

呢個遊戲已經 deploy 喺 **Cloudflare Workers**，任何人用瀏覽器就可以開，**唔使 Cloudflare Access、唔使登入**。

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

題目可以遲啲先改（貼 JSON 或上傳）。韓劇圖喺主持台每題上傳或貼網址。

## 本機開發

```bash
npm install
npm test
npm run build
npx wrangler dev
```

瀏覽器開 `http://127.0.0.1:8787/host`。

## 再 deploy 去 Cloudflare

```bash
npm run deploy
```

需要已登入嘅 Cloudflare 帳戶（`npx wrangler login`）。免費 Workers 方案就夠用。
