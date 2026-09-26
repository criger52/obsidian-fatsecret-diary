import { App, Modal, Notice, Plugin, Setting, TFile, normalizePath } from "obsidian";
import {
    DEFAULT_SETTINGS,
    FatsecretSettings,
    FatsecretSettingTab,
} from "./settings";
import {
    getDiaryEntries,
    formatDiary,
    FatSecretCredentials,
    getRequestToken,
    getAccessToken,
} from "./fatsecret";

const BLOCK_START = "<!-- FATSECRET:START -->";
const BLOCK_END = "<!-- FATSECRET:END -->";

class VerifierModal extends Modal {
    private value = "";
    private onSubmit: (value: string) => void;

    constructor(app: App, onSubmit: (value: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h2", { text: "Fatsecret authorization" });
        contentEl.createEl("p", {
            text: "Sign in to fatsecret in your browser, approve access, then paste the verifier code below.",
        });

        new Setting(contentEl)
            .setName("Verifier")
            .addText((text) =>
                text.onChange((v) => {
                    this.value = v.trim();
                })
            );

        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText("Save")
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onSubmit(this.value);
                })
        );
    }

    onClose() {
        this.contentEl.empty();
    }
}

export default class FatsecretDiaryPlugin extends Plugin {
    settings!: FatsecretSettings;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon("dice", "Fatsecret: write today's diary", () => {
            void this.runDiary();
        });

        this.addCommand({
            id: "write-diary",
            name: "Write today's diary",
            callback: () => {
                void this.runDiary();
            },
        });

        this.addCommand({
            id: "authorize",
            name: "Authorize",
            callback: () => {
                void this.startAuthorization();
            },
        });

        this.addSettingTab(new FatsecretSettingTab(this.app, this));
    }

    onunload() {}

    async loadSettings() {
        const data = (await this.loadData()) as Partial<FatsecretSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        this.settings.metrics = Object.assign(
            {},
            DEFAULT_SETTINGS.metrics,
            data?.metrics ?? {}
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private hasCredentials(): boolean {
        return Boolean(
            this.settings.consumerKey &&
            this.settings.consumerSecret &&
            this.settings.oauthToken &&
            this.settings.oauthTokenSecret
        );
    }

    async runDiary() {
        if (!this.settings.consumerKey || !this.settings.consumerSecret) {
            new Notice("Fatsecret: set consumer key and secret in settings first");
            return;
        }

        if (!this.hasCredentials()) {
            new Notice("Fatsecret: authorization required, opening...");
            const ok = await this.startAuthorization();
            if (!ok) {
                new Notice("Fatsecret: authorization cancelled");
                return;
            }
        }

        try {
            const creds: FatSecretCredentials = {
                consumerKey: this.settings.consumerKey,
                consumerSecret: this.settings.consumerSecret,
                oauthToken: this.settings.oauthToken,
                oauthTokenSecret: this.settings.oauthTokenSecret,
            };
            const diary = await getDiaryEntries(creds, new Date());
            const text = formatDiary(diary, new Date(), this.settings.metrics);
            await this.writeToTarget(text);
            new Notice("Fatsecret: diary written");
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(e);
            new Notice(`Fatsecret error: ${msg}`);
        }
    }

    private async writeToTarget(text: string) {
        const wrapped = `${BLOCK_START}\n${text}\n${BLOCK_END}`;
        const mode = this.settings.targetMode;

        if (mode === "active") {
            const file = this.app.workspace.getActiveFile();
            if (!file) {
                new Notice("No active note");
                return;
            }
            await this.upsertBlock(file, wrapped);
            return;
        }

        if (mode === "daily") {
            const file = await this.getOrCreateDailyNote();
            if (!file) {
                new Notice("Could not open daily note. Check daily notes settings.");
                return;
            }
            await this.upsertBlock(file, wrapped);
            return;
        }

        // mode === "file"
        const path = normalizePath(this.settings.targetFile || "FatSecret Diary.md");
        let file = this.app.vault.getAbstractFileByPath(path);

        if (!(file instanceof TFile)) {
            const folder = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
            if (folder) {
                const folderExists = this.app.vault.getAbstractFileByPath(folder);
                if (!folderExists) {
                    await this.app.vault.createFolder(folder);
                }
            }
            file = await this.app.vault.create(path, "");
        }

        if (file instanceof TFile) {
            await this.upsertBlock(file, wrapped);
        }
    }

    /**
     * Replaces the existing marked block, or appends a new one if absent.
     */
    private async upsertBlock(file: TFile, block: string) {
        const content = await this.app.vault.read(file);
        const startIdx = content.indexOf(BLOCK_START);
        const endIdx = content.indexOf(BLOCK_END);

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const before = content.slice(0, startIdx);
            const after = content.slice(endIdx + BLOCK_END.length);
            await this.app.vault.modify(file, before + block + after);
        } else {
            const sep = content.endsWith("\n") || content.length === 0 ? "" : "\n";
            await this.app.vault.modify(file, content + sep + "\n" + block + "\n");
        }
    }

    /**
     * Returns today's daily note, creating it from the Daily Notes config if needed.
     */
    private async getOrCreateDailyNote(): Promise<TFile | null> {
        const configPath = normalizePath(`${this.app.vault.configDir}/daily-notes.json`);

        let folder = "";
        let format = "YYYY-MM-DD";
        let template = "";

        try {
            const raw = await this.app.vault.adapter.read(configPath);
            const cfg = JSON.parse(raw) as {
                folder?: string;
                format?: string;
                template?: string;
            };
            folder = cfg.folder ?? "";
            format = cfg.format ?? "YYYY-MM-DD";
            template = cfg.template ?? "";
        } catch {
            // no config — use defaults
        }

        const fileName = window.moment().format(format);
        const path = normalizePath(folder ? `${folder}/${fileName}.md` : `${fileName}.md`);

        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
            return existing;
        }

        if (folder) {
            const folderExists = this.app.vault.getAbstractFileByPath(folder);
            if (!folderExists) {
                await this.app.vault.createFolder(folder);
            }
        }

        let content = "";
        if (template) {
            const tplPath = normalizePath(template.endsWith(".md") ? template : `${template}.md`);
            const tplFile = this.app.vault.getAbstractFileByPath(tplPath);
            if (tplFile instanceof TFile) {
                content = await this.app.vault.read(tplFile);
            }
        }

        try {
            return await this.app.vault.create(path, content);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    async startAuthorization(): Promise<boolean> {
        const { consumerKey, consumerSecret } = this.settings;
        if (!consumerKey || !consumerSecret) {
            new Notice("Fatsecret: set consumer key and secret first");
            return false;
        }

        try {
            new Notice("Fatsecret: requesting token...");
            const req = await getRequestToken(consumerKey, consumerSecret);

            window.open(req.authorizeUrl, "_blank");

            const verifier = await new Promise<string>((resolve) => {
                new VerifierModal(this.app, (v) => resolve(v)).open();
            });

            if (!verifier) return false;

            const acc = await getAccessToken(
                consumerKey,
                consumerSecret,
                req.oauthToken,
                req.oauthTokenSecret,
                verifier
            );

            this.settings.oauthToken = acc.oauthToken;
            this.settings.oauthTokenSecret = acc.oauthTokenSecret;
            await this.saveSettings();

            new Notice("Fatsecret: authorized");
            return true;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(e);
            new Notice(`Fatsecret authorization error: ${msg}`);
            return false;
        }
    }
}