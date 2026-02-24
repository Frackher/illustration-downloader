# Illustration Downloader

Chrome/Brave extension to easily save illustrations from **X.com** and **Pixiv**.

**Documentation:** [English](README.en.md) | [Français](README.md) — The extension UI is available in French, English, Japanese, Korean, Chinese, and Spanish (`_locales/`). **Doc translations** (README, tests) into other languages are welcome (ja, ko, zh_CN, es, etc.).

- **Author:** Fracker (with Cursor)
- **Version:** 0.6.0 (pre-release, no public release) — [SemVer](https://semver.org/)

## Installation

1. Open `chrome://extensions` (or `brave://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `imgDownloader` folder.

## Usage

- **Clicking the extension icon** opens the **settings page**.
- **X.com:** a **↓** button appears on tweet images. **Pixiv:** same button on artwork page images.
- Images are saved to **Downloads\[subfolder]\landscape**, **portrait**, or **square** by aspect ratio (or **nsfw** if option enabled).
- File name: `YYYYMMDD_platform_artistName.ext` — `platform` is `x` or `pixiv`. On duplicate, the browser renames (e.g. `file (1).jpg`).
- **Pixiv:** downloaded image is in **original format** (img-original); author and artwork title are detected from the page.
- **Metadata (0.5+):** for **JPEG** images, the extension writes EXIF metadata: download date, author (username), source (post URL), description (tweet text). Other formats (PNG, WebP, etc.) are saved without changing metadata.

## Settings (dedicated page)

All settings are on a single page (opened by clicking the icon or via Right-click → Options):

- **Custom folder (0.2+):** **Choose folder…** to save images to a folder of your choice (e.g. `C:\Images`), with subfolders `landscape`, `portrait`, `square`.  
  - **Chrome / Edge:** works out of the box.  
  - **Brave:** enable the **File System Access API** flag: `brave://flags/#file-system-access-api` → Enabled → restart Brave. Without this flag, the “Custom folder” block does not appear and only the Downloads subfolder is used.
- **Downloads subfolder:** used when no custom folder is set (e.g. `Illustrations` → `Downloads\Illustrations\landscape`, etc.).
- **Ask where to save each time:** if checked, the “Save as” dialog opens for each download. Unchecked by default.
- **Square format (tolerance):** min/max ratio to treat an image as square (default 0.9–1.1).

- **NSFW illustrations:** if enabled, a second button (🔞, pink background) appears to the left of the download button. Clicking it saves the image to the **nsfw** folder (no landscape/portrait/square split).

Remember to click **Save** after changing settings.

## Tests (critical paths)

To avoid regressions (e.g. buttons no longer showing):

- **Windows:** install Node.js once (e.g. `winget install OpenJS.NodeJS.LTS` or [nodejs.org](https://nodejs.org/)), then double-click **`run-tests.bat`** or run `npm install` then `npm test` in the project folder.
- **Other:** `npm install` then `npm test`.

- **i18n:** `init()` always resolves, `t()` returns messages, fallback if fetch fails.
- **Content overlay:** callback like `init().then(addButtons, addButtons)` does call `addButtons` (on resolve or reject).
- **Background:** `getFormatFolder`, `getExtensionFromUrl`, `safeFilenamePart`.
- **_locales:** critical keys present in all languages, messages with `$1$` have `placeholders` defined.

**Maintenance:** see **[tests/README](tests/README.en.md)** ([FR](tests/README.md)) for running tests, updating them, and reminders on critical paths (overlay buttons, i18n).

## Files

- `manifest.json` – Manifest V3 (0.2: + offscreen for custom folder)
- `js/background.js` – Download, format (landscape/portrait/square), EXIF injection (0.5), offscreen write for custom folder
- `js/lib/piexif.js` – EXIF library (JPEG metadata writing)
- `js/i18n.js` – Internationalisation (auto / custom language)
- `js/content.js` + `css/content.css` – Overlay on X.com and Pixiv images
- `options/options.html` + `js/options.js` + `css/options.css` – Settings page
- `offscreen.html` + `js/offscreen.js` – File writing to chosen folder (File System Access API)
- `tests/` – Vitest tests (critical paths)

## Versioning (SemVer)

The project follows [Semantic Versioning](https://semver.org/) (SemVer): **MAJOR.MINOR.PATCH**.

| Part       | Role |
|-----------|------|
| **MAJOR** | Incompatible changes (user-facing behaviour or “API” broken). |
| **MINOR** | New backward-compatible features. |
| **PATCH** | Backward-compatible bug fixes. |

During pre-release (no public release), the version stays **0.MINOR.PATCH**: major 0 means any update may still introduce incompatible changes. When going public, the version can move to **1.0.0** and SemVer applies fully.

Examples: 0.6.0 → 0.6.1 (fix), 0.6.1 → 0.7.0 (feature), 0.x.x → 1.0.0 (public release).

## Release

Version history (SemVer, see Versioning section above).

| Version | Date       | Changes |
|---------|------------|---------|
| 0.6.0   | 2025-02-15 | **Pixiv** support (original format, master fallback on 404). Author from DOM block + metadata “… by Author”. Referer via declarativeNetRequest. No overlay on avatars. |
| 0.5.0   | 2025-02-15 | **EXIF + XMP metadata** (date, author, source, description). UTF-8 for Japanese and other languages. X author from URL on photo view. |
| 0.4.0   | 2025-02-11 | **NSFW** option (🔞 button, nsfw folder). **Square format** tolerance configurable. |
| 0.3.0   | 2025-02-11 | Configurable Downloads subfolder. “Ask where to save each time” option. |
| 0.2.0   | 2025-02-11 | **Custom folder** (File System Access API, offscreen document). |
| 0.1.0   | 2025-02-11 | X.com: ↓ overlay on images, landscape/portrait/square folders, name `YYYYMMDD_x_artistName.ext`. i18n, options page. |
