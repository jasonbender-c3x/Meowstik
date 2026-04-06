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

  const html = marked.parse(stripVoiceStyleTags(markdown), { async: false }) as string;
  return DOMPurify.sanitize(html);
}
