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

export function renderMarkdown(markdown: string) {
  if (!markdown) {
    return "";
  }

  const html = marked.parse(markdown);
  return DOMPurify.sanitize(html);
}
