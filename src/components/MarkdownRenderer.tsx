import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) {
    return (
      <div className="text-center py-12 text-brand-text-muted font-serif italic text-xs">
        Ningún contenido cargado para visualizar. Copie y pegue texto o arrastre un archivo .md arriba.
      </div>
    );
  }

  // Simple and ultra-clean custom parser to render markdown in real React nodes
  const lines = content.split("\n");
  const parsedNodes: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  let listType: "bullet" | "number" = "bullet";

  const renderTextWithFormatting = (text: string) => {
    // Escape simple HTML chars just in case
    let formatted: React.ReactNode[] = [];
    
    // Process bold (**bold**) and italic (*italic* / _italic_)
    // Let's do a reliable regex segmenter
    const boldItalicRegex = /(\*\*\*|__\*|\*\*\*|__|\*\*|\*|_)(.*?)\1/g;
    let lastIndex = 0;
    let match;
    let parts: React.ReactNode[] = [];

    // Helper to process nested text or basic bold/italic styling
    const getStyledPart = (delimiter: string, innerText: string, key: string) => {
      if (delimiter === "***" || delimiter === "___") {
        return <strong key={key} className="font-extrabold text-brand-gold italic">{innerText}</strong>;
      }
      if (delimiter === "**" || delimiter === "__") {
        return <strong key={key} className="font-bold text-brand-gold">{innerText}</strong>;
      }
      if (delimiter === "*" || delimiter === "_") {
        return <em key={key} className="italic text-brand-text/90">{innerText}</em>;
      }
      return <span key={key}>{innerText}</span>;
    };

    let keyId = 0;
    const cleanText = text;
    
    // We can run a loop to match formats
    const matches: { index: number; length: number; node: React.ReactNode }[] = [];
    
    // Standard simple replacement to make it ultra-robust
    // Let's split by ** for bold first as it's the most common
    const boldParts = cleanText.split("**");
    if (boldParts.length > 1) {
      return boldParts.map((part, index) => {
        if (index % 2 === 1) {
          // Odd index means it was inside **
          // Check for italics inside bold part
          const italicParts = part.split("*");
          if (italicParts.length > 1) {
            return (
              <strong key={index} className="font-bold text-brand-gold">
                {italicParts.map((ip, i) => i % 2 === 1 ? <em key={i} className="italic">{ip}</em> : ip)}
              </strong>
            );
          }
          return <strong key={index} className="font-bold text-brand-gold">{part}</strong>;
        } else {
          // Even index means plain text, check for single * for italics
          const italicParts = part.split("*");
          if (italicParts.length > 1) {
            return italicParts.map((ip, i) => i % 2 === 1 ? <em key={i} className="italic text-brand-text-muted">{ip}</em> : ip);
          }
          return part;
        }
      });
    }

    // Fallback if no bolds, look for single *
    const italicParts = cleanText.split("*");
    if (italicParts.length > 1) {
      return italicParts.map((part, index) => {
        if (index % 2 === 1) {
          return <em key={index} className="italic text-brand-text-muted">{part}</em>;
        }
        return part;
      });
    }

    return cleanText;
  };

  const flushList = (key: number) => {
    if (listItems.length === 0) return null;
    const items = [...listItems];
    const type = listType;
    listItems = [];
    inList = false;

    if (type === "number") {
      return (
        <ol key={`list-${key}`} className="list-decimal pl-6 my-3 flex flex-col gap-1.5 text-xs text-brand-text leading-relaxed font-serif">
          {items.map((item, idx) => (
            <li key={idx}>{renderTextWithFormatting(item)}</li>
          ))}
        </ol>
      );
    } else {
      return (
        <ul key={`list-${key}`} className="list-disc pl-6 my-3 flex flex-col gap-1.5 text-xs text-brand-text-muted leading-relaxed font-serif">
          {items.map((item, idx) => (
            <li key={idx} className="marker:text-brand-gold">{renderTextWithFormatting(item)}</li>
          ))}
        </ul>
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal Rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      if (inList) parsedNodes.push(flushList(i));
      parsedNodes.push(
        <hr key={`hr-${i}`} className="my-5 border-t border-brand-border" />
      );
      continue;
    }

    // Headers
    if (trimmed.startsWith("#")) {
      if (inList) parsedNodes.push(flushList(i));
      
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const text = trimmed.replace(/^#+\s*/, "");
      
      if (level === 1) {
        parsedNodes.push(
          <h1 key={`h1-${i}`} className="text-xl sm:text-2xl font-black text-brand-text tracking-tight font-serif mt-6 mb-3 border-b border-brand-border pb-2">
            {renderTextWithFormatting(text)}
          </h1>
        );
      } else if (level === 2) {
        parsedNodes.push(
          <h2 key={`h2-${i}`} className="text-base sm:text-lg font-bold text-brand-gold tracking-tight font-serif mt-5 mb-2.5">
            {renderTextWithFormatting(text)}
          </h2>
        );
      } else {
        parsedNodes.push(
          <h3 key={`h3-${i}`} className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand-text font-serif mt-4 mb-2">
            {renderTextWithFormatting(text)}
          </h3>
        );
      }
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith(">")) {
      if (inList) parsedNodes.push(flushList(i));
      const text = trimmed.replace(/^>\s*/, "");
      parsedNodes.push(
        <blockquote key={`quote-${i}`} className="border-l-2 border-brand-gold pl-4 py-1.5 my-3 bg-brand-bg/60 text-brand-text-muted italic text-xs font-serif leading-relaxed">
          {renderTextWithFormatting(text)}
        </blockquote>
      );
      continue;
    }

    // Bullet list item
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      if (!inList) {
        inList = true;
        listType = "bullet";
      } else if (listType !== "bullet") {
        parsedNodes.push(flushList(i));
        inList = true;
        listType = "bullet";
      }
      const text = trimmed.replace(/^[\*\-•]\s*/, "");
      listItems.push(text);
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList) {
        inList = true;
        listType = "number";
      } else if (listType !== "number") {
        parsedNodes.push(flushList(i));
        inList = true;
        listType = "number";
      }
      const text = trimmed.replace(/^\d+\.\s+/, "");
      listItems.push(text);
      continue;
    }

    // Empty line closes list and adds empty space
    if (trimmed === "") {
      if (inList) {
        parsedNodes.push(flushList(i));
      }
      continue;
    }

    // Ordinary Paragraph
    if (inList) {
      // Continuation of list item or close list
      parsedNodes.push(flushList(i));
    }
    parsedNodes.push(
      <p key={`p-${i}`} className="text-xs text-brand-text-muted leading-relaxed font-serif my-2.5">
        {renderTextWithFormatting(trimmed)}
      </p>
    );
  }

  // Flush any lingering lists at end
  if (inList) {
    parsedNodes.push(flushList(lines.length));
  }

  return <div className="space-y-1 select-text">{parsedNodes}</div>;
}
