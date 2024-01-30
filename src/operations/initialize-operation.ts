import { OperationSettings } from '../operation-settings'
import { IdentifiedManagedResource } from '../configuration-file'
import { ResourceOperation } from './abstract-resource-operation'
import { Rotator } from '../rotators/abstract-rotator'
import { RotationResult } from '../rotators/shared'

export class InitializeOperation extends ResourceOperation {
  constructor(settings: OperationSettings) {
    super('initialize', settings)
  }

  protected async PerformSingleRun(
    rotator: Rotator,
    r: IdentifiedManagedResource
  ): Promise<RotationResult> {
    return await rotator.Initialize(r.id, r.resource)
  }
}
