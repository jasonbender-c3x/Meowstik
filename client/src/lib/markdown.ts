import { marked } from "marked";
import DOMPurify from "dompurify";

const renderer = new marked.Renderer();

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
});

function stripVoiceStyleTags(text: string): string {
  return text.replace(/\[style:\s*[a-zA-Z]+\]\s*/gi, "").trim();
}

export function renderMarkdown(markdown: string) {
  if (!markdown) {
    return "";
  }

  // Replace literal \n sequences (backslash + n) with actual newlines.
  // These can appear in tool result summaries and certain message blocks that
  // were built with escaped string literals instead of real newline characters.
  const normalized = markdown.replace(/\\n/g, "\n");

  const html = marked.parse(stripVoiceStyleTags(normalized), { async: false }) as string;
  return DOMPurify.sanitize(html);
}
