import type { Element, Root as HastRoot } from 'hast'
import type { Content as MdastContent, Root as MdastRoot } from 'mdast'
import type { Plugin } from 'unified'

import { SKIP, visit } from 'unist-util-visit'

export type CopyTargetType = 'code' | 'table' | 'math-block' | 'math-inline' | 'code-inline'

export type CopyTargetMode = 'block' | 'inline'

export interface CopyTargetMeta {
  id: string
  type: CopyTargetType
  mode: CopyTargetMode
  start: number
  end: number
}

export type CopyTargetBuckets = Record<CopyTargetType, CopyTargetMeta[]>

export interface CopyTargetDefinition {
  type: CopyTargetType
  mode: CopyTargetMode
  ariaLabel: string
  hint?: string
  hasVisibleControl: boolean
  remarkTest: (node: MdastContent) => node is MdastContent & { type: string, position?: NodePosition | null }
  hastMatch: (element: Element, context: { parent?: Element | HastRoot }) => boolean
  decorate: (params: {
    element: Element
    meta: CopyTargetMeta
    context: { parent?: Element | HastRoot, index?: number }
  }) => void
}

export interface CopyPluginConfig {
  definitions?: CopyTargetDefinition[]
}

interface NodePoint {
  line?: number
  column?: number
  offset?: number
}

interface NodePosition {
  start?: NodePoint | null
  end?: NodePoint | null
}

const defaultDefinitionsInternal: CopyTargetDefinition[] = [
  {
    type: 'code',
    mode: 'block',
    ariaLabel: 'Copy code block',
    hasVisibleControl: true,
    remarkTest: (node): node is MdastContent & { type: 'code', position?: NodePosition | null } => node.type === 'code',
    hastMatch: element => element.tagName === 'pre',
    decorate: ({ element, meta }) => {
      addClass(element, 'markdown-copy-target')
      addClass(element, 'markdown-copy-target--code')
      ensureDataset(element, meta)
      addClass(element, 'markdown-copy-has-control')
      addClass(element, 'markdown-copy-code')

      const button = createCopyButton(meta, 'Copy code block')
      element.children.unshift(button)
    },
  },
  {
    type: 'table',
    mode: 'block',
    ariaLabel: 'Copy table',
    hasVisibleControl: true,
    remarkTest: (node): node is MdastContent & { type: 'table', position?: NodePosition | null } => node.type === 'table',
    hastMatch: element => element.tagName === 'table',
    decorate: ({ element, meta, context }) => {
      const parent = context.parent
      const index = context.index
      if (!parent || typeof index !== 'number')
        return

      const container = createBlockContainer(meta, 'table')
      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['markdown-copy-table-wrapper'],
        },
        children: [element],
      }

      container.children.push(createCopyHeader(meta, 'Copy table'))
      container.children.push(wrapper)

      // Replace original table with the enhanced container.
      const parentChildren = parent.children as Element[]
      parentChildren.splice(index, 1, container)
    },
  },
  {
    type: 'math-block',
    mode: 'block',
    ariaLabel: 'Copy math block',
    hasVisibleControl: true,
    remarkTest: (node): node is MdastContent & { type: 'math', position?: NodePosition | null } => node.type === 'math',
    hastMatch: element => element.tagName === 'span' && readClassList(element).includes('katex-display'),
    decorate: ({ element, meta, context }) => {
      const parent = context.parent
      const index = context.index
      if (!parent || typeof index !== 'number')
        return

      const container = createBlockContainer(meta, 'math')
      container.children.push(createCopyHeader(meta, 'Copy math block'))

      const body: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['markdown-copy-math-body'],
        },
        children: [element],
      }

      container.children.push(body)
      const parentChildren = parent.children as Element[]
      parentChildren.splice(index, 1, container)
    },
  },
  {
    type: 'math-inline',
    mode: 'inline',
    ariaLabel: 'Copy inline math',
    hint: 'click to copy',
    hasVisibleControl: false,
    remarkTest: (node): node is MdastContent & { type: 'inlineMath', position?: NodePosition | null } => node.type === 'inlineMath',
    hastMatch: (element, { parent }) => {
      if (element.tagName !== 'span')
        return false

      const classList = readClassList(element)
      if (!classList.includes('katex') || classList.includes('katex-display'))
        return false

      if (parent && parent.type === 'element' && readClassList(parent).includes('katex-display'))
        return false

      return true
    },
    decorate: ({ element, meta }) => {
      addClass(element, 'markdown-copy-inline')
      ensureDataset(element, meta)
      element.properties ??= {}
      element.properties['data-copy-role'] = 'inline'
      element.properties['data-copy-hint'] = 'click to copy'
      ;(element.properties as Record<string, unknown>).tabIndex = 0
      ;(element.properties as Record<string, unknown>).role = 'button'
      element.properties['aria-label'] = 'Copy inline math'
    },
  },
  {
    type: 'code-inline',
    mode: 'inline',
    ariaLabel: 'Copy inline code',
    hint: 'click to copy',
    hasVisibleControl: false,
    remarkTest: (node): node is MdastContent & { type: 'inlineCode', position?: NodePosition | null } => node.type === 'inlineCode',
    hastMatch: (element, { parent }) => {
      if (element.tagName !== 'code')
        return false

      if (parent && parent.type === 'element' && parent.tagName === 'pre')
        return false

      return true
    },
    decorate: ({ element, meta }) => {
      addClass(element, 'markdown-copy-inline')
      addClass(element, 'markdown-copy-inline-code')
      ensureDataset(element, meta)
      element.properties ??= {}
      element.properties['data-copy-role'] = 'inline'
      element.properties['data-copy-hint'] = 'click to copy'
      ;(element.properties as Record<string, unknown>).tabIndex = 0
      ;(element.properties as Record<string, unknown>).role = 'button'
      element.properties['aria-label'] = 'Copy inline code'
    },
  },
]

export const defaultCopyDefinitions = defaultDefinitionsInternal

export const remarkCopyCollector: Plugin<[CopyPluginConfig?], MdastRoot> = (config) => {
  const definitions = config?.definitions ?? defaultDefinitionsInternal

  return (tree, file) => {
    const buckets: CopyTargetBuckets = {
      'code': [],
      'table': [],
      'math-block': [],
      'math-inline': [],
      'code-inline': [],
    }

    const idCounter = createIdGenerator()
    const toOffset = createOffsetResolver(String((file as any).value ?? ''))

    visit(tree as MdastRoot, (node) => {
      const contentNode = node as MdastContent
      for (const definition of definitions) {
        if (!definition.remarkTest(contentNode))
          continue

        const position = contentNode.position as NodePosition | undefined
        const start = position ? toOffset(position.start) : null
        const end = position ? toOffset(position.end) : null

        if (start === null || end === null)
          continue

        const meta: CopyTargetMeta = {
          id: idCounter(),
          type: definition.type,
          mode: definition.mode,
          start,
          end,
        }

        buckets[definition.type].push(meta)
        break
      }
    })

    const data = (file as any).data || ((file as any).data = {})
    data.copyTargets = buckets
  }
}

export const rehypeCopyEnhancer: Plugin<[CopyPluginConfig?], HastRoot> = (config) => {
  const definitions = config?.definitions ?? defaultDefinitionsInternal

  return (tree, file) => {
    const buckets = ((file as any).data?.copyTargets ?? null) as CopyTargetBuckets | null
    if (!buckets)
      return

    visit(tree as unknown as HastRoot, 'element', (element: Element, index: number | undefined, parent: Element | HastRoot | undefined) => {
      for (const definition of definitions) {
        if (!definition.hastMatch(element, { parent }))
          continue

        const metaList = buckets[definition.type]
        if (!metaList?.length)
          return

        const meta = metaList.shift()
        if (!meta)
          return

        definition.decorate({
          element,
          meta,
          context: { parent, index },
        })

        if (definition.mode === 'block')
          return SKIP

        return
      }
    })
  }
}

function createIdGenerator() {
  let index = 0
  return () => {
    index += 1
    return `copy-target-${index}`
  }
}

function createOffsetResolver(input: string) {
  const lineOffsets: number[] = [0]
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\n')
      lineOffsets.push(i + 1)
  }

  return (point?: NodePoint | null): number | null => {
    if (!point)
      return null

    if (typeof point.offset === 'number')
      return clamp(point.offset, 0, input.length)

    if (typeof point.line !== 'number' || typeof point.column !== 'number')
      return null

    const lineIndex = Math.max(0, Math.min(point.line - 1, lineOffsets.length - 1))
    const base = lineOffsets[lineIndex] ?? input.length
    return clamp(base + point.column - 1, 0, input.length)
  }
}

function ensureDataset(element: Element, meta: CopyTargetMeta) {
  element.properties ??= {}
  element.properties['data-copy-id'] = meta.id
  element.properties['data-copy-type'] = meta.type
  element.properties['data-copy-start'] = String(meta.start)
  element.properties['data-copy-end'] = String(meta.end)
}

function createBlockContainer(meta: CopyTargetMeta, variant: 'table' | 'math'): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      'className': ['markdown-copy-container', `markdown-copy-container--${variant}`],
      'data-copy-id': meta.id,
      'data-copy-type': meta.type,
      'data-copy-start': String(meta.start),
      'data-copy-end': String(meta.end),
    },
    children: [],
  }
}

function createCopyHeader(meta: CopyTargetMeta, ariaLabel: string): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['markdown-copy-header'],
    },
    children: [
      createCopyButton(meta, ariaLabel),
    ],
  }
}

function createCopyButton(meta: CopyTargetMeta, ariaLabel: string): Element {
  return {
    type: 'element',
    tagName: 'button',
    properties: {
      'type': 'button',
      'className': ['markdown-copy-button'],
      'aria-label': ariaLabel,
      'data-copy-role': 'trigger',
      'data-copy-id': meta.id,
      'data-copy-type': meta.type,
      'data-copy-start': String(meta.start),
      'data-copy-end': String(meta.end),
    },
    children: [
      createIcon('copy'),
      createIcon('success'),
    ],
  }
}

function createIcon(variant: 'copy' | 'success'): Element {
  const isCopy = variant === 'copy'
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      'className': ['markdown-copy-icon', `markdown-copy-icon--${variant}`],
      'width': 16,
      'height': 16,
      'viewBox': '0 0 24 24',
      'fill': 'none',
      'stroke': 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    children: isCopy
      ? [
          {
            type: 'element',
            tagName: 'path',
            properties: {
              d: 'M16 16H8a2 2 0 0 1-2-2V6',
            },
            children: [],
          },
          {
            type: 'element',
            tagName: 'rect',
            properties: {
              x: 8,
              y: 2,
              width: 12,
              height: 12,
              rx: 2,
              ry: 2,
            },
            children: [],
          },
        ]
      : [
          {
            type: 'element',
            tagName: 'polyline',
            properties: {
              points: '20 6 9 17 4 12',
            },
            children: [],
          },
        ],
  }
}

function addClass(element: Element, className: string) {
  element.properties ??= {}
  const existing = element.properties.className

  if (Array.isArray(existing)) {
    if (!existing.includes(className))
      existing.push(className)
  }
  else if (typeof existing === 'string') {
    const classes = existing.split(/\s+/).filter(Boolean)
    if (!classes.includes(className))
      classes.push(className)
    element.properties.className = classes
  }
  else {
    element.properties.className = [className]
  }
}

function readClassList(node: Element | HastRoot | undefined) {
  if (!node || node.type !== 'element')
    return [] as string[]

  const value = node.properties?.className
  if (Array.isArray(value))
    return value.map(String)

  if (typeof value === 'string')
    return value.split(/\s+/).filter(Boolean)

  return [] as string[]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
