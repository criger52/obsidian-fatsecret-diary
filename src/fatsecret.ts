import { requestUrl } from "obsidian";
import { OAuthHelper } from "./oauth";
import type { MetricConfig } from "./settings";

const FATSECRET_BASE_API_URL = "https://platform.fatsecret.com/rest/";
const REQUEST_TOKEN_URL = "https://authentication.fatsecret.com/oauth/request_token";
const AUTHORIZE_URL = "https://authentication.fatsecret.com/oauth/authorize";
const ACCESS_TOKEN_URL = "https://authentication.fatsecret.com/oauth/access_token";

interface FatSecretApiEntry {
    meal?: string;
    food_entry_name?: string;
    calories?: string;
    carbohydrate?: string;
    protein?: string;
    fat?: string;
    saturated_fat?: string;
    polyunsaturated_fat?: string;
    monounsaturated_fat?: string;
    trans_fat?: string;
    cholesterol?: string;
    sodium?: string;
    potassium?: string;
    fiber?: string;
    sugar?: string;
    vitamin_a?: string;
    vitamin_c?: string;
    calcium?: string;
    iron?: string;
}

interface FatSecretApiResponse {
    error?: { code: number; message: string };
    food_entries?: {
        food_entry?: FatSecretApiEntry | FatSecretApiEntry[];
    } | null;
}

export interface FoodEntry {
    meal: string;
    name: string;
    calories: number;
    carbohydrate: number;
    protein: number;
    fat: number;
    saturatedFat: number | null;
    polyunsaturatedFat: number | null;
    monounsaturatedFat: number | null;
    transFat: number | null;
    cholesterol: number | null;
    sodium: number | null;
    potassium: number | null;
    fiber: number | null;
    sugar: number | null;
    vitaminA: number | null;
    vitaminC: number | null;
    calcium: number | null;
    iron: number | null;
}

export interface DailyDiaryEntries {
    totalCalories: number;
    totalCarbohydrate: number;
    totalProtein: number;
    totalFat: number;
    totalSaturatedFat: number;
    totalPolyunsaturatedFat: number;
    totalMonounsaturatedFat: number;
    totalTransFat: number;
    totalCholesterol: number;
    totalSodium: number;
    totalPotassium: number;
    totalFiber: number;
    totalSugar: number;
    foodEntries: FoodEntry[];
}

export interface FatSecretCredentials {
    consumerKey: string;
    consumerSecret: string;
    oauthToken: string;
    oauthTokenSecret: string;
}

export interface RequestTokenResult {
    oauthToken: string;
    oauthTokenSecret: string;
    authorizeUrl: string;
}

export interface AccessTokenResult {
    oauthToken: string;
    oauthTokenSecret: string;
}

function parseForm(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    const parts: string[] = text.split("&");
    for (const part of parts) {
        const idx: number = part.indexOf("=");
        if (idx > 0) {
            const k: string = part.slice(0, idx);
            const v: string = part.slice(idx + 1);
            result[k] = v;
        }
    }
    return result;
}

function num(v: unknown): number | null {
    if (typeof v === "number") {
        if (Number.isNaN(v) || v < 0) return null;
        return v;
    }
    if (typeof v === "string") {
        const n = parseFloat(v);
        if (Number.isNaN(n) || n < 0) return null;
        return n;
    }
    return null;
}

function sumOrZero(a: number, b: number | null): number {
    return a + (b ?? 0);
}

export async function getRequestToken(
    consumerKey: string,
    consumerSecret: string
): Promise<RequestTokenResult> {
    const request = OAuthHelper.buildRequest(
        "GET",
        REQUEST_TOKEN_URL,
        consumerKey,
        consumerSecret,
        "",
        { oauth_callback: "oob" }
    );

    const query = new URLSearchParams(request.requestParams).toString();
    const response = await requestUrl({
        url: `${REQUEST_TOKEN_URL}?${query}`,
        method: "GET",
    });

    const tokens = parseForm(response.text);
    const oauthToken = tokens["oauth_token"];
    const oauthTokenSecret = tokens["oauth_token_secret"];

    if (!oauthToken || !oauthTokenSecret) {
        throw new Error(`FatSecret returned incomplete response: ${response.text}`);
    }

    return {
        oauthToken,
        oauthTokenSecret,
        authorizeUrl: `${AUTHORIZE_URL}?oauth_token=${oauthToken}`,
    };
}

export async function getAccessToken(
    consumerKey: string,
    consumerSecret: string,
    requestToken: string,
    requestTokenSecret: string,
    verifier: string
): Promise<AccessTokenResult> {
    const request = OAuthHelper.buildRequest(
        "GET",
        ACCESS_TOKEN_URL,
        consumerKey,
        consumerSecret,
        requestTokenSecret,
        {
            oauth_token: requestToken,
            oauth_verifier: verifier,
        }
    );

    const query = new URLSearchParams(request.requestParams).toString();
    const response = await requestUrl({
        url: `${ACCESS_TOKEN_URL}?${query}`,
        method: "GET",
    });

    const tokens = parseForm(response.text);
    const oauthToken = tokens["oauth_token"];
    const oauthTokenSecret = tokens["oauth_token_secret"];

    if (!oauthToken || !oauthTokenSecret) {
        throw new Error(`FatSecret returned incomplete response: ${response.text}`);
    }

    return { oauthToken, oauthTokenSecret };
}

export async function getDiaryEntries(
    creds: FatSecretCredentials,
    inputDate: Date
): Promise<DailyDiaryEntries> {
    const epoch = Date.UTC(1970, 0, 1);
    const days = Math.floor(
        (Date.UTC(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate()) - epoch)
        / (1000 * 60 * 60 * 24)
    );

    const requestParams: Record<string, string> = {
        method: "food_entries.get.v2",
        format: "json",
        oauth_token: creds.oauthToken,
        date: days.toString(),
    };

    const request = OAuthHelper.buildRequest(
        "GET",
        FATSECRET_BASE_API_URL,
        creds.consumerKey,
        creds.consumerSecret,
        creds.oauthTokenSecret,
        requestParams
    );

    const query = new URLSearchParams(request.requestParams).toString();
    const fullUrl = `${FATSECRET_BASE_API_URL}?${query}`;

    const response = await requestUrl({ url: fullUrl, method: "GET" });
    const data = response.json as FatSecretApiResponse;

    if (data.error) {
        throw new Error(`FatSecret error ${data.error.code}: ${data.error.message}`);
    }

    const diary: DailyDiaryEntries = {
        totalCalories: 0,
        totalCarbohydrate: 0,
        totalProtein: 0,
        totalFat: 0,
        totalSaturatedFat: 0,
        totalPolyunsaturatedFat: 0,
        totalMonounsaturatedFat: 0,
        totalTransFat: 0,
        totalCholesterol: 0,
        totalSodium: 0,
        totalPotassium: 0,
        totalFiber: 0,
        totalSugar: 0,
        foodEntries: [],
    };

    const rawEntries: FatSecretApiEntry | FatSecretApiEntry[] =
        data.food_entries?.food_entry ?? [];
    const entriesArray: FatSecretApiEntry[] = Array.isArray(rawEntries)
        ? rawEntries
        : [rawEntries];

    for (const entry of entriesArray) {
        const foodEntry: FoodEntry = {
            meal: entry.meal ?? "Other",
            name: entry.food_entry_name ?? "Untitled",
            calories: Math.round(num(entry.calories) ?? 0),
            carbohydrate: num(entry.carbohydrate) ?? 0,
            protein: num(entry.protein) ?? 0,
            fat: num(entry.fat) ?? 0,
            saturatedFat: num(entry.saturated_fat),
            polyunsaturatedFat: num(entry.polyunsaturated_fat),
            monounsaturatedFat: num(entry.monounsaturated_fat),
            transFat: num(entry.trans_fat),
            cholesterol: num(entry.cholesterol),
            sodium: num(entry.sodium),
            potassium: num(entry.potassium),
            fiber: num(entry.fiber),
            sugar: num(entry.sugar),
            vitaminA: num(entry.vitamin_a),
            vitaminC: num(entry.vitamin_c),
            calcium: num(entry.calcium),
            iron: num(entry.iron),
        };

        diary.totalCalories += foodEntry.calories;
        diary.totalCarbohydrate += foodEntry.carbohydrate;
        diary.totalProtein += foodEntry.protein;
        diary.totalFat += foodEntry.fat;
        diary.totalSaturatedFat = sumOrZero(diary.totalSaturatedFat, foodEntry.saturatedFat);
        diary.totalPolyunsaturatedFat = sumOrZero(diary.totalPolyunsaturatedFat, foodEntry.polyunsaturatedFat);
        diary.totalMonounsaturatedFat = sumOrZero(diary.totalMonounsaturatedFat, foodEntry.monounsaturatedFat);
        diary.totalTransFat = sumOrZero(diary.totalTransFat, foodEntry.transFat);
        diary.totalCholesterol = sumOrZero(diary.totalCholesterol, foodEntry.cholesterol);
        diary.totalSodium = sumOrZero(diary.totalSodium, foodEntry.sodium);
        diary.totalPotassium = sumOrZero(diary.totalPotassium, foodEntry.potassium);
        diary.totalFiber = sumOrZero(diary.totalFiber, foodEntry.fiber);
        diary.totalSugar = sumOrZero(diary.totalSugar, foodEntry.sugar);

        diary.foodEntries.push(foodEntry);
    }

    return diary;
}

interface MetricDef {
    key: keyof MetricConfig;
    label: string;
    short: string;
    field: keyof FoodEntry;
    totalField: keyof DailyDiaryEntries;
    unit: string;
    decimals: number;
    isPercent?: boolean;
}

const METRIC_DEFS: MetricDef[] = [
    { key: "calories", label: "Calories", short: "Kcal", field: "calories", totalField: "totalCalories", unit: "", decimals: 0 },
    { key: "carbohydrate", label: "Carbs", short: "Carbs", field: "carbohydrate", totalField: "totalCarbohydrate", unit: "g", decimals: 1 },
    { key: "protein", label: "Protein", short: "Protein", field: "protein", totalField: "totalProtein", unit: "g", decimals: 1 },
    { key: "fat", label: "Fat", short: "Fat", field: "fat", totalField: "totalFat", unit: "g", decimals: 1 },
    { key: "saturatedFat", label: "Saturated fat", short: "Sat.", field: "saturatedFat", totalField: "totalSaturatedFat", unit: "g", decimals: 1 },
    { key: "polyunsaturatedFat", label: "Polyunsaturated fat", short: "Poly.", field: "polyunsaturatedFat", totalField: "totalPolyunsaturatedFat", unit: "g", decimals: 1 },
    { key: "monounsaturatedFat", label: "Monounsaturated fat", short: "Mono.", field: "monounsaturatedFat", totalField: "totalMonounsaturatedFat", unit: "g", decimals: 1 },
    { key: "transFat", label: "Trans fat", short: "Trans", field: "transFat", totalField: "totalTransFat", unit: "g", decimals: 1 },
    { key: "cholesterol", label: "Cholesterol", short: "Chol.", field: "cholesterol", totalField: "totalCholesterol", unit: "mg", decimals: 0 },
    { key: "sodium", label: "Sodium", short: "Sodium", field: "sodium", totalField: "totalSodium", unit: "mg", decimals: 0 },
    { key: "potassium", label: "Potassium", short: "Potassium", field: "potassium", totalField: "totalPotassium", unit: "mg", decimals: 0 },
    { key: "fiber", label: "Fiber", short: "Fiber", field: "fiber", totalField: "totalFiber", unit: "g", decimals: 1 },
    { key: "sugar", label: "Sugar", short: "Sugar", field: "sugar", totalField: "totalSugar", unit: "g", decimals: 1 },
    { key: "vitaminA", label: "Vitamin A", short: "A", field: "vitaminA", totalField: "totalCalories", unit: "%", decimals: 0, isPercent: true },
    { key: "vitaminC", label: "Vitamin C", short: "C", field: "vitaminC", totalField: "totalCalories", unit: "%", decimals: 0, isPercent: true },
    { key: "calcium", label: "Calcium", short: "Ca", field: "calcium", totalField: "totalCalories", unit: "%", decimals: 0, isPercent: true },
    { key: "iron", label: "Iron", short: "Fe", field: "iron", totalField: "totalCalories", unit: "%", decimals: 0, isPercent: true },
];

const MEAL_ORDER = ["Breakfast", "Lunch", "Dinner", "Other"];
const MEAL_LABELS: Record<string, string> = {
    Breakfast: "🌅 Breakfast",
    Lunch: "☀️ Lunch",
    Dinner: "🌙 Dinner",
    Other: "🍎 Other",
};

function fmt(v: number | null, decimals: number): string {
    if (v === null) return "—";
    return v.toFixed(decimals);
}

function escapePipe(s: string): string {
    return s.replace(/\|/g, "\\|");
}

function formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function formatDiary(
    diary: DailyDiaryEntries,
    inputDate: Date,
    metrics: MetricConfig
): string {
    const dateStr = formatLocalDate(inputDate);
    const lines: string[] = [];

    lines.push(`## 🍽 FatSecret — ${dateStr}`);
    lines.push("");

    if (diary.foodEntries.length === 0) {
        lines.push("_No entries for this date._");
        return lines.join("\n");
    }

    const activeMetrics = METRIC_DEFS.filter((m) => metrics[m.key]);

    if (activeMetrics.length === 0) {
        lines.push("_No metrics selected. Enable them in plugin settings._");
        return lines.join("\n");
    }

    lines.push("| Total | " + activeMetrics.map((m) => m.label).join(" | ") + " |");
    lines.push("|---|" + activeMetrics.map(() => "---:").join("|") + "|");

    const totalCells = activeMetrics.map((m) => {
        if (m.isPercent) return "—";
        const total = diary[m.totalField] as number;
        const unit = m.unit ? " " + m.unit : "";
        return `**${total.toFixed(m.decimals)}${unit}**`;
    });
    lines.push("| **Day total** | " + totalCells.join(" | ") + " |");
    lines.push("");

    const grouped = new Map<string, FoodEntry[]>();
    for (const entry of diary.foodEntries) {
        const arr = grouped.get(entry.meal) ?? [];
        arr.push(entry);
        grouped.set(entry.meal, arr);
    }

    const sortedMeals = Array.from(grouped.keys()).sort((a, b) => {
        const ia = MEAL_ORDER.indexOf(a);
        const ib = MEAL_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const meal of sortedMeals) {
        const entries = grouped.get(meal) ?? [];
        const mealLabel = MEAL_LABELS[meal] ?? meal;

        let mealCalories = 0;
        for (const e of entries) mealCalories += e.calories;

        lines.push(`### ${mealLabel} — ${Math.round(mealCalories)} kcal`);
        lines.push("");
        lines.push("| Food | " + activeMetrics.map((m) => m.short).join(" | ") + " |");
        lines.push("|---|" + activeMetrics.map(() => "---:").join("|") + "|");

        for (const entry of entries) {
            const cells = activeMetrics.map((m) => {
                const v = entry[m.field] as number | null;
                return fmt(v, m.decimals);
            });
            lines.push(`| ${escapePipe(entry.name)} | ${cells.join(" | ")} |`);
        }
        lines.push("");
    }

    return lines.join("\n");
}