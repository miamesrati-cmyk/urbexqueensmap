import Quill from "quill";
import { useEffect, useMemo, useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "link"],
  ["clean"],
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  className = "",
}: Props) {
  const initialValueRef = useRef(value);
  const editorRef = useRef<Quill | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const modules = useMemo(
    () => ({
      toolbar: TOOLBAR_OPTIONS,
    }),
    []
  );

  const formats = useMemo(
    () => [
      "header",
      "bold",
      "italic",
      "underline",
      "strike",
      "blockquote",
      "list",
      "indent",
      "link",
      "clean",
    ],
    []
  );

  useEffect(() => {
    if (editorRef.current || !containerRef.current) return;

    const quill = new Quill(containerRef.current, {
      theme: "snow",
      modules,
      formats,
      placeholder,
    });

    const handleChange = () => {
      onChange(quill.root.innerHTML);
    };

    quill.clipboard.dangerouslyPasteHTML(initialValueRef.current || "");
    quill.on("text-change", handleChange);

    editorRef.current = quill;

    return () => {
      quill.off("text-change", handleChange);
      editorRef.current = null;
    };
  }, [formats, modules, onChange, placeholder]);

  useEffect(() => {
    const quill = editorRef.current;
    if (!quill) return;

    const current = quill.root.innerHTML;
    if (current === (value || "")) return;

    const selection = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(value || "");
    if (selection) {
      quill.setSelection(selection);
    }
  }, [value]);

  return (
    <div className={`uq-rich-editor ${className}`}>
      <div ref={containerRef} />
    </div>
  );
}
