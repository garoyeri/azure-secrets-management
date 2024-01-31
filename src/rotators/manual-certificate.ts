import { ManagedResource } from '../configuration-file'
import { AbstractRotator } from './abstract-rotator'
import { InspectionResult, RotationResult } from './shared'
import { OperationSettings } from '../operation-settings'
import { KeyVaultClient } from '../key-vault'

export class ManualCertificateRotator extends AbstractRotator {
  constructor(settings: OperationSettings) {
    super('manual/certificate', 'certificate', settings)
  }

  async PerformRotation(
    configurationId: string,
    resource: ManagedResource,
    secretName: string,
    client: KeyVaultClient
  ): Promise<RotationResult> {
    const pfxBuffer = resource.decodeBase64
      ? Buffer.from(this.settings.secretValue1, 'base64')
      : Buffer.from(this.settings.secretValue1)

    if (this.settings.whatIf) {
      return new RotationResult(configurationId, true, 'what-if')
    }

    const result = await client.ImportCertificate(
      secretName,
      pfxBuffer.valueOf(),
      this.settings.secretValue2
    )

    return new RotationResult(configurationId, true, '', {
      id: result.properties.id,
      expiration: result.properties.expiresOn
    })
  }

  protected async PerformInitialization(
    configurationId: string,
    resource: ManagedResource,
    secretName: string,
    client: KeyVaultClient
  ): Promise<RotationResult> {
    return await this.PerformRotation(
      configurationId,
      resource,
      secretName,
      client
    )
  }

  protected async PerformInspection(
    configurationId: string,
    resource: ManagedResource,
    secretName: string,
    client: KeyVaultClient
  ): Promise<InspectionResult> {
    const result = await client.GetCertificateIfExists(secretName)
    if (!result) {
      return new InspectionResult(
        configurationId,
        this.type,
        '',
        'Certificate not found'
      )
    }

    const status = await client.CheckCertificateRequest(secretName)
    let notes = ''
    if (status.isStarted) {
      notes = 'Certificate request started'
    } else if (status.isCompleted && result.properties.enabled) {
      notes = 'Certificate valid'
    } else if (status.isCompleted && !result.properties.enabled) {
      notes = 'Certificate expired or disabled'
    } else if (status.isCancelled) {
      notes = 'Certificate cancelled'
    }

    return new InspectionResult(
      configurationId,
      this.type,
      result.id ?? '',
      notes,
      '',
      result.properties.updatedOn,
      result.properties.expiresOn
    )
  }
}
