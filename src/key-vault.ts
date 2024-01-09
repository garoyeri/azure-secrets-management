import { DefaultAzureCredential } from '@azure/identity'
import { KeyVaultSecret, SecretClient } from '@azure/keyvault-secrets'

// Keep track of clients we've created so far and reuse them
let clients = new Map<string, SecretClient>()

export function GetClient(
  keyVault: string,
  credential: DefaultAzureCredential
): SecretClient {
  const cached = clients.get(keyVault)
  if (cached) return cached

  const newClient = new SecretClient(
    `https://${keyVault}.vault.azure.net`,
    credential
  )
  clients.set(keyVault, newClient)

  return newClient
}

export async function GetSecretIfExists(
  keyVault: string,
  credential: DefaultAzureCredential,
  secretName: string
): Promise<KeyVaultSecret | undefined> {
  const client = GetClient(keyVault, credential)

  let foundSecrets = 0
  for await (const found of client.listPropertiesOfSecretVersions(secretName)) {
    foundSecrets++
  }

  if (foundSecrets > 0) {
    return await client.getSecret(secretName)
  }

  return undefined
}

export async function UpdateSecret(
  keyVault: string,
  credential: DefaultAzureCredential,
  secretName: string,
  value: string,
  expiration?: Date,
  contentType?: string
): Promise<KeyVaultSecret> {
  const client = GetClient(keyVault, credential)

  const result = await client.setSecret(secretName, value, {
    contentType: contentType ?? 'text/plain',
    expiresOn: expiration
  })

  return result
}
