# 教會冰破問答

繁體中文兩隊冰破遊戲：主持喺電腦開房，TV 投影大螢幕，手機用房號旁觀。唔使登入、唔使撳鈴。

## 公開網站（Cloudflare）

呢個遊戲已經 deploy 喺 **Cloudflare Workers**，任何人用瀏覽器就可以開，**唔使 Cloudflare Access、唔使登入**。

| 頁面 | 網址 |
| --- | --- |
| 入場 | https://church-quiz.quirky-gigantoraptor.workers.dev/ |
| 主持台 | https://church-quiz.quirky-gigantoraptor.workers.dev/host |
| 大螢幕 | 主持台撳「開大螢幕」，或 `/d/房號` |
| 手機旁觀 | 掃 QR，或 `/play/房號` |

例：大螢幕 `https://church-quiz.quirky-gigantoraptor.workers.dev/d/ABCD`

## 點玩

1. 主持打開 [主持台](https://church-quiz.quirky-gigantoraptor.workers.dev/host)，設隊名，開場。
2. 用「開大螢幕」投影去 TV。
3. 而家輪到嗰隊大聲揀格，主持喺電腦撳嗰格。
4. 主持用 **啱 / 錯 / 補答 / 不補答** 判題。答案只喺主持台同揭示之後先出現。

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
