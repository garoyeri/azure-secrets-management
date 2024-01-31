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

export class InspectionResult {
  readonly name: string
  readonly type: string
  readonly expiresOn: Date | undefined
  readonly updatedOn: Date | undefined
  readonly secretId: string
  readonly resourceId: string
  readonly notes: string

  constructor(
    name: string,
    type: string,
    secretId?: string,
    notes?: string,
    resourceId?: string,
    updatedOn?: Date,
    expiresOn?: Date
  ) {
    this.name = name
    this.type = type
    this.secretId = secretId ?? ''
    this.notes = notes ?? ''
    this.resourceId = resourceId ?? ''
    this.updatedOn = updatedOn
    this.expiresOn = expiresOn
  }

  toJSON(): Jsonable {
    return {
      name: this.name,
      type: this.type,
      expiresOn: this.expiresOn,
      updatedOn: this.updatedOn,
      secretId: this.secretId,
      resourceId: this.resourceId,
      notes: this.notes
    }
  }
}
