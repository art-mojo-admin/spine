
# Windsurf Model Ladder
Use this quick reference to pick the right Cascade model based on the “altitude” of the task.
## Summary Table (40K / 20K / 10K / Tactical)
| Altitude | Purpose | Absolute Best (cost no object) | Solid but Cheaper | Minimum-Cost Productive |
| --- | --- | --- | --- | --- |

| **40K ft**<br>(Architecture, invariants, threat modeling) | Decide tenancy, RBAC, audit/event design, review risky migrations | 
**Claude Opus 4.6 Thinking** — deepest reasoning, handles long prompts, great for multi-tenant security reviews. | 
**GPT-5 Medium Thinking** — nearly as rigorous, lower cost, still excellent at formal reasoning. | 
**GPT-5 Low Thinking** — enough chain-of-thought to vet requirements while keeping spend minimal. |

| **20K ft**<br>(System design + multi-file refactors) | Plan modules, review PRs, coordinate cross-layer changes | 
**Claude Sonnet 4.6 Thinking 1M** — long-context coherence plus fast follow-ups. | 
**Claude Sonnet 4.6** — strong balance of speed + accuracy for multi-file edits. | 
**Claude Sonnet 4.5** — previous-gen but still reliable for “big picture” without the Thinking premium. |

| **10K ft**<br>(Feature implementation, daily driver) | Build Netlify functions, frontend views, migrations | 
**GPT-4o** — fastest high-quality model; great for iterative coding and debugging. | 
**Claude Sonnet 4.6** — clean, deterministic outputs; ideal when you want stylistic consistency. | 
**Gemini 3 Flash Medium** — cheap yet capable; watch closely for subtle tenancy mistakes. |

| **Tactical / 1K ft**<br>(Boilerplate, tests, doc updates) | Generate types, transform JSON/YAML, write tests/docs | 
**Claude Haiku 4.5** — blazing fast, still accurate on mechanical work. | 
**Gemini 3 Flash Low** — tiny cost for repetitive transforms; good enough with review. | 
**Gemini 3 Flash Minimal** or **GLM-5** — ultra-low cost helpers for rote edits; always review outputs. |
## Tier Details
### 40K ft — Architecture & Guardrails
- **Purpose:** Align on tenancy boundaries, RBAC, audit/event guarantees, risky migrations.
- **Absolute best:** Claude Opus 4.6 Thinking.
- **Solid but cheaper:** GPT-5 Medium Thinking.
- **Minimum-cost productive:** GPT-5 Low Thinking.
### 20K ft — Systems & Cross-Cutting Refactors
- **Purpose:** Module planning, PR reviews, coordinated multi-file edits.
- **Absolute best:** Claude Sonnet 4.6 Thinking 1M.
- **Solid but cheaper:** Claude Sonnet 4.6.
- **Minimum-cost productive:** Claude Sonnet 4.5.
### 10K ft — Daily Feature Work
- **Purpose:** Netlify Functions, Supabase migrations, frontend pages, everyday debugging.
- **Absolute best:** GPT-4o.
- **Solid but cheaper:** Claude Sonnet 4.6.
- **Minimum-cost productive:** Gemini 3 Flash Medium.
### Tactical / 1K ft — Mechanical Tasks
- **Purpose:** Boilerplate, bulk transformations, tests, docs.
- **Absolute best:** Claude Haiku 4.5.
- **Solid but cheaper:** Gemini 3 Flash Low.
- **Minimum-cost productive:** Gemini 3 Flash Minimal or GLM-5.

## How to Use the Ladder
1. **Start high, drop down:** Align at 40K ft, then flow down to 20K/10K for execution, finishing with tactical helpers.
2. **Cross-check critical pieces:** Ask a 40K model to audit complex logic written at 10K.
3. **Keep prompts tight:** Even Thinking tiers benefit from concise checklists and summaries.
project/uyokuiibztwfasdprsov
br616joMvL1o6pfa