# Tests – Illustration Downloader

Vitest tests for the extension’s **critical paths** (i18n, overlay, background, locales).

**Docs:** [English](README.en.md) | [Français](README.md)

## Windows: install Node.js (one-time)

On Windows, npm comes with Node.js. Just install Node:

1. **With winget** (Windows 10/11, in PowerShell or Command Prompt):
   ```text
   winget install OpenJS.NodeJS.LTS
   ```
   Then close and reopen the terminal.

2. **Or** download the installer from [nodejs.org](https://nodejs.org/) (LTS version), run the .msi and follow the wizard. Check the option that adds Node to PATH.

3. **Or** with Chocolatey: `choco install nodejs-lts`

After installing, check in a new terminal: `node -v` and `npm -v` should show version numbers.

## Running tests

**From the project folder** (`imgDownloader`):

```bash
npm install
npm test
```

On Windows you can also **double-click** `run-tests.bat` at the project root: the script installs dependencies if needed then runs the tests (it uses CMD, not PowerShell).

**If PowerShell says "script execution is disabled"**: use **Command Prompt (CMD)** instead of PowerShell, or run npm explicitly in CMD:
```cmd
cmd /c "cd /d C:\Users\...\imgDownloader && npm.cmd test"
```
Or double-click `run-tests.bat` (which already uses `npm.cmd`).

Watch mode (re-run on file changes):

```bash
npm run test:watch
```

Without npm, if Node is already installed:

```bash
npx vitest run
```

## Maintenance for future devs

### When to update tests

| Change in the project | Test file(s) to update |
|----------------------|------------------------|
| New i18n key used in content script or options | `locales.test.js`: add the key to `CRITICAL_KEYS` if it’s critical for UX. Ensure all `_locales/*/messages.json` include the key. |
| New message with placeholder `$1$` (or `$2$`) | `locales.test.js`: the “messages with $1$ have placeholders defined” test already covers it. Add `placeholders` in each `messages.json` (otherwise Chrome won’t load the extension). |
| Overlay behaviour (buttons, I18N.init) | `content-overlay.test.js` and possibly `i18n.test.js`. Do not remove the `init().then(addButtons, addButtons)` pattern without an equivalent that ensures `addButtons` is always called. |
| Format logic (landscape/portrait/square) or file name in background | `background.test.js`. If new functions are extracted, expose them for tests like `getFormatFolder` / `getExtensionFromUrl` / `safeFilenamePart` (see `tests/setup.js` → `loadBackground()`). |
| New locale (language) | Create `_locales/<code>/messages.json`, then add the code to `LOCALES` in `locales.test.js` and to `SUPPORTED` / `UI_TO_LOCALE` in `i18n.js`. |

### Reminder: “buttons visible” critical path

For download buttons to show on images:

1. **content.js** must call `addButtons()` whether `I18N.init()` resolves or rejects, or call `addButtons()` if `I18N` is absent.
2. **i18n.js**: `init()` must never leave the promise unresolved (always use `try/catch` with fallback, e.g. locale `en` or `messages = {}`).
3. **Mocks**: `tests/setup.js` provides `loadI18n()` and `loadBackground()`; do not break the mocked Chrome API signature (storage.sync.get with callback or promise depending on the file loaded).

### Run tests before commit / PR

Recommendation: run `npm test` before pushing. If tests fail, fix the code or update the tests if the intended behaviour has changed.

### CI (GitHub Actions)

The `.github/workflows/tests.yml` workflow runs tests on every push/PR to `main` or `master`. No action needed if the repo is on GitHub.

---

Tests are designed to **not modify** the extension sources: loading `i18n.js` and `background.js` is done via `eval` in the setup with global mocks (`chrome`, `fetch`), without patching project files.
