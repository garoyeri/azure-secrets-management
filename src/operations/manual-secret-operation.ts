import * as core from '@actions/core'
import { ConfigurationFile } from '../configuration-file'
import { OperationSettings } from '../operation-settings'
import { Operation } from './abstract-operation'
import { ManualSecretRotator } from '../rotators/manual-secret'
import { SetRotatedResourceOutput } from '../github-action-util'

export class ManualSecretOperation extends Operation {
  constructor(settings: OperationSettings) {
    super('manual-secret', settings)
  }

  async Run(
    configuration: ConfigurationFile,
    targetResources: string[]
  ): Promise<void> {
    if (targetResources.length !== 1 || targetResources[0] === '*') {
      core.setFailed(
        'Manual secret can only operate on a single resource at a time'
      )
      return
    }

    const manual = new ManualSecretRotator(this.settings)
    const resource = configuration.resources.get(targetResources[0])
    if (!resource) {
      core.setFailed(
        `Resource '${targetResources[0]}' was not found in the configuration file`
      )
      return
    }

    const result = await manual.Rotate(
      targetResources[0],
      manual.ApplyDefaults(resource)
    )

    if (result.rotated) {
      core.info(`Resource '${targetResources[0]}' was rotated`)
      SetRotatedResourceOutput([targetResources[0]])
    } else {
      core.warning(
        `Resource '${targetResources[0]}' was NOT rotated: ${result.notes}`
      )
    }
  }
}
