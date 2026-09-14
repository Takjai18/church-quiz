import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";

const URL = process.env.QUIZ_URL || "http://127.0.0.1:3000";

async function roomCodeFromHost(page: Page): Promise<string> {
  await page.getByRole("heading", { name: /房號/ }).waitFor({ timeout: 10000 });
  const text = await page.locator("h1").first().innerText();
  const code = (text.match(/[A-Z2-9]{4}/) || [])[0];
  assert.ok(code, `no room code in ${text}`);
  return code;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const hostCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const tvCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const phoneCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  const host = await hostCtx.newPage();
  await host.goto(`${URL}/host`, { waitUntil: "domcontentloaded" });
  const code = await roomCodeFromHost(host);

  await host.getByLabel("紅隊名稱").fill("晨星");
  await host.getByLabel("藍隊名稱").fill("夜光");
  await host.getByRole("button", { name: "更新隊名" }).click();
  await host.getByRole("button", { name: "晨星" }).click();
  await host.getByRole("button", { name: "開場" }).click();
  await host.getByText("輪到【晨星】揀題").waitFor({ timeout: 8000 });

  const tv = await tvCtx.newPage();
  await tv.goto(`${URL}/d/${code}`, { waitUntil: "domcontentloaded" });
  await tv.getByText("輪到【晨星】揀題").waitFor({ timeout: 8000 });
  await tv.getByText("晨星").first().waitFor();
  assert.equal(await tv.getByText("加利利海").count(), 0);

  const phone = await phoneCtx.newPage();
  await phone.goto(`${URL}/play/${code}`, { waitUntil: "domcontentloaded" });
  await phone.getByText("輪到【晨星】揀題").waitFor({ timeout: 8000 });

  await host.locator('[data-cell="bible-10"]').click();
  await host.getByText("【晨星】作答中").waitFor();
  await tv.getByText("【晨星】作答中").waitFor();
  await host.getByText("加利利海").waitFor();
  assert.equal(await tv.getByText("加利利海").count(), 0, "Display never leaks the answer before reveal");
  assert.equal(await phone.getByText("加利利海").count(), 0);

  await host.getByRole("button", { name: "啱", exact: true }).click();
  await tv.getByText("答案揭示").waitFor();
  await tv.getByText("答案：加利利海").waitFor();
  await host.getByRole("button", { name: "繼續" }).click();
  await tv.getByText("輪到【夜光】揀題").waitFor();

  await host.locator('[data-cell="pop-30"]').click();
  await host.getByRole("button", { name: "錯", exact: true }).click();
  await tv.getByText("【晨星】要唔要補答？").waitFor();
  await host.getByRole("button", { name: "補答", exact: true }).click();
  await tv.getByText("【晨星】補答中").waitFor();
  await host.getByRole("button", { name: "補答啱" }).click();
  await host.getByRole("button", { name: "繼續" }).click();
  await tv.getByText("輪到【晨星】揀題").waitFor();

  const tvScores = await tv.locator(".score-num").allInnerTexts();
  assert.equal(tvScores[0]?.trim(), "40");
  assert.equal(tvScores[1]?.trim(), "-30");
  assert.ok(await tv.locator(".score-num.neg").count(), "negative scores in red");

  await host.reload({ waitUntil: "domcontentloaded" });
  await host.getByText("輪到【晨星】揀題").waitFor({ timeout: 8000 });
  const hostScores = await host.locator(".score-num").allInnerTexts();
  assert.equal(hostScores[0]?.trim(), "40", "Host refresh does not reset score");
  assert.equal(hostScores[1]?.trim(), "-30");

  await host.locator('[data-cell="kdrama-10"]').click();
  await tv.locator("img[alt='韓劇截圖']").waitFor();
  await tv.getByText("韓劇截圖").waitFor();
  await host.locator(".answer-main").getByText("愛的迫降").waitFor();
  assert.equal(await tv.getByText("愛的迫降", { exact: true }).count(), 0);

  await host.getByRole("button", { name: "錯", exact: true }).click();
  await host.getByRole("button", { name: "不補答" }).waitFor();
  await host.getByRole("button", { name: "補答", exact: true }).waitFor();
  await host.getByRole("button", { name: "不補答" }).click();
  await host.getByRole("button", { name: "繼續" }).click();
  const afterDecline = await tv.locator(".score-num").allInnerTexts();
  assert.equal(afterDecline[0]?.trim(), "30");
  assert.equal(afterDecline[1]?.trim(), "-30");

  host.once("dialog", (d) => d.accept());
  await host.getByRole("button", { name: "完場" }).click();
  await tv.locator(".finish-banner").getByText("【晨星】勝出！").waitFor({ timeout: 8000 });

  const host2 = await hostCtx.newPage();
  await host2.goto(`${URL}/host`, { waitUntil: "domcontentloaded" });
  await host2.getByRole("button", { name: "新開一房" }).click();
  await host2.getByRole("button", { name: "開場" }).waitFor();
  await host2.locator("textarea").fill(JSON.stringify({ title: "壞題庫", questions: [] }));
  await host2.getByRole("button", { name: "套用 JSON" }).click();
  await host2.getByText(/需要剛好 12 題/).first().waitFor();
  assert.equal(await host2.getByRole("button", { name: "開場" }).isDisabled(), true);

  await host2.getByRole("button", { name: "用回示範題庫" }).click();
  await host2.getByRole("button", { name: "開場" }).waitFor();
  await host2.locator(".choice-row button").first().click();
  await host2.getByRole("button", { name: "開場" }).click();
  await host2.getByText(/輪到【/).waitFor({ timeout: 8000 });
  await host2.locator('[data-cell="bible-10"]').click();
  await host2.getByText(/作答中/).waitFor();
  await host2.waitForTimeout(31000);
  await host2.getByText(/要唔要補答/).waitFor({ timeout: 5000 });
  await host2.waitForTimeout(11000);
  await host2.getByText("答案揭示").waitFor({ timeout: 5000 });
  const timed = await host2.locator(".score-num").allInnerTexts();
  assert.equal(timed[0]?.trim(), "-10", "30s primary timeout counts as wrong");
  assert.equal(timed[1]?.trim(), "0", "10s steal-offer timeout counts as decline");

  await browser.close();
  console.log("ui.test.ts ok", code);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
