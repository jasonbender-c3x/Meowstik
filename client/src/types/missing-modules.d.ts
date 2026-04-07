// Ambient module declarations for packages whose type symlinks
// are missing from the pnpm virtual store on this machine.
// Remove this file once `pnpm install --force` restores the symlinks.

declare module "marked" {
  export const marked: (src: string, options?: Record<string, unknown>) => string | Promise<string>;
  export class Renderer {
    link(href: string, title: string | null, text: string): string;
    image(href: string, title: string | null, text: string): string;
    code(code: string, language?: string): string;
  }
  export interface MarkedOptions {
    renderer?: Renderer;
    gfm?: boolean;
    breaks?: boolean;
    [key: string]: unknown;
  }
  export function setOptions(options: MarkedOptions): void;
}

declare module "dompurify" {
  interface DOMPurify {
    sanitize(dirty: string, config?: Record<string, unknown>): string;
  }
  const DOMPurify: DOMPurify;
  export default DOMPurify;
}
