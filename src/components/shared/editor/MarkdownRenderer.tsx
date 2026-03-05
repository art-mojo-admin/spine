import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import mermaid from 'mermaid'
import { useEffect, useRef } from 'react'

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // After render, find mermaid code blocks and render them
  useEffect(() => {
    if (!containerRef.current) return

    const renderMermaid = async () => {
      const nodes = containerRef.current?.querySelectorAll('.language-mermaid')
      if (!nodes || nodes.length === 0) return

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const code = node.textContent || ''
        
        try {
          // Replace the pre/code block with a div for mermaid to render into
          const parent = node.parentElement // <pre>
          if (parent) {
            const wrapper = document.createElement('div')
            wrapper.className = 'mermaid flex justify-center my-4 p-4 border rounded-md bg-muted/20'
            wrapper.id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
            
            // Render the diagram
            const { svg } = await mermaid.render(wrapper.id + '-svg', code)
            wrapper.innerHTML = svg
            
            // Replace the pre element with our new wrapper
            parent.parentNode?.replaceChild(wrapper, parent)
          }
        } catch (err) {
          console.error('Failed to render mermaid diagram:', err)
        }
      }
    }

    renderMermaid()
  }, [content])

  return (
    <div ref={containerRef} className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw, // Allows rendering HTML like iframes
          [rehypeSanitize, {
            ...defaultSchema,
            tagNames: [...(defaultSchema.tagNames || []), 'iframe'],
            attributes: {
              ...defaultSchema.attributes,
              iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title'],
            }
          }],
          rehypeSlug, // Adds IDs to headings
          [rehypeAutolinkHeadings, { behavior: 'wrap' }] // Adds links to headings
        ]}
        components={{
          // Custom rendering for code blocks to support syntax highlighting
          // For now we just use a basic pre tag, but this could be enhanced with react-syntax-highlighter
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            // Don't format mermaid blocks, let our useEffect handle them
            if (match && match[1] === 'mermaid') {
              return <code className={className} {...props}>{children}</code>
            }
            
            return !inline ? (
              <div className="relative group">
                <pre className={`p-4 rounded-md bg-muted/50 overflow-x-auto ${className || ''}`} {...props}>
                  <code>{children}</code>
                </pre>
              </div>
            ) : (
              <code className="px-1.5 py-0.5 rounded-md bg-muted text-sm" {...props}>
                {children}
              </code>
            )
          },
          // Make tables look nice
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="w-full border-collapse border border-border text-sm" {...props}>
                  {children}
                </table>
              </div>
            )
          },
          th({ children, ...props }) {
            return <th className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold" {...props}>{children}</th>
          },
          td({ children, ...props }) {
            return <td className="border border-border px-3 py-2" {...props}>{children}</td>
          },
          // Responsive images
          img({ node, ...props }) {
            return <img className="rounded-md max-h-[500px] object-contain mx-auto" loading="lazy" {...props} />
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
