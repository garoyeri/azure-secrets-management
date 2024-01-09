import { DefaultAzureCredential } from '@azure/identity'
import { CertificateClient, KeyVaultCertificate, KeyVaultCertificateWithPolicy } from '@azure/keyvault-certificates'
import { KeyVaultSecret, SecretClient } from '@azure/keyvault-secrets'

// Keep track of clients we've created so far and reuse them
const secretClients = new Map<string, SecretClient>()
const certificateClients = new Map<string, CertificateClient>()

/**
 * Gets a cached client or constructs and caches a new one for a Key Vault.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @returns The key vault client for secrets
 */
export function GetSecretClient(
  keyVault: string,
  credential: DefaultAzureCredential
): SecretClient {
  const cached = secretClients.get(keyVault)
  if (cached) return cached

  const newClient = new SecretClient(
    `https://${keyVault}.vault.azure.net`,
    credential
  )
  secretClients.set(keyVault, newClient)

  return newClient
}

/**
 * Gets a cached client or constructs and caches a new one for a Key Vault.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @returns The key vault client for certificates
 */
export function GetCertificateClient(
  keyVault: string,
  credential: DefaultAzureCredential
): CertificateClient {
  const cached = certificateClients.get(keyVault)
  if (cached) return cached

  const newClient = new CertificateClient(
    `https://${keyVault}.vault.azure.net`,
    credential
  )
  certificateClients.set(keyVault, newClient)

  return newClient
}


/**
 * Gets the value of a secret if it exists.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @param name - Name of the secret to get
 * @returns The secret if it exists, otherwise `undefined`
 */
export async function GetSecretIfExists(
  keyVault: string,
  credential: DefaultAzureCredential,
  name: string
): Promise<KeyVaultSecret | undefined> {
  const client = GetSecretClient(keyVault, credential)

  let foundSecrets = 0
  for await (const found of client.listPropertiesOfSecretVersions(name)) {
    if (found.enabled) foundSecrets++
  }

  if (foundSecrets > 0) {
    return await client.getSecret(name)
  }

  return undefined
}

/**
 * Update the value of a secret.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @param name - Name of the secret to get
 * @param value - Value of the secret to set
 * @param expiration - Expiration of the secret
 * @param contentType - Content type of the secret (default text/plain)
 * @returns The updated secret details
 */
export async function UpdateSecret(
  keyVault: string,
  credential: DefaultAzureCredential,
  name: string,
  value: string,
  expiration?: Date,
  contentType?: string
): Promise<KeyVaultSecret> {
  const client = GetSecretClient(keyVault, credential)

  const result = await client.setSecret(name, value, {
    contentType: contentType ?? 'text/plain',
    expiresOn: expiration
  })

  return result
}

/**
 * Gets the value of a certificate if it exists.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @param name - Name of the secret to get
 * @returns The secret if it exists, otherwise `undefined`
 */
export async function GetCertificateIfExists(
  keyVault: string,
  credential: DefaultAzureCredential,
  name: string
): Promise<KeyVaultCertificateWithPolicy | undefined> {
  const client = GetCertificateClient(keyVault, credential)

  let foundSecrets = 0
  for await (const found of client.listPropertiesOfCertificateVersions(name)) {
    if (found.enabled) foundSecrets++
  }

  if (foundSecrets > 0) {
    return await client.getCertificate(name)
  }

  return undefined
}

/**
 * Import certificate.
 *
 * @param keyVault - Name of the key vault to use
 * @param credential - Azure credential to use
 * @param name - Name of the certificate to update
 * @param value - Value of the certificate to set
 * @param password - Password of the source certificate if set (use empty string for no password)
 * @param contentType - Content type of the secret (default application/x-pkcs12)
 * @returns The updated secret details
 */
export async function ImportCertificate(
  keyVault: string,
  credential: DefaultAzureCredential,
  name: string,
  value: Uint8Array,
  password: string = '',
): Promise<KeyVaultCertificateWithPolicy> {
  const client = GetCertificateClient(keyVault, credential)

  const result = await client.importCertificate(name, value, {
    password: password,
    policy: {
      exportable: true,
      contentType: 'application/x-pkcs12'
    }
  })

  return result
}
