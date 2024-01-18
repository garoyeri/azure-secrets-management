import { OperationSettings } from '../operation-settings'
import { Rotator } from './abstract-rotator'
import { ManagedResource } from '../configuration-file'
import { RotationResult, ShouldRotate } from './shared'
import { GetCertificateClient, GetCertificateIfExists } from '../key-vault'

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
    resource: ManagedResource
  ): Promise<RotationResult> {
    const scrubbedResource = this.ApplyDefaults(resource)
    const client = GetCertificateClient(
      resource.keyVault,
      this.settings.credential
    )
    const secretName = scrubbedResource.keyVaultSecretPrefix + configurationId
    const certificateFound = await GetCertificateIfExists(
      scrubbedResource.keyVault,
      this.settings.credential,
      secretName
    )

    if (!certificateFound) {
      // no certificate, create new CSR request
      // TODO: create new CSR request
      return new RotationResult(
        configurationId,
        true,
        'Created new certificate request, check for CSR',
        {
          csr: ''
        }
      )
    }

    // certificate was found, lets see the status and if we need to evaluate
    const shouldRotate = ShouldRotate(
      certificateFound.properties.expiresOn,
      scrubbedResource.expirationOverlapDays
    )
    const poller = await client.getCertificateOperation(secretName)
    const status = poller.getOperationState()
    if (status.isCompleted || status.isCancelled) {
      // there's no pending operation
      return new RotationResult(
        configurationId,
        false,
        'Certificate already in completed or cancelled state, no pending CSR'
      )
    } else if (status.isStarted) {
      // there's a pending operation, get the CSR
      return new RotationResult(
        configurationId,
        false,
        'Certificate request in progress, check for CSR',
        {
          csr: this.ConvertCsrToText(status.certificateOperation?.csr)
        }
      )
    } else {
      // create a new CSR request
    }
  }

  async Rotate(
    configurationId: string,
    resource: ManagedResource
  ): Promise<RotationResult> {
    throw new Error('Method not implemented.')
  }

  protected ConvertCsrToText(csr: Uint8Array | undefined): string {
    if (!csr) return ''

    const base64Csr = Buffer.from(csr).toString('base64')
    const wrappedCsr = `-----BEGIN CERTIFICATE REQUEST-----
  ${base64Csr}
  -----END CERTIFICATE REQUEST-----`

    return wrappedCsr
  }
}
