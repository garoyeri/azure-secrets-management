import * as core from '@actions/core'
import {
  ConfigurationFile,
  FilterResources,
  IdentifiedManagedResource
} from '../configuration-file'
import { Operation } from './abstract-operation'
import { Resolve } from '../rotators/rotators'
import { AbstractRotator } from '../rotators/abstract-rotator'
import { RotationResult } from '../rotators/shared'

export abstract class ResourceOperation extends Operation {
  async Run(
    configuration: ConfigurationFile,
    targetResources: string[]
  ): Promise<void> {
    const targetResourceDetails = FilterResources(
      configuration,
      targetResources
    )

    for (const r of targetResourceDetails) {
      const rotator = Resolve(r.resource.type ?? '')
      if (!rotator) {
        // skip
        core.warning(
          `Resource '${r.id}' of type '${
            r.resource.type ?? ''
          }' is not a supported resource type`
        )
        continue
      }

      try {
        const result = await this.PerformSingleRun(rotator, r)

        // validate
        if (result.rotated) {
          core.info(`Resource '${r.id}' was processed`)
        } else {
          core.warning(`Resource '${r.id}' was not processed: ${result.notes}`)
        }
      } catch (error) {
        if (error instanceof Error) {
          core.error(
            `Resource '${r.id}' encountered an error: '${error.message}'`
          )
        }
      }
    }
  }

  protected abstract PerformSingleRun(
    rotator: AbstractRotator,
    r: IdentifiedManagedResource
  ): Promise<RotationResult>
}
