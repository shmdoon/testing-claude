import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/**
 * Safe Markdown: raw HTML is never rendered (react-markdown default), unsafe
 * URL schemes are stripped, external links open in a new tab.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-3 leading-relaxed [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:text-xl [&_h3]:font-bold [&_li]:ml-6 [&_ol]:list-decimal [&_ul]:list-disc",
        className,
      )}
    >
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: () => null, // images go through the image block (alt text required)
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
