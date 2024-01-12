import { DiffDays, Jsonable } from '../util'

export function ShouldRotate(
  secretExpiration?: Date,
  expirationOverlapDays?: number
): boolean {
  // when there is no expiration, don't automatically rotate
  if (!secretExpiration) return false

  // if not specified, then rotate secrets when they are expiring or expired (not recommended)
  expirationOverlapDays ??= 0

  // dates are stored in milliseconds, so subtract and convert to days, rounded down
  const daysToExpire = Math.floor(
    DiffDays(new Date(Date.now()), secretExpiration)
  )

  return daysToExpire <= expirationOverlapDays
}

export class RotationResult {
  readonly name: string
  readonly rotated: boolean
  readonly notes: string
  readonly context: Jsonable

  constructor(
    name: string,
    rotated: boolean,
    notes = '',
    context: Jsonable = {}
  ) {
    this.name = name
    this.rotated = rotated
    this.notes = notes
    this.context = context
  }
}
