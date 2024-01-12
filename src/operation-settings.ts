import { DefaultAzureCredential } from '@azure/identity'

export type OperationSettings = {
  operation: string
  resourcesFilter: string
  whatIf: boolean
  force: boolean
  secretValue1: string
  secretValue2: string
  credential: DefaultAzureCredential
}

export function ParseResourceList(resourcesFilter: string): string[] {
  if (resourcesFilter === '*') return []
  return resourcesFilter.split(',')
}
