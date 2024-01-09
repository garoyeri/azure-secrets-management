import { Jsonable } from 'src/util'

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
    (secretExpiration.valueOf() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return daysToExpire <= expirationOverlapDays
}

export class RotationResult {
  public readonly name: string
  public readonly rotated: boolean
  public readonly notes: string
  public readonly context: Jsonable

  constructor(
    name: string,
    rotated: boolean,
    notes: string = '',
    context: Jsonable = {}
  ) {
    this.name = name
    this.rotated = rotated
    this.notes = notes
    this.context = context
  }
}
