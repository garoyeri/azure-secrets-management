import * as fs from 'fs'
import { OperationSettings } from '../operation-settings'
import { Rotator } from './abstract-rotator'
import { ManagedResource } from '../configuration-file'
import { RotationResult, ShouldRotate } from './shared'
import { GetCertificateClient, GetCertificateIfExists } from '../key-vault'
import type {
  ArrayOneOrMore,
  CertificatePolicy,
  CertificateClient
} from '@azure/keyvault-certificates'
import { ConvertCsrToText } from '../util'

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

    if (certificateFound) {
      // certificate was found, lets see the status and if we need to evaluate
      const shouldRotate = ShouldRotate(
        certificateFound.properties.expiresOn,
        scrubbedResource.expirationOverlapDays
      )
      const poller = await client.getCertificateOperation(secretName)
      const status = poller.getOperationState()
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
    return await this.CreateCsr(
      client,
      configurationId,
      secretName,
      scrubbedResource
    )
  }

  async Rotate(
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

    const poller = await client.getCertificateOperation(secretName)
    const status = poller.getOperationState()
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

    // CSR is started, and it's time to rotate (or we're forcing) so let's merge
  }

  protected CreatePolicy(
    resource: ManagedResource
  ): [CertificatePolicy | undefined, string | undefined] {
    if (!resource.certificate?.subject) {
      return [undefined, 'Certificate subject is required to request CSR']
    }

    if (!(resource.certificate.keyStrength in [2048, 3072, 4096])) {
      return [undefined, 'Certificate keyStrength must be 2048, 3072, or 4096']
    }

    const policy: CertificatePolicy = {
      issuerName: 'Unknown',
      subject: resource.certificate.subject,
      subjectAlternativeNames: resource.certificate?.dnsNames
        ? {
            dnsNames: resource.certificate.dnsNames as ArrayOneOrMore<string>
          }
        : undefined,
      certificateTransparency: true,
      contentType: 'application/x-pem-file', // we'll usually do a PEM import here
      enhancedKeyUsage: [
        '1.3.6.1.5.5.7.3.1' // serverAuth
      ],
      exportable: true,
      keyType: 'RSA',
      keySize: resource.certificate.keyStrength,
      keyUsage: ['keyEncipherment', 'dataEncipherment'],
      reuseKey: true,
      validityInMonths: 12
    }

    return [policy, undefined]
  }

  protected async CreateCsr(
    client: CertificateClient,
    configurationId: string,
    secretName: string,
    resource: ManagedResource
  ): Promise<RotationResult> {
    const [policy, policyError] = this.CreatePolicy(resource)
    if (policyError || !policy) {
      return new RotationResult(
        configurationId,
        false,
        policyError ?? 'Unknown error creating certificate policy',
        {
          csr: ''
        }
      )
    }

    await client.beginCreateCertificate(secretName, policy)
    const poller = await client.getCertificateOperation(secretName)
    const status = poller.getOperationState()
    const csr = status.certificateOperation?.csr

    if (!csr) {
      return new RotationResult(
        configurationId,
        false,
        'Unknown error getting CSR after beginCreateCertificate',
        {
          csr: '',
          status: JSON.stringify(status)
        }
      )
    }

    return new RotationResult(
      configurationId,
      true,
      'Certificate request in progress, check for CSR',
      {
        csr: ConvertCsrToText(status.certificateOperation?.csr)
      }
    )
  }

  protected async MergeCertificate(
    client: CertificateClient,
    configurationId: string,
    secretName: string,
    resource: ManagedResource
  ): Promise<RotationResult> {    
    // find the CA trust chain if needed:
    const trustChain = resource.certificate?.trustChainPath
      ? fs.readFileSync(resource.certificate?.trustChainPath, 'utf-8')
      : ''

    const certificate = resource.certificate?.issuedCertificatePath
      ? fs.readFileSync(resource.certificate?.issuedCertificatePath, 'utf-8')
      : ''

    const result = await client.mergeCertificate(secretName, )
  }
}
