import { describe, expect, it } from "vitest";
import {
  extractReadableContentFromHtml,
  isPrivateIpAddress,
  normalizeReadUrl,
  normalizeReadableText,
} from "../server/services/read-to-me";

describe("read-to-me helpers", () => {
  it("adds https for bare domains", () => {
    expect(normalizeReadUrl("example.com/post")).toBe("https://example.com/post");
    expect(normalizeReadUrl("https://example.com/post")).toBe("https://example.com/post");
  });

  it("normalizes extracted text for narration", () => {
    expect(normalizeReadableText("Hello\u00a0\u00a0world\n\n\nLine two")).toBe("Hello world\n\nLine two");
  });

  it("blocks private and loopback IP ranges", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("10.0.5.2")).toBe(true);
    expect(isPrivateIpAddress("172.20.0.1")).toBe(true);
    expect(isPrivateIpAddress("192.168.1.8")).toBe(true);
    expect(isPrivateIpAddress("::1")).toBe(true);
    expect(isPrivateIpAddress("fd12:3456:789a::1")).toBe(true);
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false);
  });

  it("extracts article text instead of chrome noise", () => {
    const { title, text } = extractReadableContentFromHtml(
      `<!doctype html>
      <html>
        <head><title>Ship Faster with Meowstik</title></head>
        <body>
          <nav>Home Docs Pricing Sign in</nav>
          <article>
            <h1>Ship Faster with Meowstik</h1>
            <p>Meowstik can summarize long pages into something you can actually listen to.</p>
            <p>That makes it easier to catch up while you are cooking dinner or walking the dog.</p>
            <p>It should keep the useful part and drop the navigation clutter.</p>
          </article>
          <footer>Footer links and legal boilerplate</footer>
        </body>
      </html>`,
      "https://example.com/blog/read-to-me"
    );

    expect(title).toContain("Ship Faster with Meowstik");
    expect(text).toContain("summarize long pages");
    expect(text).not.toContain("Pricing Sign in");
  });
});
