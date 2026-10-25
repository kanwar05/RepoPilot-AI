# RepoPilot AI

Offline-first CLI automation for routine Git chores. RepoPilot never commits, pushes,
uploads repository data, or overwrites files.

## Current implementation

The first slice provides `suggest-commit`, which reads only `git diff --cached` and
asks a local Ollama instance for one validated Conventional Commit suggestion.
Untracked files are not read. Empty staged diffs, unavailable Ollama, oversized diffs,
and malformed model responses produce explicit errors.

For a detailed explanation of the folders, runtime flow, modules, functions,
testing, and extension guidelines, see the
[developer guide](docs/README.md).

## Setup

Requirements: Node.js 20+, Git, and [Ollama](https://ollama.com/) with
`qwen2.5-coder:7b` installed.

```powershell
npm install
npm run build
ollama pull qwen2.5-coder:7b
```

## Usage

Stage the intended changes, then run:

```powershell
node .\dist\cli.js suggest-commit
node .\dist\cli.js suggest-commit --json
node .\dist\cli.js suggest-commit --model qwen2.5-coder:7b --max-diff-chars 12000
```

The command prints a suggestion only; accepting or applying it remains a manual
step. `--ollama-url` is available for a locally hosted Ollama endpoint, and defaults
to `http://127.0.0.1:11434`.

Generate a Markdown changelog preview from recent commits:

```powershell
node .\dist\cli.js generate-changelog
node .\dist\cli.js generate-changelog --since v1.0.0 --max-commits 50
node .\dist\cli.js generate-changelog --json
```

The changelog command reads commit subjects and bodies with safe Git argument arrays,
limits history to 100 commits by default (maximum 500), and asks Ollama to cite the
source commit hashes for every note. It prints a preview only: it never edits
`CHANGELOG.md`, commits, or pushes. Invalid Git references, empty history, unavailable
Ollama, malformed model JSON, and entries citing unknown commits are reported as
errors. Large histories are bounded by `--max-commits`; model context size may still
limit the useful detail in a very large request.

Suggest targeted README updates from the staged diff:

```powershell
node .\dist\cli.js suggest-readme
node .\dist\cli.js suggest-readme --json
node .\dist\cli.js suggest-readme --max-diff-chars 12000
```

The README assistant reads `README.md` and staged changes, filters obvious
credential and environment-file paths, and prints a preview with section names,
changes, and evidence quotes. It never edits, deletes, commits, or pushes files.
Suggestions are rejected when the model returns invalid JSON, an unknown section,
or evidence that cannot be traced to the supplied content. Evidence is
source-tagged (`readme` or `diff`), and non-empty suggestions must cite an exact
added line from the staged diff; the quote may omit only Git's leading `+`
marker. Missing README files, empty or unsafe diffs,
truncated evidence, and unreachable Ollama are reported as errors. If the model
produces an unverifiable suggestion, RepoPilot makes one conservative retry that
requests an empty result rather than accepting the claim. A truncated diff can
reduce the quality of suggestions; review the preview manually before changing
documentation.

## Design notes

- Git is invoked with argument arrays rather than shell strings to avoid shell
  interpretation and destructive operations.
- The model receives a bounded staged diff and a strict JSON contract. Parsing and
  validation happen before output.
- The default endpoint is loopback. No cloud provider or telemetry dependency is
  included.
