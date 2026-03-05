import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const content = "Support Agent Guide\n\n## Handling Tickets\n1. New tickets appear"

const editor = new Editor({
  extensions: [
    StarterKit,
    Markdown
  ],
  content: content,
})

console.log("HTML Output:")
console.log(editor.getHTML())
