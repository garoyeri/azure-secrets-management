import { ConfigurationFile } from '../configuration-file'
import { OperationSettings } from '../operation-settings'

export abstract class Operation {
  readonly operation: string
  readonly settings: OperationSettings

  constructor(operation: string, settings: OperationSettings) {
    this.operation = operation
    this.settings = settings
  }

  abstract Run(
    configuration: ConfigurationFile,
    targetResources: string[]
  ): Promise<void>
}
