import { describe, expect, it } from "vitest";
import { appDisplay, BRAND_ICON, CATEGORY_META } from "./appDisplay";

describe("appDisplay", () => {
  it("uses the curated name and category for a known app", () => {
    const d = appDisplay("chrome.exe");
    expect(d.label).toBe("Google Chrome");
    expect(d.category).toBe("brauzer");
    expect(d.brandIcon).toBe("logos:chrome");
  });

  it("is case-insensitive about the exe name", () => {
    expect(appDisplay("CHROME.EXE").label).toBe("Google Chrome");
    expect(appDisplay("Code.Exe").label).toBe("VS Code");
  });

  it("prettifies an unknown exe rather than showing it raw", () => {
    expect(appDisplay("WindowsTerminal.exe").label).toBe("Windows Terminal");
    expect(appDisplay("my_cool_app.exe").label).toBe("My Cool App");
    expect(appDisplay("notepad.exe").label).toBe("Bloknot"); // known one wins
  });

  it("prefers a useful name from the agent over a prettified exe", () => {
    // The agent may learn a real display name later; it should win — but only
    // if it is an actual name and not just the exe repeated back.
    expect(appDisplay("someapp.exe", "Some Real App").label).toBe("Some Real App");
    expect(appDisplay("someapp.exe", "someapp.exe").label).toBe("Someapp");
  });

  it("falls back to a category, never to nothing", () => {
    const d = appDisplay("totallyunknown.exe");
    expect(d.category).toBe("boshqa");
    expect(d.categoryIcon).toBe(CATEGORY_META.boshqa.icon);
    expect(d.brandIcon).toBeNull();
  });

  it("handles empty input without throwing", () => {
    expect(appDisplay("").label).toBe("Noma'lum ilova");
    expect(appDisplay(null).label).toBe("Noma'lum ilova");
    expect(appDisplay(undefined).label).toBe("Noma'lum ilova");
  });

  it("classifies the system apps a parent shouldn't read as 'usage'", () => {
    expect(appDisplay("explorer.exe").category).toBe("tizim");
    expect(appDisplay("LockApp.exe").category).toBe("tizim");
    expect(appDisplay("ApplicationFrameHost.exe").label).toBe("Windows ilova");
  });

  it("keeps every brand icon pointing at a registry entry", () => {
    // A brand icon for an app with no name/category entry would render a logo
    // next to a prettified exe — a mismatch that's easy to introduce.
    for (const exe of Object.keys(BRAND_ICON)) {
      expect(appDisplay(exe).label, `${exe} has a brand icon but no registry name`).not.toBe(
        exe.replace(/\.exe$/i, ""),
      );
    }
  });
});
