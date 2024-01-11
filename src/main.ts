import * as core from '@actions/core'
import * as cfg from './configuration-file'
import { DefaultAzureCredential } from '@azure/identity'
import { OperationSettings, ParseResourceList } from './operation-settings'
import { ManualSecretOperation } from './operations/manual-secret'
import { Operation } from './operations/abstract-operation'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const configuration = cfg.LoadConfigurationFromFile(
      core.getInput('configuration')
    )
    const settings = {
      force: core.getBooleanInput('force'),
      whatIf: core.getBooleanInput('what-if'),
      operation: core.getInput('operation'),
      resourcesFilter: core.getInput('resources'),
      secretValue1: core.getInput('secret-value-1'),
      secretValue2: core.getInput('secret-value-2'),
      credential: new DefaultAzureCredential()
    } as OperationSettings

    const targetResources = ParseResourceList(settings.resourcesFilter)

    // prepare all the supported operations
    const operations: Operation[] = [new ManualSecretOperation(settings)]

    core.info(settings.operation)
    core.info(configuration.resources.keys.toString())

    // find operation
    const operationsFound = operations.filter(
      o => o.operation === settings.operation
    )
    if (operationsFound.length === 0) {
      core.setFailed(`No operation matching '${settings.operation}' was found`)
      return
    }

    // run the operation
    await operationsFound[0].Run(configuration, targetResources)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
