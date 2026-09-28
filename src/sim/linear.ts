/**
 * Dense linear solver: Gaussian elimination with partial pivoting.
 * Circuits in the game are small (tens to a few hundred unknowns), so dense is fine.
 */

export class SingularMatrixError extends Error {
  constructor(public readonly column: number) {
    super(`Matrix is singular at column ${column}`);
  }
}

/** Solves A x = b. A is row-major n*n and is modified in place; b is copied. */
export function solveLinear(A: Float64Array, bIn: Float64Array, n: number): Float64Array {
  const b = Float64Array.from(bIn);
  let scale = 0;
  for (let i = 0; i < n * n; i++) scale = Math.max(scale, Math.abs(A[i]!));
  const tiny = Math.max(scale, 1) * 1e-20;

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let best = Math.abs(A[col * n + col]!);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]!);
      if (v > best) { best = v; pivotRow = r; }
    }
    if (best <= tiny) throw new SingularMatrixError(col);

    if (pivotRow !== col) {
      for (let c = 0; c < n; c++) {
        const t = A[col * n + c]!;
        A[col * n + c] = A[pivotRow * n + c]!;
        A[pivotRow * n + c] = t;
      }
      const t = b[col]!; b[col] = b[pivotRow]!; b[pivotRow] = t;
    }

    const p = A[col * n + col]!;
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col]! / p;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r * n + c] = A[r * n + c]! - f * A[col * n + c]!;
      b[r] = b[r]! - f * b[col]!;
    }
  }

  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let c = r + 1; c < n; c++) s -= A[r * n + c]! * x[c]!;
    x[r] = s / A[r * n + r]!;
  }
  return x;
}
