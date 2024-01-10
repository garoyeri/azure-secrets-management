import { ManagedResource } from '../configuration-file'
import { OperationSettings } from '../operation-settings'
import { UpdateSecret } from '../key-vault'
import { RotationResult } from './shared'
import { Rotator } from './abstract-rotator'

export class ManualSecretRotator extends Rotator {
  constructor(settings: OperationSettings) {
    super('manual/generic', 'secret', settings)
  }

  async PerformRotation(
    resource: ManagedResource,
    secretName: string
  ): Promise<RotationResult> {
    const newExpiration = resource.expirationDays
      ? new Date(Date.now() + resource.expirationDays * 24 * 60 * 60 * 1000)
      : undefined
    
    const value = resource.decodeBase64 ? Buffer.from(this.settings.secretValue1, 'base64')
      : Buffer.from(this.settings.secretValue1)

    const result = await UpdateSecret(
      resource.keyVault,
      this.settings.credential,
      secretName,
      value.toString(),
      newExpiration,
      resource.contentType
    )

    return new RotationResult(resource.name, true, '', {
      id: result.properties.id,
      expiration: result.properties.expiresOn
    })
  }
}
