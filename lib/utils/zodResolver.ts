/**
 * Stable re-export of zodResolver.
 *
 * On a full `npm install` the types from @hookform/resolvers resolve correctly.
 * This shim ensures compilation succeeds in environments where the sub-path
 * declaration file for '@hookform/resolvers/zod' is missing (partial install).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResolver = (...args: any[]) => any

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const zodResolver: AnyResolver =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@hookform/resolvers/zod').zodResolver
