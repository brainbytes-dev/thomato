export const THEME_STORAGE_KEY = "qm-theme";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];

/** Unbekannte oder fehlende Werte fallen auf «system» zurück. */
export function parseTheme(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

export function readTheme(storage: ReadableStorage | null): ThemeChoice {
  try {
    return parseTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** «system» löscht die Wahl, damit nur prefers-color-scheme entscheidet. Gibt false zurück, wenn der Speicher nicht erreichbar ist. */
export function writeTheme(storage: WritableStorage | null, choice: ThemeChoice): boolean {
  try {
    if (!storage) return false;
    if (choice === "system") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

export function applyTheme(root: Pick<HTMLElement, "setAttribute" | "removeAttribute">, choice: ThemeChoice): void {
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/** Läuft synchron im <head> vor dem ersten Paint, damit weder Hell noch Dunkel aufblitzt. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
