import { ManagedResource } from 'src/configuration-file'
import { Rotator } from './abstract-rotator'
import { RotationResult } from './shared'
import { OperationSettings } from 'src/operation-settings'
import { ImportCertificate } from 'src/key-vault'

export class ManualCertificateRotator extends Rotator {
  constructor(settings: OperationSettings) {
    super('manual/certificate', 'certificate', settings)
  }

  async PerformRotation(
    resource: ManagedResource,
    secretName: string
  ): Promise<RotationResult> {
    const pfxBuffer = resource.decodeBase64
      ? Buffer.from(this.settings.secretValue1, 'base64')
      : Buffer.from(this.settings.secretValue1)

    const result = await ImportCertificate(
      resource.keyVault,
      this.settings.credential,
      secretName,
      pfxBuffer.valueOf(),
      this.settings.secretValue2
    )

    return new RotationResult(resource.name, true, '', {
      id: result.properties.id,
      expiration: result.properties.expiresOn
    })
  }
}
