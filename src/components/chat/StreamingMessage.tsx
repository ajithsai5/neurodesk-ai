'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface StreamingMessageProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
}

export function StreamingMessage({ content, role, isStreaming }: StreamingMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-slate-200 text-slate-800'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className={`prose prose-sm max-w-none ${isStreaming ? 'streaming-cursor' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
