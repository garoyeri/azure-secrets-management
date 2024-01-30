import { DefaultAzureCredential } from '@azure/identity'
import { CertificateClient } from '@azure/keyvault-certificates'
import { SecretClient } from '@azure/keyvault-secrets'

import type {
  CertificateContentType,
  CertificateOperationState,
  KeyVaultCertificateWithPolicy
} from '@azure/keyvault-certificates'
import type { KeyVaultSecret } from '@azure/keyvault-secrets'
import { OperationSettings } from './operation-settings'
import {
  KeyStrength,
  CreatePolicy,
  ParsePemToCertificates
} from './crypto-util'

// Keep track of clients we've created so far and reuse them
const secretClients = new Map<string, SecretClient>()
const certificateClients = new Map<string, CertificateClient>()

export class KeyVaultClient {
  private readonly client: CertificateClient
  private readonly settings: OperationSettings

  constructor(settings: OperationSettings, vaultName: string) {
    this.settings = settings
    this.client = GetCertificateClient(vaultName, settings.credential)
  }

  /**
   * Gets the value of a certificate if it exists.
   *
   * @param name - Name of the secret to get
   * @returns The secret if it exists, otherwise `undefined`
   */
  async GetCertificateIfExists(
    name: string
  ): Promise<KeyVaultCertificateWithPolicy | undefined> {
    let foundSecrets = 0
    for await (const found of this.client.listPropertiesOfCertificateVersions(
      name
    )) {
      if (found.enabled) foundSecrets++
    }

    if (foundSecrets > 0) {
      return await this.client.getCertificate(name)
    }

    return undefined
  }

  /**
   * Import certificate.
   *
   * @param name - Name of the certificate to update
   * @param value - Value of the certificate to set
   * @param password - Password of the source certificate if set (use empty string for no password)
   * @param contentType - Content type of the secret (default application/x-pkcs12)
   * @returns The updated secret details
   */
  async ImportCertificate(
    name: string,
    value: Uint8Array,
    password = '',
    contentType: CertificateContentType = 'application/x-pkcs12'
  ): Promise<KeyVaultCertificateWithPolicy> {
    const result = await this.client.importCertificate(name, value, {
      password,
      policy: {
        exportable: true,
        contentType
      }
    })

    return result
  }

  async CheckCertificateRequest(
    name: string
  ): Promise<CertificateOperationState> {
    const poller = await this.client.getCertificateOperation(name)
    const status = poller.getOperationState()

    return status
  }

  async CreateCsr(
    name: string,
    subject: string,
    keyStrength: KeyStrength,
    dnsNames: string[]
  ): Promise<CertificateOperationState> {
    const policy = CreatePolicy(subject, keyStrength, dnsNames)

    await this.client.beginCreateCertificate(name, policy)
    const status = await this.CheckCertificateRequest(name)

    return status
  }

  async MergeCertificate(
    name: string,
    certificateChainPem: string
  ): Promise<KeyVaultCertificateWithPolicy> {
    const certificates = ParsePemToCertificates(certificateChainPem)
    const result = await this.client.mergeCertificate(
      name,
      certificates.map(c => Buffer.from(c.toString()))
    )

    return result
  }
}

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
  const name = keyVault.toLowerCase()
  const cached = certificateClients.get(name)
  if (cached) return cached

  const newClient = new CertificateClient(
    `https://${name}.vault.azure.net`,
    credential
  )
  certificateClients.set(name, newClient)

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
  password = ''
): Promise<KeyVaultCertificateWithPolicy> {
  const client = GetCertificateClient(keyVault, credential)

  const result = await client.importCertificate(name, value, {
    password,
    policy: {
      exportable: true,
      contentType: 'application/x-pkcs12'
    }
  })

  return result
}
