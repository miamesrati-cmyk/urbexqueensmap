declare module "quill" {
  export interface QuillSelection {
    index: number;
    length: number;
  }

  export interface QuillClipboard {
    dangerouslyPasteHTML(html: string): void;
    convert(html: string): any;
  }

  export default class Quill {
    constructor(
      element: HTMLElement,
      options?: {
        theme?: string;
        modules?: any;
        formats?: string[];
        placeholder?: string;
      }
    );
    root: HTMLElement;
    clipboard: QuillClipboard;
    getSelection(): QuillSelection | null;
    setSelection(selection: QuillSelection): void;
    on(eventName: string, handler: (...args: any[]) => void): void;
    off(eventName: string, handler?: (...args: any[]) => void): void;
  }
}
