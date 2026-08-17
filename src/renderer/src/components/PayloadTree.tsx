import type { PayloadTreeEntry, PayloadTreeNode } from '../../../shared/payload-tree'
import { useI18n } from '../i18n'

interface PayloadTreeProps {
  tree: PayloadTreeNode
}

function nodeSummary(node: PayloadTreeNode, formatNumber: (value: number) => string): string {
  if (node.kind === 'binary') return `${formatNumber(node.byteLength ?? 0)} B`
  if (node.children) return `${formatNumber(node.totalChildren ?? node.children.length)}`
  return node.value ?? ''
}

function PayloadTreeItem({
  entry,
  depth
}: {
  entry: PayloadTreeEntry
  depth: number
}) {
  const { t, formatNumber } = useI18n()
  const node = entry.node
  const expandable = node.children !== undefined

  if (!expandable) {
    return (
      <li className={`payload-tree-item kind-${node.kind}`}>
        <code className="payload-tree-key">{entry.key}</code>
        <span className="payload-tree-separator">:</span>
        <span className="payload-tree-value" title={node.value}>{node.value || '∅'}</span>
        <small>{node.typeName ?? node.kind}</small>
        {node.truncated && <span className="tag warn">{t('payload.tree.truncated')}</span>}
      </li>
    )
  }

  return (
    <li className={`payload-tree-branch kind-${node.kind}`}>
      <details open={depth < 2}>
        <summary>
          <code className="payload-tree-key">{entry.key}</code>
          <span className="payload-tree-summary">
            {node.typeName ?? node.kind} · {nodeSummary(node, formatNumber)}
          </span>
          {node.truncated && <span className="tag warn">{t('payload.tree.truncated')}</span>}
        </summary>
        <ul>
          {node.children?.map((child, index) => (
            <PayloadTreeItem
              entry={child}
              depth={depth + 1}
              key={`${child.key}-${index}`}
            />
          ))}
        </ul>
      </details>
    </li>
  )
}

export function PayloadTree({ tree }: PayloadTreeProps) {
  return (
    <div className="payload-tree-scroll">
      <ul className="payload-tree">
        <PayloadTreeItem entry={{ key: '$', node: tree }} depth={0} />
      </ul>
    </div>
  )
}
