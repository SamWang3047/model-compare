# Layout review — 6 October 2026

This update changes presentation only. `data.json`, `companies.json` and `coding.json` are byte-for-byte unchanged. SEO metadata, favicon, Open Graph image and the shared modal behavior are preserved.

## Scroll-height audit

Measured each version's default page with LLMs selected. The original workload-details disclosure was open by default; the simplified page shows seven models with all disclosures closed. Heights include the header/navigation; individual section heights are rounded pixels.

| Viewport | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Desktop, 1440 × 960 | 16,089 px | 5,338 px | 66.82% |
| Mobile, 375 × 812 | 23,080 px | 7,282 px | 68.45% |

| Previous section | Desktop height | Mobile height | Repetition / new destination |
| --- | ---: | ---: | --- |
| Overview | 477 | 552 | Long conclusion shortened; one button, three takeaways. |
| Compare models | 3,699 | 4,349 | Repeated reading instructions and chart explanations; now one tabbed comparison. |
| Coding comparison | 3,738 | 4,862 | Repeated coding recommendations, agent commentary and plan checks; now Coding tab and footer notes. |
| Choose by task | 954 | 1,658 | Overlaps coding-job and harness recommendations; now six quick picks. |
| Choose the right harness | 700 | 1,338 | Repeats picks and setup notes; now two small disclosures under quick picks. |
| Understand costs | 2,905 | 3,423 | Repeats plan/quota caveats; now one chart, six-row plan table and one Plan rules disclosure. |
| My workflow | 1,094 | 2,277 | Content retained; repeated Used sparingly tag removed; minimum small type increased to 13 px. |
| Sources | 2,445 | 4,507 | Long always-open source list; now four notes and closed All notes / Sources disclosures. |

| Simplified block | Desktop height | Mobile height |
| --- | ---: | ---: |
| Overview | 417 | 529 |
| Compare models | 1,262 | 1,450 |
| Which model to pick | 699 | 749 |
| What it costs | 1,099 | 1,149 |
| My workflow | 1,178 | 2,537 |
| Notes on data / Sources | 607 | 731 |

## Removed from the page

- Separate Coding comparison section and its navigation sub-item; its table is in the Coding tab.
- Second hero link, sidebar dataset links and repeated introductory/methodology paragraphs. Downloads remain in the footer.
- Other takeaway prose about speed and MiMo/Opus; the relevant figures remain in tables, charts, notes and downloads.
- Repeated inline classification badges, metric dates and source links. Values use status dots; dates and sources remain in expanded tables and the footer.
- Standalone How to read the comparison and Model details accordion shells. The table-title tooltip retains the effort/harness/price-mix warning; full figures and conditions are in the modals and All notes.
- Coding lead paragraphs, Cheap tokens are not always cheap tasks callout and its repeated agent-result explanation. The concise takeaway, coding tables and original/raw agent figures retain the substantive information.
- Standalone Coding subscription checks presentation; plan facts are retained in Plan rules and All notes.
- The five old scenario cards: Coding, Agents and tool use, Long context, Lowest cost and Creative video. The coding picks are consolidated; the other scenario wording remains in `companies.json.scenarios`.
- The four old coding-job cards: Hardest tasks, refactors and long agent runs; Strong coding at about half the Arena price; Bulk work and front-end generation; Route by task difficulty. Six quick-pick rows replace their repeated recommendation text; originals remain in `coding.json.jobs`.
- Standalone harness cards and GLM step-by-step wrapper. The configuration, key choice, alias mapping and quota behavior remain in one disclosure; longer setup/interpretation text remains in downloads and All notes where applicable.
- Billing overview cards, redundant subscription headings and the five old plan-disclosure wrappers. Their individual plan and workload content is consolidated into Plan rules.
- Team Standard/Premium plans and the annual-price conflict, including paid team overage. Their values remain in `data.json.subscriptions.zai.team`, `annualConflict` and `companies.json.plans`.
- Full temporary-campaign explanation and nighttime/agent-specific offer conditions. Only **Ends 7 Oct 2026** remains while the campaign has not expired; original wording remains in `data.json.subscriptions.zai.campaign`.
- Repeated workflow **Used sparingly** status note; the frontend card's reason still says to use it sparingly. Candidate names, tentative wording, dashed border and validation plan are unchanged.
- Previous chart tick layouts, including the old **70** grid label. Axes were rescaled; model and cost values were not changed.

### Team figures left only in downloads

| Field | Team Standard | Team Premium |
| --- | ---: | ---: |
| Monthly USD / seat | 88 | 188 |
| Annual initial invoice USD | 1,056 | 2,256 |
| Annual renewal USD | 950.4 | 2,030.4 |
| Advertised annual effective monthly USD | 79.2 | 169.2 |
| Credits / five hours | 15,000 | 35,000 |
| Credits / week | 66,000 | 155,000 |

The two-seat minimum and unavailable quarterly prices also stay in downloads. These are preserved snapshot values, not a fresh pricing check.

## Moved behind controls

- **Show all models / Expand table:** Qwen3.8 Max 0902, MiniMax M3 and other companion models; full intelligence, rank, speed, delay, long-context, cache and pricing columns. One click from LLMs.
- **Coding tab → Expand table:** output-token totals, API prices, context, full-suite/weighted costs, vendor Opus result, notes and exact source precision. Two clicks from the default view.
- **Video tab → Expand table:** full video pricing and confidence bounds. Two clicks from the default view; the video graph is in the Video tab.
- **More charts:** intelligence/price with the short value-zone rule, Arena WebDev price/performance, and Arena score/price gaps. One click; the full value-zone rule remains only in `data.json`.
- **Coding tab → Agent + model evidence:** the original four-row DeepSWE repository-agent table. Its cost/time values average across three coding-agent suites, not DeepSWE alone. Two clicks.
- **GLM Flash in Claude Code:** unchanged JSON configuration, Copy button and three setup/billing bullets. One click.
- **DeepSeek harness results:** five vendor-run results, labelled separate from Terminal-Bench 4.0. One click.
- **Plan rules:** workload assumptions and exact scenario costs; credit formula, quota windows/exhaustion, off-peak rules, DeepSeek peak windows/concurrency, Go allowances and individual quarterly/annual upfront prices. One click.
- **All notes:** remaining caveats, compatibility notes, detailed/raw model metrics, benchmark methodology including 66 tasks/500 steps, all six newer agent configurations, the separate submitted harness result and all original Not found facts. One click.
- **Sources:** deduplicated source links and retrieval dates. One click.
- **Validation plan:** remains closed by default in My workflow. One click.

## Meaning and naming checks

- The long-run takeaway says context alone does not establish reliability; it does not introduce a stronger, unsupported ranking of quota versus context.
- MiMo's quick-pick harness says API trial; no named framework is supplied by the original recommendation.
- **Qwen3.8 Max 0902** in the LLM table and **Qwen3.8 Flash** in the personal workflow remain different names; no equivalence is assumed. The separate Coding tab also retains its sourced Qwen3.8-Flash-Next configuration.
- Previously rounded agent values 56.7, 53.6 and 4.2 remain available through their original underlying raw values in All notes; no score or price was replaced.

## Verification

The local build and dataset/provenance checks pass. Mobile, tablet and desktop were checked in light and dark themes, with 13 px minimum visible small text and no horizontal page overflow. Keyboard tests cover all tabs, both table dialogs (including Video entry), focus trapping/restoration, eight disclosures and the configuration Copy button.

Internal anchors and dataset/asset downloads resolve. External source checks found 94 reachable URLs, no confirmed broken URLs and one unverified Kimi checkout API endpoint that rejects GET with HTTP 405. Source URLs are unchanged.
