import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

function getThemeMode(): ThemeMode {
    if (typeof document === "undefined") {
        return "light";
    }
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(onStoreChange: () => void) {
    const observer = new MutationObserver(onStoreChange);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });
    return () => observer.disconnect();
}

/** Syncs OpenUI theme mode with a `.dark` class on `<html>`. */
export function useClassDarkMode(): ThemeMode {
    return useSyncExternalStore(subscribe, getThemeMode, () => "light");
}
