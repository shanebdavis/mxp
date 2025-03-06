export interface DragItem {
  id: string
  parentId?: string | null
  type?: string
}

export type DropPosition = 'before' | 'after' | 'inside' | null

export interface DragOverState {
  position: DropPosition
  isValid: boolean
}

export interface DragTarget {
  nodeId: string | null
  position: DropPosition
  indexInParent: number | null
}

export interface DropIndicatorState {
  top: number
  show: boolean
  isLine: boolean
  parentTop?: number
  indentLevel?: number
}
