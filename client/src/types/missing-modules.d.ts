// Ambient module declarations for packages whose type symlinks
// are missing from the pnpm virtual store on this machine.
// Remove this file once `pnpm install --force` restores the symlinks.

declare module "marked" {
  export class Renderer {
    link(href: string, title: string | null, text: string): string;
    image(href: string, title: string | null, text: string): string;
    code(code: string, language?: string): string;
  }
  export interface MarkedOptions {
    renderer?: Renderer;
    gfm?: boolean;
    breaks?: boolean;
    async?: boolean;
    [key: string]: unknown;
  }
  interface MarkedInstance {
    (src: string, options?: MarkedOptions): string | Promise<string>;
    Renderer: typeof Renderer;
    setOptions(options: MarkedOptions): void;
    parse(src: string, options?: MarkedOptions & { async: false }): string;
    parse(src: string, options?: MarkedOptions): string | Promise<string>;
  }
  export const marked: MarkedInstance;
}

declare module "dompurify" {
  interface DOMPurify {
    sanitize(dirty: string, config?: Record<string, unknown>): string;
  }
  const DOMPurify: DOMPurify;
  export default DOMPurify;
}
