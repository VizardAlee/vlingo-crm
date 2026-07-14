import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MarkdownContent({ className, content }: { className?: string; content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  function renderInline(text: string, keyPrefix: string) {
    const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
    return tokens.map((token, index) => {
      const key = `${keyPrefix}-${index}`;
      if (!token) return null;
      if (token.startsWith("**") && token.endsWith("**")) return <strong className="font-semibold text-foreground" key={key}>{token.slice(2, -2)}</strong>;
      if (token.startsWith("`") && token.endsWith("`")) return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground" key={key}>{token.slice(1, -1)}</code>;
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) return <a className="font-medium text-primary underline-offset-2 hover:underline" href={linkMatch[2]} key={key} rel="noreferrer" target="_blank">{linkMatch[1]}</a>;
      return token;
    });
  }

  function pushList(items: string[], ordered: boolean, key: string) {
    if (!items.length) return;
    const children = items.map((item, index) => <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>);
    const listClass = "grid gap-1 pl-5";
    blocks.push(ordered ? <ol className={`${listClass} list-decimal`} key={key}>{children}</ol> : <ul className={`${listClass} list-disc`} key={key}>{children}</ul>);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push(<pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs text-foreground" key={`code-${index}`}><code>{codeLines.join("\n")}</code></pre>);
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr className="border-border" key={`hr-${index}`} />);
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push(<p className={heading[1].length <= 2 ? "text-base font-semibold text-foreground" : "text-sm font-semibold text-foreground"} key={`heading-${index}`}>{renderInline(heading[2], `heading-${index}`)}</p>);
      continue;
    }
    const orderedItems: string[] = [];
    let cursor = index;
    while (cursor < lines.length) {
      const match = lines[cursor].trim().match(/^\d+\.\s+(.+)$/);
      if (!match) break;
      orderedItems.push(match[1]);
      cursor += 1;
    }
    if (orderedItems.length) {
      pushList(orderedItems, true, `ol-${index}`);
      index = cursor - 1;
      continue;
    }
    const bulletItems: string[] = [];
    cursor = index;
    while (cursor < lines.length) {
      const match = lines[cursor].trim().match(/^[-*]\s+(.+)$/);
      if (!match) break;
      bulletItems.push(match[1]);
      cursor += 1;
    }
    if (bulletItems.length) {
      pushList(bulletItems, false, `ul-${index}`);
      index = cursor - 1;
      continue;
    }
    if (trimmed.startsWith(">")) {
      blocks.push(<blockquote className="border-l-4 border-primary/30 pl-3 text-muted-foreground" key={`quote-${index}`}>{renderInline(trimmed.replace(/^>\s?/, ""), `quote-${index}`)}</blockquote>);
      continue;
    }
    blocks.push(<p key={`p-${index}`}>{renderInline(trimmed, `p-${index}`)}</p>);
  }

  return <div className={cn("grid gap-2", className)}>{blocks}</div>;
}
