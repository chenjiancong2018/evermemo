'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Markdown 渲染（GFM），外部链接新窗口打开 */
export function MarkdownView({ content }: { content: string }) {
  if (!content || !content.trim()) return null;
  return (
    <div className="md-body text-[14.5px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          input: ({ checked, disabled, type }) => (
            <input checked={checked} disabled={disabled} type={type} readOnly className="mr-1.5 align-middle accent-[#777D66]" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
