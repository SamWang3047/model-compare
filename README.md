# Model Compare

A readable, interactive static website comparing Chinese AI models with GPT-6.1 Sol and Claude Opus. Five blocks cover the overview, comparison, quick picks, monthly costs and personal workflow. LLMs, Coding and Video share one comparison block; secondary charts, plan rules and notes are collapsed. All three original datasets remain unchanged and downloadable.

**[Live website](https://model-compare-delta.vercel.app/) · [Public GitHub repository](https://github.com/SamWang3047/model-compare)**

The comparison covers Zhipu/Z.ai, DeepSeek, MiniMax, Kimi/Moonshot, StepFun, Xiaomi/MiMo, Alibaba/Qwen and ByteDance Seedance alongside the Western baselines. The default LLM table shows seven choices; **Show all models** and the full-table dialog retain additional models. Dates and source links live in the modals and footer. The former `/companies.html` URL redirects to the canonical page; merged harness links lead to quick picks.

Vercel is connected to this repository. Pushes to `main` automatically deploy to production.

The compact **[My multi-model workflow](https://model-compare-delta.vercel.app/#workflow)** section uses editable content and card statuses in `data.json.multi_model_workflow`, with a closed validation accordion and no new benchmark or pricing figures.

**Original coding-report snapshot: 5 October 2026.** The original report was prepared on **6 October 2026**. Benchmark evaluation dates are not consistently disclosed by Artificial Analysis. The website preserves the report's figures and conclusions; it does not claim that the snapshot is live pricing.

**Site updated: 6 October 2026.** Zhipu’s overview now uses only **GLM 5.3 Flash**, refreshed directly from Artificial Analysis and official Z.ai pricing. Its tested effort is **max**; AA’s model page uses spaces while its leaderboard/API name is **GLM-5.3-Flash**. Other models’ figures remain unchanged; the larger-model native-agent row was removed rather than relabelled as Flash.

The **[Coding tab](https://model-compare-delta.vercel.app/#coding-comparison)** retains seven AA model configurations, independent Terminal-Bench 4.0 and Intelligence Index v4.3.2 results, output-token totals and Arena WebDev prices. Detailed columns remain in its modal, four original repository-agent rows remain in a collapsed table, and other agent configurations and plan checks are in footer notes. Observations were retrieved on **6 October 2026**; Arena’s directly verified snapshot is **1 October**, and the historical Kimi observation is **12 August**. Requested 30 September Arena figures remain labelled **Not found**.

Arena’s blend weights **output:input 3:1**, `(input + 3 × output) / 4`; the older overview scatter weights **input:output 3:1**. Arena provider quotes, official API prices, full Intelligence Index costs and coding-agent costs are distinct measures. New values display one decimal, while evidence retains source precision. The new frontier connects only the selected models, not the global Arena frontier. Historical Kimi and missing entries are excluded from both new plots.

Current primary AA data confirms terminal and intelligence scores for all seven configurations, including Qwen3.8-Flash-Next. GPT-6 Sol is a distinct predecessor to GPT-6.1 Sol. Flagship **GLM-5.3** agent results are reference-only and never assigned to Flash. Anthropic’s vendor result uses xhigh effort with fallback and stays separate from AA’s independent result. Official plan checks distinguish supported model versions and publish missing quotas as **Not found**.

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
- `app.js` — reusable coding benchmark, harness and cost sections, plus copy controls.
- `charts.js` — interactive coding and monthly-cost charts, with the original value-chart renderer retained for reuse.
- `data.json` — original coding figures, plans, scenarios, conclusions, caveats and sources.
- `companies.js`, `companies.css` — the unified page controller, sortable comparison, modal, task guide and responsive styles.
- `model-data.js` — joins identical model configurations, adds unique models and deduplicates source URLs while retaining each fact’s date.
- `companies.html` — a fallback redirect for the old overview URL; Vercel also redirects it in production.
- `companies.json` — intelligence and video metrics, company briefs, plans, task scenarios, limits and dated sources.
- `companies-charts.js`, `companies-charts.css` — interactive overview charts, with keyboard/touch inspection and accessible data tables.
- `coding.json` — all new coding figures, exact source names, dated evidence, plans, caveats and missing items.
- `coding-comparison.js`, `coding-comparison.css` — compact coding table, expanded evidence, task guide and coding-only details.
- `coding-charts.js`, `coding-data.js` — responsive Arena/gap charts and shared calculations using unrounded, matching-snapshot inputs.
- `table-dialog.js` — shared keyboard, focus and scroll behavior for both expanded-table dialogs.
- `scripts/` — dependency-free local development, build and validation tools.

`og.png` is a pre-generated social preview. The optional `scripts/create-og.py` helper requires Pillow only if you want to regenerate that image; it is not part of the application or build.

## Update the report

Edit **`data.json`** without changing the layout. Model rows preserve full-precision values; the interface rounds values only for display. The comparison uses one GLM Flash entry. Adjust `chart_settings.value_zone.intelligence_min` and `chart_settings.value_zone.blended_price_max` in `data.json` to change the chart’s shaded screening region (defaults: Intelligence Index ≥40 and blended price ≤$2/M); the rule is analyst inference, not cost per successful task. Monthly scenarios are illustrative calculations, not measured developer averages.

Edit **`companies.json`** for intelligence, video and task-guide content. Each metric has `value`, `type`, `date`, `source_ids` and optional `note`; prose has the same evidence fields with `text`. Null means **Not found**, never zero. `model_labels` supplies the highlighted models beside task headings. Flagships, companions and comparison baselines are explicit roles. Source dates are access dates; unavailable benchmark-run dates are disclosed.

Both datasets retain their original snapshots. `model-data.js` combines them when the page loads: identical model/effort configurations appear once; overview prices and existing metrics retain their values, while coding cost, speed, delay and context-recall facts retain the coding report’s date. MiMo, Qwen and Sol medium have no Intelligence Index in these stored snapshots, so that field stays **Not found** and they are excluded from the intelligence scatter. They remain available in the full comparison and model details. The footer lists each source URL once.

Edit **`coding.json`** for the new coding comparison. Each fact has `value`, `unit`, `source_url`, `retrieved_date`, `label` and `note`; dated leaderboards add `snapshot_date`. Valid labels are `verified`, `vendor_reported`, `third_party`, `calculated` and `not_found`. Use `null` with an explanatory note for unavailable facts. Keep integers for raw token counts and full precision for scores/costs. `older_snapshot` prevents historical entries from joining current charts. `chart_settings` controls the illustrative screening zone, selected-model frontier and gap baseline. Prose recommendations separately identify analyst inference.

Run `node scripts/check-coding.mjs --reference ca49d15` to verify sourced facts, matching snapshots, calculation behavior and preservation of the earlier datasets and sections. Run `npm run check:links -- --coding-only` to inspect the new source URLs; access blocks are reported separately from confirmed broken links.

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

All source links and snapshot dates are stored in `data.json`; remaining model metrics and recommendation text show their provenance on the website. The research starts with [Artificial Analysis model results](https://artificialanalysis.ai/) and its [coding-agent leaderboard](https://artificialanalysis.ai/agents/coding-agents), cross-checked against:

- [Z.ai API pricing](https://docs.z.ai/guides/overview/pricing), [Coding Plan quotas](https://docs.z.ai/devpack/overview), [Team plans](https://docs.z.ai/devpack/teamplan), [Claude Code integration](https://docs.z.ai/devpack/tool/claude) and [ZCode](https://zcode.z.ai/en).
- [DeepSeek API pricing](https://api-docs.deepseek.com/quick_start/pricing/), [V4.1 Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash) and [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
- [MiMo V2.6 Pro](https://mimo.mi.com/models/en-US/mimo-v2.6-pro), [Qwen3.8 Max documentation](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max), [Kimi pricing](https://platform.kimi.ai/docs/pricing/chat) and [MiniMax pricing](https://platform.minimax.io/docs/guides/pricing-paygo).
- [OpenAI GPT-6.1 Sol documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) and [OpenCode Go plans](https://opencode.ai/docs/go/).

Known discrepancies remain documented in the datasets and applicable model or billing notes: GLM's AA versus official cache rate, MiniMax's cache-write entry and Z.ai Team initial annual billing versus advertised renewal-equivalent pricing. Recommendations are analyst inference, not vendor guarantees.

The intelligence and video comparisons also use the [AA model leaderboard](https://artificialanalysis.ai/models), [Intelligence Index methodology](https://artificialanalysis.ai/methodology/intelligence-benchmarking), [audio T2V arena](https://artificialanalysis.ai/video/leaderboard/text-to-video) and [separate I2V arena](https://artificialanalysis.ai/video/leaderboard/image-to-video), cross-checked against:

- [MiniMax API prices](https://platform.minimax.io/docs/guides/pricing-paygo), [current M Plan](https://platform.minimax.io/docs/m-plan/intro) and [regular monthly offers](https://platform.minimax.io/docs/m-plan/monthly-offer).
- [Kimi API pricing](https://platform.kimi.ai/docs/pricing/chat), [current coding models](https://www.kimi.com/code/docs/en/kimi-code/models.html), [membership rules](https://www.kimi.com/code/docs/en/kimi-code/membership.html) and public official checkout pricing.
- [StepFun API prices](https://platform.stepfun.ai/docs/en/guides/pricing/details) and [Step Plan quotas](https://platform.stepfun.ai/docs/en/step-plan/overview).
- [Seedance API pricing](https://docs.byteplus.com/id/docs/modelark/model-pricing), [Seedance 2.5 capabilities](https://docs.byteplus.com/zh-TW/docs/modelark/seedance-2-5), [prepaid resource packs](https://docs.byteplus.com/zh-CN/docs/modelark/seedance-2-0-model-resource-pack-rules?redirect=1), [Veo API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Wan 3.0 official prices](https://modelstudio.alibabacloud.com/intl/blog/wan3-ai-video-generation-model/).
- [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations): the retired Sora Videos API is excluded from current comparisons.

Missing scores for subscription previews, unpublished quotas, deprecated AA entries and unreadable current video checkouts remain documented in `companies.json`; applicable metric notes are visible in model details. Run `npm run check` to validate both datasets, arithmetic and source references; `node scripts/check-companies.mjs --preserve-against 750a2b6` additionally verifies preservation of all non-GLM numeric data against the preceding release.
