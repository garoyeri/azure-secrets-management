import * as fs from 'fs'
import { OperationSettings } from '../operation-settings'
import { Rotator } from './abstract-rotator'
import { ManagedResource } from '../configuration-file'
import { RotationResult, ShouldRotate } from './shared'
import { KeyVaultClient } from '../key-vault'
import { ConvertCsrToText } from '../util'
import { KeyStrength } from '../crypto-util'

const validKeyStrengths = new Set([2048, 3072, 4096])

export class KeyVaultSslCertificateRotator implements Rotator {
  readonly type: string = 'azure/keyvault/ssl-certificate'
  readonly settings: OperationSettings

  constructor(settings: OperationSettings) {
    this.settings = settings
  }

  ApplyDefaults(resource: Partial<ManagedResource>): ManagedResource {
    return {
      name: resource.name ?? '',
      contentType: resource.contentType ?? 'application/x-pem-file',
      decodeBase64: resource.decodeBase64 ?? false,
      expirationDays: resource.expirationDays,
      expirationOverlapDays: resource.expirationOverlapDays ?? 0,
      keyVault: resource.keyVault ?? '',
      keyVaultSecretPrefix: resource.keyVaultSecretPrefix ?? '',
      resourceGroup: resource.resourceGroup ?? '',
      type: resource.type ?? '',
      certificate: {
        subject: resource.certificate?.subject ?? '',
        dnsNames: resource.certificate?.dnsNames ?? [],
        keyStrength: resource.certificate?.keyStrength ?? 2048,
        issuedCertificatePath:
          resource.certificate?.issuedCertificatePath ?? '',
        trustChainPath: resource.certificate?.trustChainPath ?? ''
      }
    } as ManagedResource
  }

  /**
   * Initialize the SSL Certificate in Key Vault, fetching the CSR
   * @param configurationId - ID of the certificate in the configuration file
   * @param resource - Resource details of the certificate from the configuration file
   * @returns - Rotation result, context will contain the string of the CSR in context.csr if successful
   */
  async Initialize(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<RotationResult> {
    const scrubbedResource = this.ApplyDefaults(resource)
    const client = new KeyVaultClient(this.settings, scrubbedResource.keyVault)
    const secretName = scrubbedResource.keyVaultSecretPrefix + configurationId
    const certificateFound = await client.GetCertificateIfExists(secretName)

    if (certificateFound) {
      // certificate was found, lets see the status and if we need to evaluate
      const shouldRotate = ShouldRotate(
        certificateFound.properties.expiresOn,
        scrubbedResource.expirationOverlapDays
      )
      const status = await client.CheckCertificateRequest(secretName)
      if (status.isStarted && !this.settings.force) {
        // there's a pending operation (and we're not forcing), get the CSR
        return new RotationResult(
          configurationId,
          true,
          'Certificate request in progress, check for CSR',
          {
            csr: ConvertCsrToText(status.certificateOperation?.csr)
          }
        )
      }

      if (!shouldRotate && !this.settings.force) {
        // no need to start a CSR: not time to rotate, and not being forced
        // return empty CSR result
        return new RotationResult(
          configurationId,
          false,
          'Not time to rotate yet',
          {
            csr: ''
          }
        )
      }
    }

    // shouldRotate == true or this is a new certificate, time to request a new CSR!

    if (!scrubbedResource.certificate?.subject) {
      return new RotationResult(
        configurationId,
        false,
        'Certificate subject is required to request CSR'
      )
    }
    if (!validKeyStrengths.has(scrubbedResource.certificate.keyStrength)) {
      return new RotationResult(
        configurationId,
        false,
        'Certificate keyStrength must be 2048, 3072, or 4096'
      )
    }
    if (
      !scrubbedResource.certificate?.dnsNames ||
      scrubbedResource.certificate.dnsNames.length === 0
    ) {
      return new RotationResult(
        configurationId,
        false,
        'At least one DNS name is required'
      )
    }

    const result = await client.CreateCsr(
      secretName,
      scrubbedResource.certificate.subject,
      scrubbedResource.certificate.keyStrength as KeyStrength,
      scrubbedResource.certificate.dnsNames
    )

    if (!result.certificateOperation?.csr) {
      return new RotationResult(
        configurationId,
        false,
        'Unknown error getting CSR after beginCreateCertificate',
        {
          csr: '',
          status: JSON.stringify(result)
        }
      )
    }

    return new RotationResult(
      configurationId,
      true,
      'Certificate request in progress, check for CSR',
      {
        csr: ConvertCsrToText(result.certificateOperation?.csr)
      }
    )
  }

  async Rotate(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<RotationResult> {
    const scrubbedResource = this.ApplyDefaults(resource)
    const client = new KeyVaultClient(this.settings, scrubbedResource.keyVault)
    const secretName = scrubbedResource.keyVaultSecretPrefix + configurationId
    const certificateFound = await client.GetCertificateIfExists(secretName)

    if (!certificateFound) {
      // no certificate, bail out
      return new RotationResult(
        configurationId,
        false,
        'No certificate found, initialize first'
      )
    }

    const shouldRotate = ShouldRotate(
      certificateFound.properties.expiresOn,
      scrubbedResource.expirationOverlapDays
    )

    const status = await client.CheckCertificateRequest(secretName)
    if (!status.isStarted) {
      // CSR wasn't started, bail out
      return new RotationResult(
        configurationId,
        false,
        'CSR not generated, initialize first'
      )
    } else if (!shouldRotate && !this.settings.force) {
      // it's not yet time to rotate (and we're not forcing), bail out
      return new RotationResult(
        configurationId,
        false,
        'Not time to rotate yet, wait for overlap period or try to force'
      )
    }

    const trustChain = resource.certificate?.trustChainPath
      ? fs.readFileSync(resource.certificate?.trustChainPath, 'utf-8')
      : ''
    const certificate = resource.certificate?.issuedCertificatePath
      ? fs.readFileSync(resource.certificate?.issuedCertificatePath, 'utf-8')
      : ''

    // CSR is started, and it's time to rotate (or we're forcing) so let's merge
    const result = await client.MergeCertificate(
      secretName,
      `${trustChain}\n${certificate}`
    )

    return new RotationResult(
      configurationId,
      true,
      'Merged certificate successfully',
      {
        thumbprint: result.properties.x509Thumbprint?.toString() ?? ''
      }
    )
  }
}
