import { Fragment } from "react";

// Minimal markdown renderer: paragraphs, bullets, bold, inline code.
function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={key} className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    return <Fragment key={key}>{p}</Fragment>;
  });
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = (key: string) => {
    if (list.length) {
      blocks.push(
        <ul key={key} className="my-2 list-disc space-y-1 pl-5">
          {list.map((item, i) => (
            <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) {
      list.push(line.replace(/^[-*•]\s+/, ""));
      return;
    }
    flush(`list-${i}`);
    if (!line) return;
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={i} className="mt-3 font-display text-sm font-semibold">
          {line.slice(4)}
        </h4>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={i} className="mt-3 font-display text-base font-semibold">
          {line.slice(3)}
        </h3>,
      );
      return;
    }
    blocks.push(
      <p key={i} className="my-1.5 leading-relaxed">
        {inline(line, `p-${i}`)}
      </p>,
    );
  });
  flush("list-final");

  return <div className="text-sm">{blocks}</div>;
}
