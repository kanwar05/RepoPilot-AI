# RepoPilot AI

RepoPilot AI is a read-only command-line assistant for three Git chores:

- suggest a Conventional Commit message from the staged diff;
- generate categorized release-note drafts from Git history; and
- suggest targeted README updates from the staged diff.

It uses a local [Ollama](https://ollama.com/) model by default. RepoPilot prints
previews and validated suggestions; it does not edit files, create commits, push
branches, or publish changes for you.

## Requirements

- Node.js 20 or newer
- Git 2.20 or newer
- Ollama running locally
- An Ollama model, such as `qwen2.5-coder:7b`

## Installation

Once the package is available from npm, install the CLI globally:

```powershell
npm install --global repopilot-ai
repopilot --help
```

To try a packed build without publishing it:

```powershell
npm install
npm run build
npm pack --dry-run
npm install --global .\repopilot-ai-0.1.0.tgz
repopilot --help
```

For a checkout, `npm run build` creates the executable at `dist/cli.js`. You can
run it directly without a global install:

```powershell
node .\dist\cli.js --help
```

The package exposes the `repopilot` bin entry and includes only compiled output,
the README, the MIT license, and the demo script. `src/`, tests, and development
configuration are not published.

## Ollama setup

Install Ollama using the instructions for your operating system, then start it
and download the model:

```powershell
ollama pull qwen2.5-coder:7b
```

The commands use `http://127.0.0.1:11434` by default. You can select another
Ollama-compatible endpoint with `--ollama-url`; do not use a remote endpoint if
repository privacy is required. RepoPilot has no cloud AI SDK, telemetry, or
remote model integration of its own.

## Commands

Run commands from inside a Git repository. Options are shown with
`repopilot <command> --help`.

### `suggest-commit`

Reads only `git diff --cached` and prints one Conventional Commit suggestion.
Stage the intended changes first:

```powershell
git add README.md src\cli.ts
repopilot suggest-commit
repopilot suggest-commit --json
repopilot suggest-commit --model qwen2.5-coder:7b --max-diff-chars 12000
```

The suggestion is not applied automatically. `--max-diff-chars` bounds the
staged diff sent to Ollama and defaults to `12000`.

### `generate-changelog`

Reads commit subjects and bodies from Git history and prints categorized release
notes. It does not edit `CHANGELOG.md`:

```powershell
repopilot generate-changelog
repopilot generate-changelog --since v1.0.0 --max-commits 50
repopilot generate-changelog --json
```

The default limit is 100 commits; the accepted range is 1 to 500. Every
non-empty generated note must cite a commit hash supplied to the model.

### `suggest-readme`

Reads `README.md` and the staged diff, then prints evidence-backed suggestions
for targeted documentation updates:

```powershell
git add package.json scripts\demo.mjs
repopilot suggest-readme
repopilot suggest-readme --json
```

Suggestions must name an existing Markdown heading or a new section and cite an
exact added line from the staged diff. Obvious environment files and credential
assignments are filtered before the prompt is sent.

### Demo

After staging a meaningful change and starting Ollama, run:

```powershell
npm run demo
```

The demo invokes all three commands in sequence and stops on the first command
that fails. It is a convenience script, not a test fixture.

## Architecture

```text
Commander CLI (src/cli.ts)
        |
        +--> Git read boundary (src/git.ts)
        |       git diff --cached / git log
        |
        +--> Prompt and validation modules
        |       commit-generator.ts
        |       changelog-generator.ts
        |       readme-assistant.ts
        |
        +--> LocalOllamaClient (src/ollama.ts)
                POST /api/generate
                default: 127.0.0.1:11434
```

Git commands use argument arrays rather than shell strings. Model responses are
parsed and validated before they are printed. The CLI performs no write
operation against the repository: there is no file write, `git commit`, or
`git push` path in the command handlers.

## Limitations and privacy

- This tool requires a working Git repository for all three commands.
- `suggest-commit` and `suggest-readme` require a non-empty staged diff.
- `generate-changelog` requires at least one commit in the selected range.
- Model quality depends on the selected local model and the amount of context
  allowed by the relevant limit.
- Truncated diffs can reduce suggestion quality; review every preview manually.
- Malformed, uncited, or untraceable model output is rejected.
- README suggestions are previews only and never rewrite `README.md`.
- The default model endpoint is local. The `--ollama-url` option can point to
  another endpoint, so users must verify that endpoint before sending
  repository content.
- No live model result is bundled with this documentation; run Ollama locally
  to exercise model-backed commands.

## Troubleshooting

### `Cannot reach local Ollama`

Start Ollama and verify the model is installed:

```powershell
ollama list
ollama pull qwen2.5-coder:7b
```

If Ollama is listening on another trusted local address, pass it explicitly:

```powershell
repopilot suggest-commit --ollama-url http://127.0.0.1:11434
```

### `No staged changes found`

RepoPilot intentionally ignores unstaged and untracked files for diff-based
commands:

```powershell
git status
git add path\to\the\intended-file
```

### `Unable to read ... Git`

Change into the repository that contains the desired history and verify Git:

```powershell
git rev-parse --show-toplevel
git status
```

For changelogs, also verify that `--since` names an existing reference.

### Malformed or rejected model output

The selected model did not satisfy the command's JSON and evidence contract.
Try a model that follows JSON instructions more reliably, reduce the scope of
the staged diff or commit range, and inspect the command's error before trying
again.

## Development

```powershell
npm install
npm run build
npm test
git diff --check
npm pack --dry-run
```

The project is licensed under the [MIT License](LICENSE).
