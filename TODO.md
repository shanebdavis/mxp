1. track parentId in nodes
2. server stores nodes as markdown files
3. client stores node in App as a map from id to node
4. client sets the children field from childrenIds using that map (and updates if childIds update)
5. support for multiple trees and node types
   - in general, a tree has all the same node types - the root node establishes the node types
   - all nodes share the same tree structure (id, parents, children and a name and description)
   - the nodes only vary in other metadata fields (e.g. readiness level, target readiness level, estimated-work-remaining, etc.)
   - each of those fields have a manual value and a calculated value (used when the manual value is not set)
   - maybe we should just add "props" and "calculatedProps" to the node structure
   - also add crossReferencedNodeIds to all nodes (for the future)
