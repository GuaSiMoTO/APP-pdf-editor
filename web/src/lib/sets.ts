/** Copia del conjunto con `value` añadido o quitado (para estados de React inmutables). */
export function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** {0, 1, …, n-1} */
export function range(n: number): Set<number> {
  return new Set(Array.from({ length: n }, (_, i) => i))
}
