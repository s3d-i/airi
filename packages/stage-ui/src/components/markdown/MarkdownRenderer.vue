<script setup lang="ts">
import DOMPurify from 'dompurify'

import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useMarkdown } from '../../composables/markdown'

interface Props {
  content: string
  class?: string
}

const props = defineProps<Props>()

const processedContent = ref('')
const { process, processSync } = useMarkdown()
const rootEl = ref<HTMLElement | null>(null)

const ADDITIONAL_TAGS = [
  'del',
  'ins',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'sup',
  'sub',
  'button',
  'section',
  'aside',
  'svg',
  'path',
  'rect',
  'polyline',
  'math',
  'semantics',
  'annotation',
  'mrow',
  'mi',
  'mn',
  'mo',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'msqrt',
  'mroot',
  'mover',
  'munder',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'mstyle',
  'mspace',
  'mtext',
  'mpadded',
  'mphantom',
  'menclose',
  'mfenced',
] as const

const ADDITIONAL_ATTRIBUTES = [
  'align',
  'colspan',
  'rowspan',
  'aria-label',
  'aria-hidden',
  'data-copy-id',
  'data-copy-type',
  'data-copy-start',
  'data-copy-end',
  'data-copy-role',
  'data-copy-hint',
  'data-copy-token',
  'data-state',
  'data-footnote-ref',
  'data-footnote-backref',
  'role',
  'tabindex',
  'viewBox',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'points',
  'rx',
  'ry',
  'encoding',
  'mathvariant',
  'scriptlevel',
  'displaystyle',
] as const

DOMPurify.setConfig({
  ADD_TAGS: [...ADDITIONAL_TAGS],
  ADD_ATTR: [...ADDITIONAL_ATTRIBUTES],
})

const COPY_SUCCESS_TIMEOUT = 1000

async function processContent() {
  if (!props.content) {
    processedContent.value = ''
    return
  }

  try {
    processedContent.value = DOMPurify.sanitize(await process(props.content))
  }
  catch (error) {
    console.warn('Failed to process markdown with syntax highlighting, using fallback:', error)
    processedContent.value = DOMPurify.sanitize(processSync(props.content))
  }
}

async function copySliceFromSource(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start)
    return false

  const source = props.content ?? ''
  const slice = source.slice(start, end)
  if (!slice)
    return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(slice)
      return true
    }
  }
  catch (error) {
    console.warn('Navigator clipboard write failed, falling back to textarea copy.', error)
  }

  return fallbackCopy(slice)
}

function fallbackCopy(text: string) {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)

    const selection = document.getSelection()
    const previousRange = selection?.rangeCount ? selection.getRangeAt(0) : null

    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    const result = document.execCommand('copy')

    if (selection) {
      selection.removeAllRanges()
      if (previousRange)
        selection.addRange(previousRange)
    }

    document.body.removeChild(textarea)

    return result
  }
  catch (error) {
    console.warn('Textarea fallback copy failed.', error)
    return false
  }
}

async function handleCopyAction(target: HTMLElement) {
  const start = Number(target.dataset.copyStart)
  const end = Number(target.dataset.copyEnd)
  const success = await copySliceFromSource(start, end)

  if (!success)
    return

  if (target.dataset.copyRole === 'trigger') {
    markCopied(target)
  }
}

function markCopied(element: HTMLElement) {
  element.dataset.state = 'copied'
  const token = String(performance.now())
  element.dataset.copyToken = token
  window.setTimeout(() => {
    if (element.dataset.copyToken === token) {
      element.removeAttribute('data-state')
      delete element.dataset.copyToken
    }
  }, COPY_SUCCESS_TIMEOUT)
}

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target)
    return

  const trigger = target.closest<HTMLElement>('[data-copy-role]')
  if (!trigger)
    return

  event.preventDefault()
  event.stopPropagation()
  void handleCopyAction(trigger)
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (!target)
    return

  if (target.dataset.copyRole !== 'inline')
    return

  if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar')
    return

  event.preventDefault()
  void handleCopyAction(target)
}

// Process content when it changes
watch(() => props.content, processContent, { immediate: true })

onMounted(() => {
  processContent()
  rootEl.value?.addEventListener('click', handleClick)
  rootEl.value?.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  rootEl.value?.removeEventListener('click', handleClick)
  rootEl.value?.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    ref="rootEl"
    :class="props.class"
    class="markdown-content"
    v-html="processedContent"
  />
</template>

<style scoped>
.markdown-content :deep(pre) {
  overflow-x: auto;
  max-width: 100%;
  border-radius: 6px;
  padding: 1rem;
  margin: 0.5rem 0;
}

.markdown-content :deep(code) {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 0.875em;
}

.markdown-content :deep(pre code) {
  display: block;
  width: fit-content;
  min-width: 100%;
}

/* Ensure horizontal scrolling for wide code blocks */
.markdown-content :deep(pre.shiki) {
  overflow-x: auto;
  white-space: pre;
}

.markdown-content :deep(.shiki) {
  border-radius: 6px;
  padding: 1rem;
  margin: 0.5rem 0;
}

/* Fallback styles for non-shiki code blocks */
.markdown-content :deep(pre:not(.shiki)) {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
}

.dark .markdown-content :deep(pre:not(.shiki)) {
  background: #161b22;
  border: 1px solid #30363d;
}

.markdown-content :deep(.markdown-copy-container) {
  border: 1px solid #d0d7de;
  border-radius: 8px;
  margin: 0.75rem 0;
  overflow: hidden;
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  background: #ffffff;
}

.dark .markdown-content :deep(.markdown-copy-container) {
  border-color: #30363d;
  background: #0d1117;
}

.markdown-content :deep(.markdown-copy-header) {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0.3rem 0.5rem;
  background: rgba(15, 23, 42, 0.06);
  border-bottom: 1px solid rgba(15, 23, 42, 0.05);
}

.dark .markdown-content :deep(.markdown-copy-header) {
  background: rgba(148, 163, 184, 0.12);
  border-bottom-color: rgba(148, 163, 184, 0.16);
}

.markdown-content :deep(.markdown-copy-table-wrapper) {
  overflow-x: auto;
  max-width: 100%;
}

.markdown-content :deep(.markdown-copy-math-body),
.markdown-content :deep(.markdown-copy-table-wrapper) {
  padding: 0.75rem 1rem;
}

.markdown-content :deep(.markdown-copy-code) {
  position: relative;
  padding-top: 2.5rem;
}

.markdown-content :deep(.markdown-copy-code > .markdown-copy-button) {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
}

.markdown-content :deep(.markdown-copy-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 2.25em;
  min-width: 2.25em;
  padding: 0.25em;
  border-radius: 6px;
  border: 1px solid transparent;
  background: rgba(15, 23, 42, 0.06);
  color: inherit;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.markdown-content :deep(.markdown-copy-button:hover),
.markdown-content :deep(.markdown-copy-button:focus-visible) {
  background: rgba(15, 23, 42, 0.1);
  border-color: rgba(15, 23, 42, 0.12);
  outline: none;
}

.dark .markdown-content :deep(.markdown-copy-button) {
  background: rgba(148, 163, 184, 0.12);
}

.dark .markdown-content :deep(.markdown-copy-button:hover),
.dark .markdown-content :deep(.markdown-copy-button:focus-visible) {
  background: rgba(148, 163, 184, 0.18);
  border-color: rgba(148, 163, 184, 0.2);
}

.markdown-content :deep(.markdown-copy-icon) {
  width: 1em;
  height: 1em;
  display: block;
}

.markdown-content :deep(.markdown-copy-icon--success) {
  display: none;
  color: #1a7f37;
  stroke: #1a7f37;
}

.markdown-content :deep(.markdown-copy-button[data-state="copied"] .markdown-copy-icon--copy) {
  display: none;
}

.markdown-content :deep(.markdown-copy-button[data-state="copied"] .markdown-copy-icon--success) {
  display: block;
}

.markdown-content :deep(.markdown-copy-inline) {
  position: relative;
  display: inline-block;
  cursor: pointer;
  outline: none;
}

.markdown-content :deep(.markdown-copy-inline-code) {
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  background: rgba(15, 23, 42, 0.08);
  transition: background-color 0.2s ease;
}

.markdown-content :deep(.markdown-copy-inline-code:hover),
.markdown-content :deep(.markdown-copy-inline-code:focus-visible) {
  background: rgba(15, 23, 42, 0.12);
}

.dark .markdown-content :deep(.markdown-copy-inline-code) {
  background: rgba(148, 163, 184, 0.16);
}

.dark .markdown-content :deep(.markdown-copy-inline-code:hover),
.dark .markdown-content :deep(.markdown-copy-inline-code:focus-visible) {
  background: rgba(148, 163, 184, 0.24);
}

.markdown-content :deep(.markdown-copy-inline::after) {
  content: attr(data-copy-hint);
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translate(-50%, 0.4rem);
  background: rgba(15, 23, 42, 0.85);
  color: #f8fafc;
  font-size: 0.75rem;
  line-height: 1.1;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 5;
}

.markdown-content :deep(.markdown-copy-inline:hover::after),
.markdown-content :deep(.markdown-copy-inline:focus-visible::after) {
  opacity: 1;
  transform: translate(-50%, 0.2rem);
}

.markdown-content :deep(.markdown-copy-inline:focus-visible) {
  outline: 2px solid rgba(37, 99, 235, 0.6);
  outline-offset: 2px;
}

.dark .markdown-content :deep(.markdown-copy-inline::after) {
  background: rgba(226, 232, 240, 0.95);
  color: #0f172a;
}
</style>
