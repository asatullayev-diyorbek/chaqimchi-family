// Token storage: expo-secure-store on native, localStorage on web.
//
// SecureStore has no web implementation (its methods throw), and inside a
// Telegram Mini App there is no keychain anyway — localStorage is the right
// place there. Every call is wrapped so a private-mode / disabled-storage
// browser degrades to in-memory (the session still works, it just won't
// survive a reload — and in Telegram initData re-auth covers that).

import { Platform } from "react-native";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require("expo-secure-store");
}

export async function storageGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    }
    return (await SecureStore?.getItemAsync(key)) ?? null;
  } catch {
    return null;
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage?.setItem(key, value);
      return;
    }
    await SecureStore?.setItemAsync(key, value);
  } catch {
    /* ignore — caller keeps an in-memory copy */
  }
}

export async function storageDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage?.removeItem(key);
      return;
    }
    await SecureStore?.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}
