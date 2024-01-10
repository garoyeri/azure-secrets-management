
export function AddDays(start: Date, days: number): Date {
  return new Date(start.valueOf() + days * 24 * 60 * 60 * 1000)
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
