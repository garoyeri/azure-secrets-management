import * as core from '@actions/core'
import * as cfg from './configuration-file'
import { DefaultAzureCredential } from '@azure/identity'
import { OperationSettings } from './operation-settings'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const configuration = cfg.LoadConfigurationFromFile(
      core.getInput('configuration')
    )
    const settings = <OperationSettings>{
      force: core.getBooleanInput('force'),
      whatIf: core.getBooleanInput('what-if'),
      operation: core.getInput('operation'),
      resourcesFilter: core.getInput('resources'),
      secretValue1: core.getInput('secret-value-1'),
      secretValue2: core.getInput('secret-value-2'),
      credential: new DefaultAzureCredential()
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
