import fs from 'fs'

type CertificateRequest = {
  subject: string
  dnsNames: string[]
  keyStrength: number
  trustChainPath: string
  issuedCertificatePath: string
}

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
  certificate: CertificateRequest | undefined
}

export type ConfigurationFile = {
  defaults: Partial<ManagedResource>
  resources: Map<string, Partial<ManagedResource>>
}

export type IdentifiedManagedResource = {
  id: string
  resource: Partial<ManagedResource>
}

export function LoadConfigurationFromFile(path: string): ConfigurationFile {
  const file = fs.readFileSync(path, 'utf-8')
  const configSource = JSON.parse(file.toString()) as ConfigurationFile
  const configMapped = {
    defaults: configSource.defaults,
    resources: new Map<string, Partial<ManagedResource>>(
      Array.from(
        Object.entries(configSource.resources).map(entry => [
          entry[0],
          {
            ...configSource.defaults,
            ...entry[1]
          }
        ])
      )
    )
  }

  return configMapped
}

/**
 * Filter the resources to find out which resources need to be targeted.
 * @param configuration - the configuration file loaded
 * @param targetResourceNames - the list of target resource names
 * @returns - the list of identified resources to target
 */
export function FilterResources(
  configuration: ConfigurationFile,
  targetResourceNames: string[]
): IdentifiedManagedResource[] {
  if (targetResourceNames.length === 0 || targetResourceNames[0] === '*') {
    // handle ALL resources
    return Array.from(configuration.resources, r => ({
      id: r[0],
      resource: r[1]
    }))
  }

  // filter by target resource names, skipping resources that don't exist
  return targetResourceNames
    .map(
      n =>
        ({
          id: n,
          resource: configuration.resources.get(n)
        }) as IdentifiedManagedResource
    )
    .filter(r => r.resource)
}
