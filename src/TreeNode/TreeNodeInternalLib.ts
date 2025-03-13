export const moveIdentifierInArray = (
  identifierArray: string[],
  identifier: string,
  targetIndex: number
): string[] => {
  const adjustedIndex = Math.max(0, Math.min(targetIndex, identifierArray.length - 1))
  const currentIndex = identifierArray.indexOf(identifier)
  if (currentIndex === -1) return [...identifierArray]

  const newArray = [...identifierArray]
  newArray.splice(currentIndex, 1)
  newArray.splice(adjustedIndex, 0, identifier)
  return newArray
}