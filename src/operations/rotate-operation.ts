import { OperationSettings } from '../operation-settings'
import { IdentifiedManagedResource } from '../configuration-file'
import { ResourceOperation } from './abstract-resource-operation'
import { Rotator } from '../rotators/abstract-rotator'
import { RotationResult } from '../rotators/shared'

export class RotateOperation extends ResourceOperation {
  constructor(settings: OperationSettings) {
    super('rotate', settings)
  }

  protected async PerformSingleRun(
    rotator: Rotator,
    r: IdentifiedManagedResource
  ): Promise<RotationResult> {
    return await rotator.Rotate(r.id, rotator.ApplyDefaults(r.resource))
  }
}
