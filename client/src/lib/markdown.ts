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

export function renderMarkdown(markdown: string) {
  if (!markdown) {
    return "";
  }

  const html = marked.parse(stripVoiceStyleTags(markdown));
  return DOMPurify.sanitize(html);
}
