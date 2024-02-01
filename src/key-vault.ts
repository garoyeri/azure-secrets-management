import * as core from '@actions/core'
import { DefaultAzureCredential } from '@azure/identity'
import { CertificateClient } from '@azure/keyvault-certificates'
import { SecretClient } from '@azure/keyvault-secrets'
import { RestError } from '@azure/core-http'

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
  private readonly certClient: CertificateClient
  private readonly secretClient: SecretClient
  private readonly settings: OperationSettings

  constructor(settings: OperationSettings, vaultName: string) {
    this.settings = settings
    this.certClient = GetCertificateClient(vaultName, settings.credential)
    this.secretClient = GetSecretClient(vaultName, settings.credential)
  }

  /**
   * Gets the value of a secret if it exists.
   *
   * @param name - Name of the secret to get
   * @returns The secret if it exists, otherwise `undefined`
   */
  async GetSecretIfExists(name: string): Promise<KeyVaultSecret | undefined> {
    try {
      const found = await this.secretClient.getSecret(name)
      core.debug(`GetSecretIfExists(${name}): ${JSON.stringify(found)}`)
      return found
    } catch (error) {
      if (error instanceof RestError) {
        if (error.statusCode === 404) {
          core.debug(`GetCertificateIfExists(${name}): Not Found`)
          return undefined
        }
      }

      throw error
    }
  }

  /**
   * Update the value of a secret.
   *
   * @param name - Name of the secret to get
   * @param value - Value of the secret to set
   * @param expiration - Expiration of the secret
   * @param contentType - Content type of the secret (default text/plain)
   * @returns The updated secret details
   */
  async UpdateSecret(
    name: string,
    value: string,
    expiration?: Date,
    contentType?: string
  ): Promise<KeyVaultSecret> {
    const result = await this.secretClient.setSecret(name, value, {
      contentType: contentType ?? 'text/plain',
      expiresOn: expiration
    })

    return result
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
    try {
      const found = await this.certClient.getCertificate(name)
      core.debug(`GetCertificateIfExists(${name}): ${JSON.stringify(found)}`)
      return found
    } catch (error) {
      if (error instanceof RestError) {
        if (error.statusCode === 404) {
          core.debug(`GetCertificateIfExists(${name}): Not Found`)
          return undefined
        }
      }

      throw error
    }
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
    const result = await this.certClient.importCertificate(name, value, {
      password,
      policy: {
        exportable: true,
        contentType
      }
    })

    core.debug(`ImportCertificate(${name},...): ${JSON.stringify(result)}`)

    return result
  }

  async CheckCertificateRequest(
    name: string
  ): Promise<CertificateOperationState> {
    const poller = await this.certClient.getCertificateOperation(name)
    const status = poller.getOperationState()

    core.debug(`CheckCertificateRequest(${name}): ${JSON.stringify(status)}`)

    return status
  }

  async CreateCsr(
    name: string,
    subject: string,
    keyStrength: KeyStrength,
    dnsNames: string[]
  ): Promise<CertificateOperationState> {
    const policy = CreatePolicy(subject, keyStrength, dnsNames)

    await this.certClient.beginCreateCertificate(name, policy)
    const status = await this.CheckCertificateRequest(name)

    core.debug(`CreateCsr(${name},${subject}): ${JSON.stringify(status)}`)

    return status
  }

  async MergeCertificate(
    name: string,
    certificateChainPem: string
  ): Promise<KeyVaultCertificateWithPolicy> {
    const certificates = ParsePemToCertificates(certificateChainPem)
    const result = await this.certClient.mergeCertificate(
      name,
      certificates.map(c => Buffer.from(c.toString()))
    )

    core.debug(`MergeCertificate(${name},...): ${JSON.stringify(result)}`)

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
  const name = keyVault.toLowerCase()
  const cached = secretClients.get(name)
  if (cached) return cached

  const newClient = new SecretClient(
    `https://${name}.vault.azure.net`,
    credential
  )
  secretClients.set(name, newClient)

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
