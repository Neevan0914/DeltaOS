# DeltaOS

A full-screen, glassmorphic simulated desktop operating system with a built-in **Claude** AI assistant.
Built with Electron, React, TypeScript and Tailwind CSS, and shipped as a single portable Windows executable.

**Run it:** download **`DeltaOS.exe`** from this folder and double-click it. No installation is needed.
On GitHub, open `DeltaOS.exe` and click **Download raw file** (the ↓ icon). `npm run dist:win` rebuilds it.

> The exe is unsigned, so Windows SmartScreen may show "Windows protected your PC" the first time.
> Click **More info → Run anyway**. The portable exe unpacks itself to a temp folder on each launch,
> so startup takes a few seconds.

## Features

- **Boot sequence and lock/login screen.** A kernel-style boot log, an animated logo and progress bar,
  a lock-screen clock, and sign-in with an optional password.
- **Window manager.** Drag, resize from any edge or corner, minimize (animates to the taskbar),
  maximize (also by double-clicking the title bar), and snap to the left or right half or to
  full screen by dragging a window to a screen edge.
- **Taskbar.** Frosted glass, with a Start menu (search across apps and files, or ask Claude),
  pinned and running apps, a live clock and a calendar flyout.
- **Desktop.** App shortcuts plus the contents of `~/Desktop`. Right-click to create files and
  folders, rename, delete or personalize.
- **Apps**
  - **Terminal:** `help`, `ls [-a] [-l]`, `cd`, `pwd`, `cat`, `mkdir [-p]`, `touch`, `rm [-r]`, `mv`,
    `echo … > file`, `tree`, `clear`, `theme`, `open`, `edit`, `write`, `browse`, `ask`, `neofetch`, `history`,
    `whoami`, `date`. It also has history (↑/↓), Tab completion and four color schemes.
  - **Files:** sidebar places, breadcrumbs, back/forward/up, grid and list views, search,
    drag-and-drop moving, and inline rename.
  - **Tesseract:** a web browser with tabs, an address bar that also searches (Google, DuckDuckGo
    or Bing), back/forward/reload, a new-tab page, bookmarks (Ctrl+D) and a bookmarks bar, zoom,
    and a right-click menu. Pages open in a sandboxed `<webview>` with its own session.
    HTML files from DeltaOS open rendered here: double-click one in Files, type its path
    (e.g. `~/Code/index.html`) in the address bar, or press the globe button in Code.
  - **App Store:** 24 free web apps (VS Code for the Web, Microsoft 365, Photopea, Canva, Excalidraw,
    Discord, WhatsApp Web, YouTube, Lichess, Duolingo, Claude and more). Installing one puts it on
    the desktop and in Start, and it opens in its own window with no browser bars and its own
    sign-in, separate from Tesseract. Links to other sites open in Tesseract, sign-in pop-ups open
    as small login windows, and uninstalling removes the app's data. These are web apps; Windows
    programs and DRM-only services (Spotify, Netflix) can't run in DeltaOS.
  - **Games:** the Anyware Studios itch.io page (anyware-studios.itch.io) as its own app, with no
    browser controls apart from a small back/home button once you open a game. It stays locked to
    that page and its game pages: links to the rest of itch.io or other sites are refused (enforced
    in the main process), and it never opens Tesseract. Games can go full screen.
  - **Code:** a code editor with a language picker for **Python, C++, HTML, JavaScript, TypeScript
    and C#**. It has syntax highlighting, starter templates, a live preview for HTML, and
    **Run** (Ctrl+Enter) for JavaScript and TypeScript, with console output in a panel. It also has
    line numbers, auto-indent, quick open (Ctrl+O), save (Ctrl+S) and save as (Ctrl+Shift+S).
  - **Folio:** a distraction-free writing app. `.md`, `.txt` and other document files open here.
    It has Write, Split and Read views, a formatting toolbar (headings, bold, italic, lists,
    checklists, quotes, links), list continuation, serif/sans/mono fonts, word count and reading
    time, and autosaves documents that have already been saved once.
  - **Settings:** dark/light theme, accent colors (presets or any custom color), 9 gradient
    wallpapers, transparency and animation toggles, a 24-hour clock, account name and password,
    and the Claude API key.
  - **Calculator** and **About**.
- **Claude assistant.** Open it with the taskbar button or **Ctrl+Space**. Claude can answer
  questions and control the OS through tools: theme, accent, wallpaper and preferences, opening
  and closing apps, opening web pages in Tesseract, and reading, writing and organising files.
- **Downloads stay inside DeltaOS.** Anything downloaded in Tesseract or Games is saved without a
  Windows "Save as" dialog into DeltaOS's own `~/Downloads`, never your PC's Downloads folder.
  Tesseract has a downloads button with progress and cancel. Small text files become normal files
  you can open in Code, Folio or Terminal. Images, video and audio open in Tesseract. Other files
  (zips, installers) can be copied to your real PC only on request: right-click → **Export to this
  PC…** in Files. The bytes of binary downloads live in DeltaOS's private data folder
  (`%APPDATA%\DeltaOS\vfs-blobs`), like a virtual disk, and are removed when you delete the file
  inside DeltaOS.
- **Zip files.** Double-click a `.zip`, right-click → **Extract here** in Files, or run `unzip` in
  Terminal. Extracted HTML5 games and web pages run in Tesseract: DeltaOS serves each folder like a
  small web server, so scripts, images and WebAssembly next to `index.html` load (with
  cross-origin isolation for threaded engines such as Godot 4). A page can only read files from its
  own folder.
- **Persistence.** Settings and the virtual filesystem are saved automatically to
  `%APPDATA%\DeltaOS\deltaos-state.json`.

### Connecting Claude

The assistant works in **offline mode** out of the box. Offline, it understands system commands
such as "switch to light mode with the nebula wallpaper" or "open the terminal".

For full conversations, add an Anthropic API key in **Settings → Claude AI**, or set the
`ANTHROPIC_API_KEY` environment variable before launching. Where the OS keychain is available,
the key is encrypted with it (Electron `safeStorage`). The key stays in the main process and is
never exposed to the UI. The assistant uses `claude-opus-5-5` with streaming, tool use and
server-side refusal fallbacks.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Space | Toggle the Claude assistant |
| Ctrl+Alt+T | New Terminal |
| Ctrl+Alt+E | New Files window |
| F11 | Toggle full screen |
| Alt+F4 | Quit DeltaOS |

## Development

Requires Node.js 20 or later.

```bash
npm install
npm start            # build and launch in Electron
npm run dev          # renderer only, in a browser (localStorage persistence, offline assistant)
npm run dist:win     # build the portable DeltaOS.exe and copy it to the project root
```

Set `DELTAOS_WINDOWED=1` to launch in a window instead of full screen.

Cross-building the Windows exe from Linux or macOS needs no Wine. The `afterPack` hook
(`scripts/after-pack.cjs`) stamps the icon and version info with the pure-JS `resedit` library.
If something misbehaves, **Settings → System → Diagnostics log** opens
`%APPDATA%\DeltaOS\logs\deltaos.log`, which records page loads, page crashes and graphics info.

### Layout

```
electron/        main process (window, persistence, Claude API calls) + preload bridge
shared/ipc.ts    types shared across processes
src/os/          store, virtual filesystem, window manager, assistant (agent loop + tools)
src/components/  boot, login, desktop, window chrome, taskbar, start menu, assistant panel
src/apps/        Terminal, Files, Tesseract browser, Code editor (+ runner), Folio, Settings, Calculator, About
scripts/         build helpers (electron bundling, icon generation, exe post-processing)
```
