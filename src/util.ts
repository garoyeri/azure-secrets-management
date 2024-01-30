const millisecondsPerDay = 24 * 60 * 60 * 1000

export function AddDays(start: Date, days: number): Date {
  return new Date(start.valueOf() + days * millisecondsPerDay)
}

export function DiffDays(from: Date, to: Date): number {
  return (to.valueOf() - from.valueOf()) / millisecondsPerDay
}

export function ConvertCsrToText(csr: Uint8Array | undefined): string {
  if (!csr) return ''

  const base64Csr = Buffer.from(csr).toString('base64')
  const wrappedCsr = `-----BEGIN CERTIFICATE REQUEST-----
${base64Csr}
-----END CERTIFICATE REQUEST-----`

  return wrappedCsr
}

/*
  Jsonable and ActionError inspired by article here:
  https://medium.com/with-orus/the-5-commandments-of-clean-error-handling-in-typescript-93a9cbdf1af5
*/

export type Jsonable =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly Jsonable[]
  | { readonly [key: string]: Jsonable }
  | { toJSON(): Jsonable }

export class ActionError extends Error {
  readonly context?: Jsonable

  constructor(
    message: string,
    options: { cause?: Error; context?: Jsonable } = {}
  ) {
    const { cause, context } = options
    super(message, { cause })

    this.name = this.constructor.name
    this.context = context
  }
}
