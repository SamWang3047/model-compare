# Model Compare

A readable, interactive static website comparing Chinese coding models with GPT-6.1 Sol and Claude Opus. It turns the original research report into a conclusion-first guide with sortable comparisons, model cards, interactive charts, harness instructions and subscription cost scenarios.

**[Live website](https://model-compare-delta.vercel.app/) · [Public GitHub repository](https://github.com/SamWang3047/model-compare)**

Vercel is connected to this repository. Pushes to `main` automatically deploy to production.

**Data snapshot / last updated: 5 October 2026.** The original report was prepared on **6 October 2026**. Benchmark evaluation dates are not consistently disclosed by Artificial Analysis. The website preserves the report's figures and conclusions; it does not claim that the snapshot is live pricing.

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
- `scripts/` — dependency-free local development, build and validation tools.

`og.png` is a pre-generated social preview. The optional `scripts/create-og.py` helper requires Pillow only if you want to regenerate that image; it is not part of the application or build.

## Update the report

Edit **`data.json`** without changing the layout. Model rows preserve the original full-precision values; the interface rounds values only for display. Monthly scenarios are illustrative calculations, not measured developer averages.

Each sourced row or paragraph has a `type`, `date` and `source_ids`. The source IDs resolve to the `sources` array, whose records include the title, URL and access date. Model rows also contain `metric_sources`, so prices and benchmark results can point to different sources. Keep source references and dates current when changing a number.

Evidence labels distinguish verified source statements, analyst inference, arithmetic calculations and missing evidence. Do not compare vendor Terminal-Bench 2.1 figures directly with AA Terminal-Bench 4.0, substitute full GLM figures for GLM Flash, or interpret a long-context score as proof of unattended multi-hour reliability.

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
