import { ConfigurationFile } from '../configuration-file'
import { OperationSettings } from '../operation-settings'
import { Operation } from './abstract-operation'

export class NothingOperation extends Operation {
  constructor(settings: OperationSettings) {
    super('nothing', settings)
  }

  async Run(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    configuration: ConfigurationFile,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    targetResources: string[]
  ): Promise<void> {}
}
