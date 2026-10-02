# VS Code

Visual Studio Code (VS Code) is the editor Szop is developed in. The repository shares its settings and recommended extensions, so every contributor's editor formats, lints and type-checks the code the same way the command line does.

## Why Szop uses it

- **VS Code, connected to WSL:** [ADR 0005](../../decisions/0005-development-environment.md), decision 14. The code lives in Windows Subsystem for Linux (WSL), where Node, pnpm and git run; the WSL extension lets VS Code, which runs on the Windows side, edit those files and run its terminal and extensions inside WSL.
- **Shared settings, not personal ones:** the settings are committed in `.vscode/`, so the editor does what [Prettier](prettier.md) and [ESLint](eslint.md) do in the pre-commit hook, and a file is already clean when it is committed. Without them everyone would configure the editor alone and the settings would drift.
- **No `.editorconfig`:** the file would only repeat what Prettier already decides (indentation, line endings, final newline), and two sources of formatting rules can disagree.

## Configuration

**`.vscode/extensions.json`** lists the extensions VS Code offers to install when the repository is opened:

- `dbaeumer.vscode-eslint`: ESLint, showing its findings in the editor as you type.
- `esbenp.prettier-vscode`: Prettier, formatting files from the editor.
- `ms-azuretools.vscode-containers`: Container Tools, for working with Docker containers and images from the editor (Docker arrives with the database in PH-04 and the container image in PH-08).

The WSL extension is installed on the Windows side and is not in the list: it is needed before the repository can be opened at all. The test tool extensions arrive with the test tools (PH-03 and PH-07), and Tailwind CSS IntelliSense with the styling in PH-14.

**`.vscode/settings.json`** holds the workspace settings, which apply to this repository only:

- `"editor.defaultFormatter": "esbenp.prettier-vscode"`: Prettier formats every file it supports.
- `"editor.formatOnSave": true`: saving a file formats it. Markdown is not formatted, because Prettier skips what `.prettierignore` lists, and that includes `*.md`.
- `"editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" }`: saving also applies ESLint's automatic fixes. `explicit` means on a manual save only, not on auto-save, so the editor does not rewrite code while you are still typing.
- `"typescript.tsdk": "node_modules/typescript/lib"`: the editor uses the TypeScript version installed by `pnpm install` (see [TypeScript](typescript.md)), not the one bundled in VS Code, so what the editor reports matches `pnpm typecheck`.
- `"typescript.enablePromptUseWorkspaceTsdk": true`: asks you once to switch to that version, instead of switching silently.

## Everyday use

```bash
code .    # run in the repository inside WSL: opens VS Code connected to WSL
```

- On first open, accept **Install** on the prompt for the recommended extensions.
- On first opening a TypeScript file, accept **Use Workspace Version** on the TypeScript prompt. The status bar then shows the workspace's TypeScript version (6.0).
- Saving a `.ts` file formats it with Prettier and applies ESLint's fixes; findings ESLint cannot fix stay underlined for you to deal with.
- If the editor seems to ignore the settings, check that the window says `WSL: Ubuntu` at the bottom left, and that the ESLint and Prettier extensions are enabled in WSL, not only on the Windows side.

## Official documentation

- Developing in WSL: <https://code.visualstudio.com/docs/remote/wsl>
- Workspace settings: <https://code.visualstudio.com/docs/configure/settings#_workspace-settings>
- Using the workspace version of TypeScript: <https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript>
