
export const moveElementInArray = <T>(array: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex < 0 || fromIndex >= array.length) throw new Error(`fromIndex ${fromIndex} is out of bounds for array of length ${array.length}`)
  if (toIndex < 0) toIndex = 0
  const newArray = [...array];
  const [element] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, element);
  return newArray;
}
