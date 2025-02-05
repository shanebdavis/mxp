
export interface TreeNode {
  id: string
  name: string
  readinessLevel: number  // 0-9
  children: TreeNode[]
}

export const isDescendant = (node: TreeNode, targetId: string): boolean => {
  if (node.id === targetId) return true
  return node.children.some(child => isDescendant(child, targetId))
}

export const dummyData: TreeNode = {
  id: 'root',
  name: 'Project Root',
  readinessLevel: 3,
  children: [
    {
      id: '1',
      name: 'Frontend Development',
      readinessLevel: 2,
      children: [
        {
          id: '1.1',
          name: 'User Interface',
          readinessLevel: 1,
          children: []
        },
        {
          id: '1.2',
          name: 'Authentication',
          readinessLevel: 0,
          children: []
        }
      ]
    },
    {
      id: '2',
      name: 'Backend Development',
      readinessLevel: 1,
      children: [
        {
          id: '2.1',
          name: 'API Design',
          readinessLevel: 2,
          children: []
        }
      ]
    }
  ]
}
