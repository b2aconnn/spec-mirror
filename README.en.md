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

It creates `.spec-mirror/config.json` and the spec folder `docs/spec/`.

## Usage

### Build a feature

```text
/spec-mirror:spec order Members pick products and pay for an order
```

1. Claude writes the **requirements** (`requirements.md`) and stops.
2. Review them. Ask for changes, or reply **"승인"** (approve).
3. After approval it writes the **design** (`design.md`). After the next approval it writes the **tasks** (`tasks.md`).
4. Once the tasks are approved, implement:

```text
/spec-mirror:implement order        next task (test first, then code)
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

## How it works

- **You approve every stage.** Claude never moves on by itself, and later-stage documents are locked until the earlier stage is approved.
- **The format is checked automatically** on every save, and Claude fixes errors right away.
- **A separate reviewer agent** reads each stage independently. Its findings, and what was done with them, are shown when Claude asks for approval.
- **Spec and code are linked by number.** One criterion maps to one test (`R1-2 …`) and one code branch (`// R1-2`). `/spec-mirror:sync` finds the gaps.

## Commands

| Command | What it does |
|---|---|
| `/spec-mirror:init` | Set up the project |
| `/spec-mirror:spec <name> [description]` | Feature spec (call again for the next stage) |
| `/spec-mirror:bugfix <name> [description]` | Bugfix spec (call again for the next stage) |
| `/spec-mirror:adopt [feature]` | Turn existing code into a spec |
| `/spec-mirror:implement <name> [next\|all\|id]` | Implement tasks |
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
