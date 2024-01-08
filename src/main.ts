import * as core from '@actions/core';
import * as cfg from './configuration-file';

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const configuration = cfg.LoadConfigurationFromFile(core.getInput('configuration'));
    const force = core.getBooleanInput('force');
    const whatIf = core.getBooleanInput('what-if');
    const operation = core.getInput('operation');
    const resourcesFilter = core.getInput('resources');
    const secretValue1 = core.getInput('secret-value-1');
    const secretValue2 = core.getInput('secret-value-2');

    

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
