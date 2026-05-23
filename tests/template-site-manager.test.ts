import { describe, expect, it } from "vitest";
import {
  STARTER_SITE_EDITABLE_FILES,
  STARTER_SITE_MARKER_FILE,
  STARTER_SITE_PACKAGE_NAME,
  buildStarterSiteFiles,
  canRecoverStarterSiteDirectory,
  looksLikeStarterSite,
} from "../server/services/template-site-manager";

describe("template-site-manager helpers", () => {
  it("builds the starter scaffold with runnable scripts and editable files", () => {
    const files = buildStarterSiteFiles();
    const manifest = JSON.parse(files["package.json"]) as {
      name: string;
      scripts: Record<string, string>;
    };

    expect(manifest.name).toBe(STARTER_SITE_PACKAGE_NAME);
    expect(manifest.scripts.build).toBe("node scripts/build.mjs");
    expect(manifest.scripts.start).toBe("node server.mjs");
    expect(files[STARTER_SITE_MARKER_FILE]).toContain(STARTER_SITE_PACKAGE_NAME);
    expect(STARTER_SITE_EDITABLE_FILES.every((file) => typeof files[file] === "string")).toBe(true);
  });

  it("recognizes starter sites from either the marker or package name", () => {
    expect(looksLikeStarterSite(STARTER_SITE_PACKAGE_NAME, false)).toBe(true);
    expect(looksLikeStarterSite(null, true)).toBe(true);
    expect(looksLikeStarterSite("different-project", false)).toBe(false);
  });

  it("allows recoverable starter-site directories but rejects unrelated roots", () => {
    expect(canRecoverStarterSiteDirectory([], false)).toBe(true);
    expect(canRecoverStarterSiteDirectory(["index.html", "src", "scripts"], false)).toBe(true);
    expect(canRecoverStarterSiteDirectory(["index.html", "src", "custom.txt"], false)).toBe(false);
    expect(canRecoverStarterSiteDirectory(["index.html", "src", "custom.txt"], true)).toBe(true);
  });
});
