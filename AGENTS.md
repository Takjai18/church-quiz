# church-quiz

After any code or README change:

1. Commit on `main`
2. `git push origin main` — GitHub must always have the latest version
3. Cloudflare public site updates via GitHub Action on push to `main` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets). Until those secrets exist, also run `npm run deploy` after `npx wrangler login`.

Do not use `wrangler deploy --temporary`. The claimed public site is:

https://church-quiz.deciduous-crayfish.workers.dev/
