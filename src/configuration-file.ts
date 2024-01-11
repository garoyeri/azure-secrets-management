import fs from 'fs'

export type ManagedResource = {
  type: string
  name: string
  resourceGroup: string
  keyVault: string
  keyVaultSecretPrefix: string
  expirationDays: number
  expirationOverlapDays: number
  contentType: string
  decodeBase64: boolean
}

export type ConfigurationFile = {
  defaults: Partial<ManagedResource>
  resources: Map<string, Partial<ManagedResource>>
}

export function LoadConfigurationFromFile(path: string): ConfigurationFile {
  const file = fs.readFileSync(path, 'utf-8')
  const configSource = JSON.parse(file.toString()) as ConfigurationFile
  const configMapped = {
    defaults: configSource.defaults,
    resources: new Map<string, Partial<ManagedResource>>(
      Array.from(configSource.resources.entries()).map(entry => [
        entry[0],
        {
          ...configSource.defaults,
          ...entry[1]
        }
      ])
    )
  }

  return configMapped
}
