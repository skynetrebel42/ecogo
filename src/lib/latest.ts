// latest.ts — "latest photo wins" (RW1-01): a slow read, blur check or photo preparation must never overwrite newer state.

/** Returns `begin`: call it when anything new starts (a photo, a crop, Type it, Skip, Retake, Close, a reset). It returns
 *  a check that stays true only until the next `begin`, so an await's result is dropped once something newer started. */
export function latestWins(): () => () => boolean {
  let current = 0;
  return () => {
    const id = ++current;
    return () => id === current;
  };
}
