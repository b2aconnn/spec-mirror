# spec-mirror

**A Claude Code plugin that writes code from the spec, and keeps the spec true to the code.**

Claude doesn't jump straight into code when you build a feature or fix a bug. It writes a spec first and implements only after you approve each stage. spec-mirror brings AWS Kiro's spec workflows (Feature Spec and Bugfix Spec) to Claude Code.

- **New feature**: requirements → design → tasks → implementation
- **Bug fix**: bug analysis → root cause and fix scope → tasks → implementation
- **Existing code**: turn current behavior into a spec as is

> [한국어](README.md). Spec templates and format rules are written in Korean.

## Install

Requires Claude Code and Node.js 18+.

```text
/plugin marketplace add b2aconnn/spec-mirror
/plugin install spec-mirror@spec-mirror
```

Restart Claude Code after installing.

## Get started

Run this once in your project:

```text
/spec-mirror:init
```

It creates `.spec-mirror/config.json` and the spec folder `docs/spec/`. If there are no convention docs, it recommends an architecture for your project and, once you pick one, creates them in `docs/convention/` (see [Following your team's conventions](#following-your-teams-conventions)).

## Usage

### Build a feature

```text
/spec-mirror:spec order Members pick products and pay for an order
```

1. Claude writes the **requirements** (`requirements.md`) and stops.
2. Review them. Ask for changes, or reply **"승인"** (approve).
3. After approval it writes the **design** (`design.md`). After the next approval it writes the **tasks** (`tasks.md`).
4. Once the tasks are approved, **all tasks are implemented right away** (test first, then code).
   - To run only some, add the numbers: "승인, 1~3번만" (approve, only 1–3)
   - To continue later: "4번 진행해" (run 4), "4~6번 구현해줘" (implement 4–6)

```text
/spec-mirror:sync order             final check of spec, tests and code
```

### Fix a bug

```text
/spec-mirror:bugfix pay-mismatch Amount mismatch returns 400 but should return 502
```

Include how to reproduce the bug, what happens now, what should happen, and what must not change.

1. **Bug analysis** (`bugfix.md`): current behavior, expected behavior, and **behavior to keep**.
2. **Design** (`design.md`): the root cause, found by reading the code, and the fix scope.
3. **Tasks** (`tasks.md`), always in this order:
   1. Write a test that reproduces the bug. It must **fail before the fix**.
   2. Write tests for the behavior to keep. They must **pass before the fix**.
   3. After the fix, confirm that both sets pass.
   4. Update the feature spec to match the fixed behavior.

### Turn existing code into specs

```text
/spec-mirror:adopt                  whole project: start with the spec map
/spec-mirror:adopt payment          one feature
```

Claude writes the spec from the code **without changing behavior**. For a whole project it first lists features in `docs/spec/README.md`, then adopts one feature at a time. Suspected bugs are reported, not fixed.

## Following your team's conventions

spec-mirror only writes specs and links them to tests and code. Architecture, naming, validation and error handling, test kinds and code style differ per project, so they come from your team's convention docs.

```
docs/
├── spec/            specs
└── convention/      team rules
    ├── architecture.md    structure, dependency direction, where domain rules live
    ├── coding.md          naming, validation, errors, logging, code style
    └── testing.md         test kinds and tools
```

Convention docs are found in two ways (both are read):

| Way | Example | Where |
|---|---|---|
| A folder | `docs/convention/architecture.md` | every file under `docs/convention/` (setting `conventionDir`) |
| A file name | `convention.md`, `project-convention.md`, `backend-convention.md` | any file named `convention.md` or `*-convention.md` anywhere in the project (setting `conventionFiles`) |

- File names are case-insensitive (`CONVENTION.md` works too).
- `node_modules`, `build` and folders starting with `.` are skipped.
- To look somewhere else, change the settings in `.spec-mirror/config.json`:

```jsonc
{
  "conventionDir": "wiki/rules",
  "conventionFiles": ["convention.md", "*-convention.md", "*-guide.md"]
}
```

**If they exist**, Claude follows them as is and never edits them. Terms are the one exception:

- Convention terms (glossary, term tables) win over the terms in requirements.
- If requirements define a term the convention doesn't have, or use a different one, Claude lists them in a table before design and asks for each: **add, change or keep**. Only what you choose goes into the convention, then design starts.

**If there are none**, Claude creates them. During `init` or the first design / implementation it looks at the project kind and size, recommends an architecture, and saves a draft to `docs/convention/` once you pick one.

| Kind | Small | Medium | Large |
|---|---|---|---|
| Backend | 3 layer | 3 layer + domain model | DDD + hexagonal |
| Frontend | page folders | feature-based | Feature-Sliced Design |

- If there is existing code, its current structure is always the first option.
- When turning existing code into specs (adopt), Claude doesn't recommend anything; it records the current structure.

**Each stage reads a different part.**

| Stage | Reads | Examples |
|---|---|---|
| Design | design rules only | structure, naming, errors and error responses, validation, transactions, test kinds |
| Implementation (implement, sync) | everything | the above plus code style, logging, how to write tests, commit rules |

The design records which rules it followed (design 01's `따른 convention` table).

**When the convention conflicts with spec-mirror**, only the three things that link spec and code stay spec-mirror's; everything else follows the convention.

- Test names such as `R6-17 결제사가 주문과 같은 내용으로 승인하면 결제가 완료된다`, with given / when / then bodies
- Branch comments such as `// R6-17`
- Error messages matching the requirements word for word

**When something differs from the convention**

- The approved design differs from the convention (found during implementation) → Claude stops and asks whether to change the design.
- Existing code differs from the convention → only the code being changed follows the convention; the rest is reported, not rewritten.

Example: [examples/convention/](examples/convention/) (Spring backend, 3 layer + DDD).

## How it works

- **You approve every stage.** Claude never moves on by itself, and later-stage documents are locked until the earlier stage is approved.
- **The format is checked automatically** on every save, and Claude fixes errors right away.
- **A separate reviewer agent** reads each stage independently. Its findings, and what was done with them, are shown when Claude asks for approval.
- **Each step in a requirement's flow is color-coded**: 🟢 business flow (request · action · response), 🟠 validation, 🟣 external request. The legend sits right under the requirements heading, so you can read the business flow first by following 🟢, then the validations by following 🟠. The classification follows Cockburn's use-case step kinds.
- **Existing terms come first.** Before writing requirements, Claude checks the convention's terms first, then other specs' glossaries and the code's entity and enum names, and keeps the same name for the same concept. If the code has `User`, the new spec says user (User), not member (Member). Terms use the business language people actually use, not developer words.
- **Code names follow the domain terms.** Glossary English names become class and variable names. The checker reports glossary terms missing from design's term ↔ code table and glossary state values missing from the code. Other naming style comes from your conventions.
- **Architecture follows your conventions.** 3 layer or DDD, design and code follow your conventions. If there are none, Claude recommends a structure that fits the project's size ([Following your team's conventions](#following-your-teams-conventions)).
- **Requirements are written in natural Korean by default** (`# 요구사항`, `## 개요`, `**사용자 이야기:**` …). The English frame (`# Requirements Document`, `## Introduction`, `**User Story:** As a …`) is still accepted, so existing documents keep passing the checks.
- **Spec and code are linked by number.** Each criterion links to test scenarios (`R1-2 …`) and one code branch (`// R1-2`). `/spec-mirror:sync` finds the gaps.
- **Tests are BDD scenarios.** Names read as "<situation> then <outcome>" sentences in domain language (e.g. `R6-17 결제사가 주문과 같은 내용으로 승인하면 결제가 완료된다`), bodies are given / when / then. Tests state the policy, not observed details like status codes; those checks live in test support code. Boundary values with the same outcome are examples of one scenario.
- **No criterion goes untested.** design 05 maps every criterion to the test that checks it, and every error has at least one scenario checking the response the user actually gets. Test kinds (unit, integration, E2E …) come from your conventions.

## Commands

| Command | What it does |
|---|---|
| `/spec-mirror:init` | Set up the project |
| `/spec-mirror:spec <name> [description]` | Feature spec (call again for the next stage) |
| `/spec-mirror:bugfix <name> [description]` | Bugfix spec (call again for the next stage) |
| `/spec-mirror:adopt [feature]` | Turn existing code into a spec |
| `/spec-mirror:implement <name> [all\|next\|id\|1~3]` | Implement tasks (starts automatically when tasks are approved) |
| `/spec-mirror:sync <name>` | Compare spec, tests and code, then fix |
| `/spec-mirror:status` | Progress and next step per spec |
| `/spec-mirror:check` | Format check only |
| `/spec-mirror:approve <name>` | Approve the current stage (replying "승인" in chat also works) |

Examples are in [`examples/`](examples/), and the full format rules are in [`rules/`](rules/).

## Development

```bash
npm test
claude plugin validate .
```

## License

Copyright (c) 2026 b2aconnn. All rights reserved. Until public release, no part of this software may be copied, modified or distributed without the author's permission. See [LICENSE](LICENSE).
