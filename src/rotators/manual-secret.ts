import { ManagedResource } from '../configuration-file'
import { OperationSettings } from '../operation-settings'
import { KeyVaultClient } from '../key-vault'
import { InspectionResult, RotationResult } from './shared'
import { AbstractRotator } from './abstract-rotator'
import { AddDays } from '../util'

export class ManualSecretRotator extends AbstractRotator {
  constructor(settings: OperationSettings) {
    super('manual/generic', 'secret', settings)
  }

  async PerformRotation(
    configurationId: string,
    resource: ManagedResource,
    secretName: string,
    client: KeyVaultClient
  ): Promise<RotationResult> {
    const newExpiration = AddDays(new Date(Date.now()), resource.expirationDays)

    const value = resource.decodeBase64
      ? Buffer.from(this.settings.secretValue1, 'base64')
      : Buffer.from(this.settings.secretValue1)

    if (this.settings.whatIf) {
      return new RotationResult(configurationId, true, 'what-if', {
        expiration: newExpiration
      })
    }

    const result = await client.UpdateSecret(
      secretName,
      value.toString(),
      newExpiration,
      resource.contentType
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
    const result = await client.GetSecretIfExists(secretName)
    if (!result) {
      return new InspectionResult(
        configurationId,
        this.type,
        '',
        'Secret not found'
      )
    }

    const length = result.value?.length ?? 0
    const contentType = result.properties.contentType ?? 'unspecified'

    return new InspectionResult(
      configurationId,
      this.type,
      result.properties.id,
      result.properties.enabled
        ? `Secret OK, length: ${length}, contentType: ${contentType}`
        : 'Secret disabled',
      '',
      result.properties.updatedOn,
      result.properties.expiresOn
    )
  }
}
