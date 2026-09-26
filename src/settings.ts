import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import FatsecretDiaryPlugin from "./main";

export type TargetMode = "active" | "file" | "daily";

export interface MetricConfig {
    calories: boolean;
    carbohydrate: boolean;
    protein: boolean;
    fat: boolean;
    saturatedFat: boolean;
    polyunsaturatedFat: boolean;
    monounsaturatedFat: boolean;
    transFat: boolean;
    cholesterol: boolean;
    sodium: boolean;
    potassium: boolean;
    fiber: boolean;
    sugar: boolean;
    vitaminA: boolean;
    vitaminC: boolean;
    calcium: boolean;
    iron: boolean;
}

export interface FatsecretSettings {
    consumerKey: string;
    consumerSecret: string;
    oauthToken: string;
    oauthTokenSecret: string;
    targetMode: TargetMode;
    targetFile: string;
    alsoYesterday: boolean;
    metrics: MetricConfig;
}

export const DEFAULT_SETTINGS: FatsecretSettings = {
    consumerKey: "",
    consumerSecret: "",
    oauthToken: "",
    oauthTokenSecret: "",
    targetMode: "daily",
    targetFile: "FatSecret Diary.md",
    alsoYesterday: false,
    metrics: {
        calories: true,
        carbohydrate: true,
        protein: true,
        fat: true,
        saturatedFat: false,
        polyunsaturatedFat: false,
        monounsaturatedFat: false,
        transFat: false,
        cholesterol: false,
        sodium: false,
        potassium: false,
        fiber: false,
        sugar: true,
        vitaminA: false,
        vitaminC: false,
        calcium: false,
        iron: false,
    },
};

const METRIC_LABELS: Array<[keyof MetricConfig, string]> = [
    ["calories", "Calories (kcal)"],
    ["carbohydrate", "Carbohydrates (g)"],
    ["protein", "Protein (g)"],
    ["fat", "Fat (g)"],
    ["saturatedFat", "Saturated fat (g)"],
    ["polyunsaturatedFat", "Polyunsaturated fat (g)"],
    ["monounsaturatedFat", "Monounsaturated fat (g)"],
    ["transFat", "Trans fat (g)"],
    ["cholesterol", "Cholesterol (mg)"],
    ["sodium", "Sodium (mg)"],
    ["potassium", "Potassium (mg)"],
    ["fiber", "Fiber (g)"],
    ["sugar", "Sugar (g)"],
    ["vitaminA", "Vitamin A (% RDA)"],
    ["vitaminC", "Vitamin C (% RDA)"],
    ["calcium", "Calcium (% RDA)"],
    ["iron", "Iron (% RDA)"],
];

export class FatsecretSettingTab extends PluginSettingTab {
    plugin: FatsecretDiaryPlugin;

    constructor(app: App, plugin: FatsecretDiaryPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName("Fatsecret account").setHeading();

        new Setting(containerEl)
            .setName("Consumer key")
            .setDesc("From fatsecret developer → API keys")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.consumerKey)
                    .onChange(async (v) => {
                        this.plugin.settings.consumerKey = v.trim();
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Consumer secret")
            .setDesc("From fatsecret developer → API keys")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.consumerSecret)
                    .onChange(async (v) => {
                        this.plugin.settings.consumerSecret = v.trim();
                        await this.plugin.saveSettings();
                    })
            );

        const authStatus = this.plugin.settings.oauthToken
            ? "✅ Authorized"
            : "⚠️ Not authorized";

        containerEl.createEl("p", { text: authStatus });

        new Setting(containerEl)
            .setName("Authorization")
            .setDesc("Sign in to fatsecret and obtain an access token")
            .addButton((btn) =>
                btn
                    .setButtonText("Authorize")
                    .setCta()
                    .onClick(() => {
                        void this.plugin.startAuthorization();
                    })
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Sign out")
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings.oauthToken = "";
                        this.plugin.settings.oauthTokenSecret = "";
                        await this.plugin.saveSettings();
                        new Notice("Tokens cleared");
                        this.display();
                    })
            );

        new Setting(containerEl).setName("Output destination").setHeading();

        new Setting(containerEl)
            .setName("Mode")
            .setDesc("Where to write the diary when the ribbon icon is clicked")
            .addDropdown((dd) =>
                dd
                    .addOption("active", "Active note")
                    .addOption("file", "Dedicated file")
                    .addOption("daily", "Daily note")
                    .setValue(this.plugin.settings.targetMode)
                    .onChange(async (v) => {
                        this.plugin.settings.targetMode = v as TargetMode;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.targetMode === "file") {
            new Setting(containerEl)
                .setName("File path")
                .setDesc("E.g. FatSecret Diary.md or folder/Diary.md. Created if missing.")
                .addText((text) =>
                    text
                        .setValue(this.plugin.settings.targetFile)
                        .onChange(async (v) => {
                            this.plugin.settings.targetFile = v.trim();
                            await this.plugin.saveSettings();
                        })
                );
        }

        new Setting(containerEl)
            .setName("Also write yesterday")
            .setDesc("When enabled, clicking the ribbon icon writes both today and yesterday.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.alsoYesterday)
                    .onChange(async (v) => {
                        this.plugin.settings.alsoYesterday = v;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl).setName("Metrics").setHeading();
        containerEl.createEl("p", {
            text: "Select which values appear in the output table.",
        });

        for (const [key, label] of METRIC_LABELS) {
            new Setting(containerEl)
                .setName(label)
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.metrics[key])
                        .onChange(async (v) => {
                            this.plugin.settings.metrics[key] = v;
                            await this.plugin.saveSettings();
                        })
                );
        }
    }
}