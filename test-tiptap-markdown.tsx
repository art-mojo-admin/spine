import { renderToString } from 'react-dom/server'
import { generateHTML } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const content = "Support Agent Guide\n\n## Handling Tickets\n1. New tickets appear"

const html = generateHTML(content, [
  StarterKit,
  Markdown
])

console.log("HTML Output:")
console.log(html)
