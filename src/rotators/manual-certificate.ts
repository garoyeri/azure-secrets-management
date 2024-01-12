import { ManagedResource } from '../configuration-file'
import { Rotator } from './abstract-rotator'
import { RotationResult } from './shared'
import { OperationSettings } from '../operation-settings'
import { ImportCertificate } from '../key-vault'

export class ManualCertificateRotator extends Rotator {
  constructor(settings: OperationSettings) {
    super('manual/certificate', 'certificate', settings)
  }

  async PerformRotation(
    configurationId: string,
    resource: ManagedResource,
    secretName: string
  ): Promise<RotationResult> {
    const pfxBuffer = resource.decodeBase64
      ? Buffer.from(this.settings.secretValue1, 'base64')
      : Buffer.from(this.settings.secretValue1)

    if (this.settings.whatIf) {
      return new RotationResult(configurationId, true, 'what-if')
    }

    const result = await ImportCertificate(
      resource.keyVault,
      this.settings.credential,
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
    secretName: string
  ): Promise<RotationResult> {
    return await this.PerformRotation(configurationId, resource, secretName)
  }
}
