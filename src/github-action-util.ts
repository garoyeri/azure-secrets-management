import * as core from '@actions/core'

export function SetRotatedResourceOutput(
  rotatedResources: string[] = []
): void {
  core.setOutput('rotated-resources', rotatedResources.join(','))
}
