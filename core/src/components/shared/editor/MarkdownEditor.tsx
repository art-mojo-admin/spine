import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import Youtube from '@tiptap/extension-youtube'
import { Markdown } from 'tiptap-markdown'
import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import bash from 'highlight.js/lib/languages/bash'
import xml from 'highlight.js/lib/languages/xml'
import sql from 'highlight.js/lib/languages/sql'

import {
  Bold, Italic, List, ListOrdered, Undo, Redo, Code, FileCode,
  Link as LinkIcon, Image as ImageIcon, Video, Table as TableIcon,
  Heading1, Heading2, Heading3, Quote
} from 'lucide-react'
import { useEffect, useState } from 'react'

const lowlight = createLowlight()
lowlight.register('javascript', javascript)
lowlight.register('typescript', typescript)
lowlight.register('css', css)
lowlight.register('json', json)
lowlight.register('markdown', markdown)
lowlight.register('bash', bash)
lowlight.register('xml', xml)
lowlight.register('sql', sql)

interface MarkdownEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  minHeight?: string
}

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 'min-h-[200px]' }: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<'wysiwyg' | 'markdown'>('wysiwyg')
  const [rawMarkdown, setRawMarkdown] = useState(value)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use the lowlight extension instead
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'typescript',
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({
        controls: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
      }),
      Markdown.configure({
        html: true, // Allow HTML to be parsed
        transformPastedText: true,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // The tiptap-markdown extension adds getMarkdown() to the editor
      const md = (editor.storage as any).markdown.getMarkdown()
      setRawMarkdown(md)
      onChange(md)
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none ${minHeight} px-4 py-3 focus:outline-none`,
      },
    },
  })

  // Sync external value changes (e.g. initial load)
  useEffect(() => {
    if (editor && value !== rawMarkdown) {
      editor.commands.setContent(value)
      setRawMarkdown(value)
    }
  }, [value, editor, rawMarkdown])

  const handleRawMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    setRawMarkdown(newVal)
    onChange(newVal)
    if (editor) {
      editor.commands.setContent(newVal)
    }
  }

  const insertLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    
    if (url === null) return // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertImage = () => {
    if (!editor) return
    const url = window.prompt('Image URL')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const insertYoutube = () => {
    if (!editor) return
    const url = window.prompt('YouTube Video URL')
    if (url) {
      editor.commands.setYoutubeVideo({ src: url })
    }
  }

  const insertMermaid = () => {
    if (!editor) return
    // Insert a pre-formatted mermaid code block
    editor.chain().focus().insertContent('```mermaid\ngraph TD;\n    A-->B;\n```').run()
  }

  if (!editor) return null

  return (
    <div className="rounded-md border bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <div className="flex flex-wrap items-center justify-between border-b px-2 py-1 bg-muted/40">
        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <span className="line-through font-bold px-1">S</span>
          </ToolbarButton>
          
          <div className="mx-1 h-5 w-px bg-border" />
          
          <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          
          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code">
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
            <FileCode className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertMermaid} title="Mermaid Diagram">
            <span className="text-xs font-semibold px-1">Diagram</span>
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton active={editor.isActive('link')} onClick={insertLink} title="Link">
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertImage} title="Image">
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertYoutube} title="YouTube Video">
            <Video className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
        
        <div className="flex items-center gap-1 text-xs">
          <button 
            type="button"
            onClick={() => setViewMode('wysiwyg')}
            className={`px-2 py-1 rounded-sm ${viewMode === 'wysiwyg' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Visual
          </button>
          <button 
            type="button"
            onClick={() => setViewMode('markdown')}
            className={`px-2 py-1 rounded-sm ${viewMode === 'markdown' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Markdown
          </button>
        </div>
      </div>

      <div className="relative">
        {viewMode === 'wysiwyg' ? (
          <EditorContent editor={editor} />
        ) : (
          <textarea
            value={rawMarkdown}
            onChange={handleRawMarkdownChange}
            className={`w-full ${minHeight} bg-transparent p-4 font-mono text-sm resize-y focus:outline-none`}
            placeholder={placeholder}
          />
        )}
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-sm transition-colors
        ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  )
}