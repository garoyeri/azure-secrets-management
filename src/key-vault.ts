import { DefaultAzureCredential } from '@azure/identity'
import { KeyVaultSecret, SecretClient } from '@azure/keyvault-secrets'

// Keep track of clients we've created so far and reuse them
const clients = new Map<string, SecretClient>()

/**
 * Gets a cached client or constructs and caches a new one for a Key Vault.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @returns The key vault client for secrets
 */
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

/**
 * Gets the value of a secret if it exists.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @param secretName - Name of the secret to get
 * @returns The secret if it exists, otherwise `undefined`
 */
export async function GetSecretIfExists(
  keyVault: string,
  credential: DefaultAzureCredential,
  secretName: string
): Promise<KeyVaultSecret | undefined> {
  const client = GetClient(keyVault, credential)

  let foundSecrets = 0
  for await (const found of client.listPropertiesOfSecretVersions(secretName)) {
    if (found.enabled) foundSecrets++
  }

  if (foundSecrets > 0) {
    return await client.getSecret(secretName)
  }

  return undefined
}

/**
 * Update the value of a secret.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @param secretName - Name of the secret to get
 * @param value - Value of the secret to set
 * @param expiration - Expiration of the secret
 * @param contentType - Content type of the secret (default text/plain)
 * @returns The updated secret details
 */
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
