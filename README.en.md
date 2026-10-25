# spec-mirror

**The spec is the source of truth.** spec-mirror is a spec-driven development plugin for Claude Code. It keeps the business flow written in your documents and the flow of your code identical.

It brings AWS Kiro's spec workflows (Feature Spec and Bugfix Spec) to Claude Code, and makes them stricter.

- **Features** go through `requirements → design → tasks`. **Bugs** go through `bugfix → design → tasks`.
- **A person approves** each stage before the next one starts, and a hook enforces that order.
- Every document follows a **fixed format**, and a checker verifies it on every save.
- Each requirement criterion maps to **exactly one code branch and one acceptance test**, and a trace table confirms the mapping.

> [한국어 README](README.md) is the primary documentation. Spec templates and format rules are currently Korean-only.

## Why spec-mirror

| | Typical spec tools | spec-mirror |
|---|---|---|
| Requirements | Free text, EARS sentences | **Domain language only.** Technical terms, class names and URLs are errors |
| Unit of a criterion | A feature | **One criterion = one code branch = one acceptance test** |
| Order of criteria | Unspecified | **Processing flow = execution order** |
| Bug fixes | Fix directly | Define **current, expected and unchanged behavior** first. Fix only after an exploration test **fails on the unfixed code** |
| Format compliance | Relies on prompts | A checker and hooks run on every save, and errors block approval |
| Stage transitions | Confirmed in chat | Approval is recorded with document hashes. Later-stage documents **cannot be written** before approval |
| Link to code | Task checkboxes | Test names `R{N}-{M}` and branch comments `// R{N}-{M}` produce a **trace table** |

## Quick start

You need Claude Code and Node.js 18 or later. There are no packages to install.

```text
/plugin marketplace add b2aconnn/spec-mirror
/plugin install spec-mirror@spec-mirror

/spec-mirror:init
/spec-mirror:spec order Members pick products and pay for an order
/spec-mirror:bugfix confirm-recheck-mismatch Recheck after an unknown result returns 400 instead of 502 on mismatch
```

Claude writes one stage and stops. Reply "승인" (approve) to move on to the next stage. After tasks are approved, run `/spec-mirror:implement <name>` and finish with `/spec-mirror:sync <name>`.

For local development, run `claude --plugin-dir /path/to/spec-mirror`.

## Feature specs

```
docs/spec/<feature>/
├── requirements.md      Introduction · Glossary · Requirements · Open Questions
├── design.md            Overview + table of contents
├── design/01-architecture.md … 08-deployment-configuration.md
├── tasks.md             Overview · Tasks · Notes · Task Dependency Graph
└── .spec-mirror.json    approval record (generated)
```

## Bugfix specs

```
docs/spec/<bug>/
├── bugfix.md            Current Behavior (Defect) · Expected Behavior (Correct) · Unchanged Behavior (Regression Prevention)
├── design.md            Bug Condition (isBugCondition) · Hypothesized Root Cause · Properties · Fix Implementation · Testing Strategy
└── tasks.md             fixed order, described below
```

The tasks always run in this order:

1. **Exploration test** for the bug condition. It must **fail** on the unfixed code. If it passes, Claude stops and re-analyzes the root cause.
2. **Preservation tests.** They must **pass** on the unfixed code.
3. **Fix**, then re-run both test sets.
4. **Spec update.** The feature spec is updated to match the fixed behavior.
5. Checkpoint.

Each expected or unchanged behavior links to the feature criterion that defines it, for example `명세: order 6.21`. Its tests therefore use that criterion's `R{N}-{M}` name.

## Adopting existing code

`/spec-mirror:adopt` turns existing code into feature specs **without changing behavior**.

- **Whole project:** it first writes a spec map (`docs/spec/README.md`). The map lists features, their scope, entry points, related features and order. Once you approve the map, it adopts **one feature at a time**.
- **requirements:** it builds a branch inventory from the code. Every branch becomes one criterion, and the branch-to-criterion table must have no gaps.
- **design:** it describes the current structure.
- **tasks:** adoption work only. Existing tests are renamed to `R{N}-{M}`, missing acceptance tests are added (they must pass on the current code), and branches get `R{N}-{M}` comments.
- Suspected bugs are reported as bugfix candidates and are not fixed during adoption.

## Review

Every stage is reviewed by the independent `spec-reviewer` agent before it is shown to you. Findings are verified before they are applied. A second review runs only when the structure changed, for example when criteria were moved, split, merged or added. The approval request includes a findings table that shows what was applied and why.

## Commands

| Command | Description |
|---|---|
| `/spec-mirror:init` | Create config and spec folder, and add workflow notes to CLAUDE.md |
| `/spec-mirror:spec <name> [stage] [description]` | Feature spec. Continues from the current stage |
| `/spec-mirror:bugfix <name> [stage] [description]` | Bugfix spec. Continues from the current stage |
| `/spec-mirror:adopt [feature] [stage] [description]` | Turn existing code into a feature spec without changing behavior. Without a feature, it starts with the spec map |
| `/spec-mirror:implement <name> [id\|next\|all]` | Implement tasks |
| `/spec-mirror:sync <name> [--report-only]` | Report the trace table, then fix |
| `/spec-mirror:check [name...]` | Format check only |
| `/spec-mirror:status [name]` | Approval state, progress and next step |
| `/spec-mirror:approve <name> [stage]` | Record approval (user only) |

The plugin also includes a `spec-reviewer` agent and three hooks:

- **Stage lock** (before write): blocks writing a stage's document until the earlier stage is approved.
- **Format check** (after write): checks every spec document when it is saved.
- **Session status** (session start): reports specs in progress and what to do next.

## Checker CLI

```bash
node scripts/spec-mirror.mjs check [name...] [--json] [--draft]   # exit 1 on errors
node scripts/spec-mirror.mjs trace <name> [--json]                # exit 1 on mismatches
node scripts/spec-mirror.mjs status|next|gate|approve|scaffold|list|init
```

Rule ID families: `REQ`, `DES`, `TSK` (feature), `BUG`, `BDS`, `BTK` (bugfix) and `MAP` (spec map). Each rule is described at the end of its rule file in [`rules/`](rules/).

## Technology

spec-mirror assumes no language or framework. The design and implement stages discover the stack in this order:

1. The `techContext` documents in the config
2. Build files
3. Existing code and tests
4. Technology skills available in the session
5. The user

## Development

```bash
npm test
claude plugin validate .
```

When the format changes, update `rules/`, `scripts/lib/`, `templates/` and `tests/` together, and keep both examples at zero errors and zero warnings. Versioning follows SemVer. A format change that turns existing documents into errors is a major version.

## License

Copyright (c) 2026 b2aconnn. All rights reserved. Until public release, no part of this software may be copied, modified or distributed without the author's permission. An open source license is planned for the public release. See [LICENSE](LICENSE).
