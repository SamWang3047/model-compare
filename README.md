# Model Compare

A readable, interactive static website comparing Chinese coding models with GPT-6.1 Sol and Claude Opus. It turns the original research report into a conclusion-first guide with sortable comparisons, model cards, interactive charts, harness instructions and subscription cost scenarios.

**[Live website](https://model-compare-delta.vercel.app/) · [Public GitHub repository](https://github.com/SamWang3047/model-compare)**

**[Chinese AI Companies Overview](https://model-compare-delta.vercel.app/companies.html)** covers Zhipu/Z.ai, DeepSeek, MiniMax, Kimi/Moonshot, StepFun and ByteDance Seedance. The overview has separate LLM/video comparisons, compact sortable table previews with accessible full-table dialogs, sourced pricing, a scenario guide, and interactive intelligence/price and video quality/price charts. The intelligence/price plot uses direct model labels and a configurable value zone. Company profiles, plans and research limitations remain in the downloadable dataset.

Vercel is connected to this repository. Pushes to `main` automatically deploy to production.

**Original coding-report snapshot: 5 October 2026.** The original report was prepared on **6 October 2026**. Benchmark evaluation dates are not consistently disclosed by Artificial Analysis. The website preserves the report's figures and conclusions; it does not claim that the snapshot is live pricing.

**Site updated: 6 October 2026.** Zhipu’s overview now uses only **GLM 5.3 Flash**, refreshed directly from Artificial Analysis and official Z.ai pricing. Its tested effort is **max**; AA’s model page uses spaces while its leaderboard/API name is **GLM-5.3-Flash**. Other models’ figures remain unchanged; the larger-model native-agent row was removed rather than relabelled as Flash.

## Run locally

Install Node.js and npm, then run:

```sh
npm run dev
```

Open the local URL printed in the terminal. No application dependencies, backend, database or API keys are required.

```sh
npm run check
npm run build
```

The production build is written to `dist/`. The check validates the dataset, its source references and the site's local assets. Browser verification also checks the site at mobile and desktop sizes.

To check external source links, run `npm run check:links`. The checker separates broken links from requests blocked by a provider; it does not rewrite the report's sources.

## Project structure

- `index.html` — page structure and SEO metadata.
- `styles.css` — responsive blue-and-white theme, dark mode and accessible controls.
- `app.js` — data-driven content, table sorting, accordions and copy controls.
- `charts.js` — interactive coding, value and monthly-cost charts.
- `data.json` — every model figure, plan, scenario, conclusion, caveat and source.
- `companies.html`, `companies.js`, `companies.css` — the new company overview, using the existing design system.
- `companies.json` — all new model metrics, company briefs, subscriptions, scenarios, limits and dated source references.
- `companies-charts.js`, `companies-charts.css` — interactive overview charts, with keyboard/touch inspection and accessible data tables.
- `scripts/` — dependency-free local development, build and validation tools.

`og.png` is a pre-generated social preview. The optional `scripts/create-og.py` helper requires Pillow only if you want to regenerate that image; it is not part of the application or build.

## Update the report

Edit **`data.json`** without changing the layout. Model rows preserve full-precision values; the interface rounds values only for display. The comparison uses one GLM Flash entry. Adjust `chart_settings.value_zone.intelligence_min` and `chart_settings.value_zone.blended_price_max` in `data.json` to change the chart’s shaded screening region (defaults: Intelligence Index ≥40 and blended price ≤$2/M); the rule is analyst inference, not cost per successful task. Monthly scenarios are illustrative calculations, not measured developer averages.

To update the new overview, edit **`companies.json`**. Each metric has `value`, `type`, `date`, `source_ids` and optional `note`; prose has the same evidence fields with `text`. Null means **Not found**, never zero. Keep company profile text below 100 words and the overview below 40 words. Flagships, companions and comparison baselines are explicit roles. Source dates are access dates; unavailable benchmark-run dates are disclosed.

GLM Flash’s refreshed global rank is 36 among 260 scored model/effort variants in 264 current default leaderboard entries. Other models retain ranks from the earlier 259-scored/263-entry snapshot. Ranks use unrounded scores, including estimates, rather than model-page price-class ranks. Intelligence Index displays use one decimal. Flash gaps subtract raw scores and display one decimal; other models retain their original integer-rounded gap values, with that convention disclosed. Blended price uses an illustrative **3:1 uncached input:output** mix, not AA's default cached mix. Output-price ratios are tariff comparisons, not costs per successful task. The video chart uses only **AA-Video-T2V v2.0 with audio**, retaining its confidence intervals and AA's creator-API minute prices divided by 60; I2V results are kept separate. The dataset’s positioning entries contain qualitative statements, not invented numeric scores.

Each sourced row or paragraph has a `type`, `date` and `source_ids`. The source IDs resolve to the `sources` array, whose records include the title, URL and access date. Model rows also contain `metric_sources`, so prices and benchmark results can point to different sources. Keep source references and dates current when changing a number.

Evidence labels distinguish verified source statements, analyst inference, arithmetic calculations and missing evidence. Do not compare vendor Terminal-Bench 2.1 figures directly with AA Terminal-Bench 4.0, substitute a larger model’s figures for GLM Flash, or interpret a long-context score as proof of unattended multi-hour reliability.

## Deploy to Vercel

The site is static. Vercel's project configuration builds the site and serves `dist/`; no environment variables or services are needed.

To create the public GitHub repository from a fresh local checkout:

```sh
git init -b main
git add .
git commit -m "Build interactive coding model comparison site"
gh repo create model-compare --public --source=. --remote=origin --push
```

If the repository already exists, use its existing remote and push normally.

For a production deployment from the CLI:

```sh
npx vercel --prod
```

If the Vercel CLI is already installed, `vercel --prod` is equivalent. Authenticate when prompted and select the intended Vercel account/project.

For automatic deployments on every push, import the public **model-compare** GitHub repository in Vercel, or connect it through **Project → Settings → Git**. Use `main` as the production branch. A standalone CLI deployment does not establish Git auto-deploys until the repository is connected.

## Data sources

All source links and snapshot dates are stored in `data.json` and visible on the website. The research starts with [Artificial Analysis model results](https://artificialanalysis.ai/) and its [coding-agent leaderboard](https://artificialanalysis.ai/agents/coding-agents), cross-checked against:

- [Z.ai API pricing](https://docs.z.ai/guides/overview/pricing), [Coding Plan quotas](https://docs.z.ai/devpack/overview), [Team plans](https://docs.z.ai/devpack/teamplan), [Claude Code integration](https://docs.z.ai/devpack/tool/claude) and [ZCode](https://zcode.z.ai/en).
- [DeepSeek API pricing](https://api-docs.deepseek.com/quick_start/pricing/), [V4.1 Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) and [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
- [MiMo V2.6 Pro](https://mimo.mi.com/models/en-US/mimo-v2.6-pro), [Qwen3.8 Max documentation](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max), [Kimi pricing](https://platform.kimi.ai/docs/pricing/chat) and [MiniMax pricing](https://platform.minimax.io/docs/guides/pricing-paygo).
- [OpenAI GPT-6.1 Sol documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) and [OpenCode Go plans](https://opencode.ai/docs/go/).

Known discrepancies remain visible: GLM's AA versus official cache rate, MiniMax's cache-write entry and Z.ai Team initial annual billing versus advertised renewal-equivalent pricing. Recommendations are analyst inference, not vendor guarantees.

The new overview also reads the [AA model leaderboard](https://artificialanalysis.ai/models), [Intelligence Index methodology](https://artificialanalysis.ai/methodology/intelligence-benchmarking), [audio T2V arena](https://artificialanalysis.ai/video/leaderboard/text-to-video) and [separate I2V arena](https://artificialanalysis.ai/video/leaderboard/image-to-video), cross-checked against:

- [MiniMax API prices](https://platform.minimax.io/docs/guides/pricing-paygo), [current M Plan](https://platform.minimax.io/docs/m-plan/intro) and [regular monthly offers](https://platform.minimax.io/docs/m-plan/monthly-offer).
- [Kimi API pricing](https://platform.kimi.ai/docs/pricing/chat), [current coding models](https://www.kimi.com/code/docs/en/kimi-code/models.html), [membership rules](https://www.kimi.com/code/docs/en/kimi-code/membership.html) and public official checkout pricing.
- [StepFun API prices](https://platform.stepfun.ai/docs/en/guides/pricing/details) and [Step Plan quotas](https://platform.stepfun.ai/docs/en/step-plan/overview).
- [Seedance API pricing](https://docs.byteplus.com/id/docs/modelark/model-pricing), [Seedance 2.5 capabilities](https://docs.byteplus.com/zh-TW/docs/modelark/seedance-2-5), [prepaid resource packs](https://docs.byteplus.com/zh-CN/docs/modelark/seedance-2-0-model-resource-pack-rules?redirect=1), [Veo API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Wan 3.0 official prices](https://modelstudio.alibabacloud.com/intl/blog/wan3-ai-video-generation-model/).
- [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations): the retired Sora Videos API is excluded from current comparisons.

Missing scores for subscription previews, unpublished quotas, deprecated AA entries and unreadable current video checkouts remain documented in `companies.json`; applicable metric notes are visible in model details. Run `npm run check` to validate both datasets, arithmetic and source references; `node scripts/check-companies.mjs --preserve-against 750a2b6` additionally verifies preservation of all non-GLM numeric data against the preceding release.
