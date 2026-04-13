import { marked } from "marked";
import DOMPurify from "dompurify";

const renderer = new marked.Renderer();

marked.setOptions({
  renderer,
  headerIds: true,
  mangle: false,
  gfm: true,
  breaks: true,
  smartLists: true
});

function stripVoiceStyleTags(text: string): string {
  return text.replace(/\[style:\s*[a-zA-Z]+\]\s*/gi, "").trim();
}

export function normalizeEscapedNewlines(markdown: string): string {
  const normalizeSegment = (segment: string) =>
    segment
      .replace(/(?<!\\)\\r\\n/g, "\n")
      .replace(/(?<!\\)\\n/g, "\n")
      .replace(/(?<!\\)\\r/g, "\r");

  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((block) => {
      if (block.startsWith("```") && block.endsWith("```")) {
        return block;
      }

      return block
        .split(/(`[^`\n]+`)/g)
        .map((segment) =>
          segment.startsWith("`") && segment.endsWith("`")
            ? segment
            : normalizeSegment(segment)
        )
        .join("");
    })
    .join("");
}

export function renderMarkdown(markdown: string) {
  if (!markdown) {
    return "";
  }

  const html = marked.parse(
    stripVoiceStyleTags(normalizeEscapedNewlines(markdown))
  );
  return DOMPurify.sanitize(html);
}
