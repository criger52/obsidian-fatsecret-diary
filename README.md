# FatSecret Diary for Obsidian

Import your [FatSecret](https://www.fatsecret.com/) food diary into an Obsidian note. One click on the ribbon icon writes today's nutrition summary as a Markdown table.

## Features

- **OAuth 1.0a authorization** — sign in once, tokens are stored in the plugin settings.
- **Flexible destination** — write to the active note, a dedicated file, or today's daily note.
- **Customizable metrics** — pick which columns to show: calories, macros, sugar, fiber, cholesterol, sodium, potassium, vitamins and more.
- **Idempotent output** — repeated runs replace the previous block instead of appending duplicates.
- **Auto-created files** — a dedicated file or daily note is created automatically if missing.

## Installation

### From source (developer)

```bash
git clone https://github.com/your-username/obsidian-fatsecret-diary.git
cd obsidian-fatsecret-diary
npm install
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` (if present) into:

```
<your-vault>/.obsidian/plugins/fatsecret-diary/
```

Then enable the plugin in **Settings → Community plugins**.

### Manual

Download `main.js` and `manifest.json` from the latest release, put them in `.obsidian/plugins/fatsecret-diary/`, enable the plugin.

## Setup

### 1. Get a FatSecret API key

1. Sign up at [platform.fatsecret.com](https://platform.fatsecret.com/).
2. Go to **My Account → API Keys**.
3. Copy your **Consumer Key** and **Consumer Secret** (OAuth 1.0a, not OAuth 2.0).

### 2. Configure the plugin

Open **Settings → Community plugins → FatSecret Diary**:

- Paste `Consumer Key` and `Consumer Secret`.
- Click **Authorize**.
- A browser window opens on FatSecret. Sign in, approve access, copy the verifier code.
- Paste the verifier into the modal in Obsidian and hit **Save**.

You should see **✅ Authorized** in the settings.

### 3. Pick the output destination

- **Active note** — writes into whatever note is currently open.
- **Dedicated file** — writes into a fixed file. Set the path; folders are created automatically.
- **Daily note** — writes into today's daily note. Uses the folder, format and template from the built-in **Daily Notes** plugin.

### 4. Pick metrics

Toggle which values to include in the tables. Recommended set: Calories, Carbs, Protein, Fat, Sugar.

## Usage

- Click the **dice ribbon icon** in the left sidebar, or
- Run **FatSecret Diary: Write today's diary** from the command palette (`Ctrl/Cmd + P`).

The output looks like this:

```markdown
## 🍽 FatSecret — 2026-09-26

| Total | Calories | Carbs | Protein | Fat | Sugar |
|---|---:|---:|---:|---:|---:|
| **Day total** | **1800** | **200.0 g** | **120.0 g** | **70.0 g** | **45.0 g** |

### 🌅 Breakfast — 370 kcal

| Food | Kcal | Carbs | Protein | Fat | Sugar |
|---|---:|---:|---:|---:|---:|
| Oatmeal | 300 | 50.0 | 10.0 | 5.0 | 12.0 |
| Egg | 70 | 0.5 | 6.0 | 5.0 | 0.3 |
```

The block is wrapped in HTML comment markers:

```html
<!-- FATSECRET:START -->
...content...
<!-- FATSECRET:END -->
```

The markers let the plugin find and replace the previous output on subsequent runs. Anything you write outside the markers is left untouched.

## Commands

| Command | Description |
|---|---|
| **Write today's diary** | Fetch the diary and write it to the configured destination. |
| **Authorize** | Start the OAuth 1.0a flow. |

## Privacy

- Consumer key/secret and access tokens are stored in the plugin's `data.json` inside your vault.
- Requests go directly from your machine to `platform.fatsecret.com`. No third-party server involved.
- No telemetry, no analytics, no external logging.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid consumer key` | Wrong key or OAuth 2.0 key instead of OAuth 1.0a | Double-check the key from **API Keys** |
| `Invalid signature` | Wrong consumer secret or missing access token | Re-run authorization |
| `food_entries: null` | No diary entries for the requested date | Log a meal in FatSecret or pick another date |
| `No active note` | Active note mode but no note open | Open a note or switch to file/daily mode |
| Browser does not open | Electron blocked `window.open` | Copy the URL from the notice / console and open manually |

Enable the developer console (`Ctrl/Cmd + Shift + I`) to see detailed errors.

## Development

```bash
npm install
npm run dev     # watch mode
npm run build   # production build
```

## License

MIT