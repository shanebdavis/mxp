import { TreeNode, TreeNodeProperties } from "./TreeNode";

export interface ViewStateMethods {
  selectNodeAndFocus: (node: TreeNode | null | undefined) => void
  addAndFocusNode: (nodeProperties: TreeNodeProperties, parentId: string, insertAtIndex?: number) => Promise<TreeNode | undefined>
  setEditingNodeId: (nodeId: string | null) => void
}


// TODO: this should be a useViewState hook that has the state and methods; currently App.tsx has the state and methods.