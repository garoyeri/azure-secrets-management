import { OperationSettings } from '../operation-settings'
import { ManagedResource } from '../configuration-file'
import { InspectionResult, RotationResult, ShouldRotate } from './shared'
import { KeyVaultClient } from '../key-vault'

type SecretType = 'secret' | 'certificate'

export interface Rotator {
  readonly type: string

  ApplyDefaults(resource: Partial<ManagedResource>): ManagedResource

  Initialize(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<RotationResult>

  Rotate(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<RotationResult>

  Inspect(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<InspectionResult>
}

export abstract class AbstractRotator implements Rotator {
  readonly type: string
  readonly secretType: SecretType
  readonly settings: OperationSettings

  constructor(
    type: string,
    secretType: SecretType,
    settings: OperationSettings
  ) {
    this.type = type
    this.secretType = secretType
    this.settings = settings
  }

  ApplyDefaults(resource: Partial<ManagedResource>): ManagedResource {
    return {
      name: resource.name ?? '',
      contentType:
        resource.contentType ??
        (this.secretType === 'certificate'
          ? 'application/x-pkcs12'
          : 'text/plain'),
      // by default, certificates are base64 encoded and should be decoded. Secrets may not be.
      decodeBase64: resource.decodeBase64 ?? this.secretType === 'certificate',
      expirationDays: resource.expirationDays,
      expirationOverlapDays: resource.expirationOverlapDays ?? 0,
      keyVault: resource.keyVault ?? '',
      keyVaultSecretPrefix: resource.keyVaultSecretPrefix ?? '',
      resourceGroup: resource.resourceGroup ?? '',
      type: resource.type ?? ''
    } as ManagedResource
  }

  async Initialize(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<RotationResult> {
    const scrubbedResource = this.ApplyDefaults(resource)

    const secretName = scrubbedResource.keyVaultSecretPrefix + configurationId
    const client = new KeyVaultClient(this.settings, scrubbedResource.keyVault)

    if (this.secretType === 'secret') {
      const secretFound = await client.GetSecretIfExists(secretName)

      if (secretFound && !this.settings.force) {
        return new RotationResult(
          configurationId,
          false,
          'Secret already initialized',
          { secretName }
        )
      }
    } else if (this.secretType === 'certificate') {
      const certificateFound = await client.GetCertificateIfExists(secretName)

      if (certificateFound && !this.settings.force) {
        return new RotationResult(
          configurationId,
          false,
          'Secret already initialized',
          { secretName }
        )
      }
    }

    // all good, perform initialization
    try {
      const result = await this.PerformInitialization(
        configurationId,
        scrubbedResource,
        secretName,
        client
      )
      return result
    } catch (error) {
      if (error instanceof Error) {
        return new RotationResult(configurationId, false, error.message, {
          error: JSON.stringify(error)
        })
      } else {
        return new RotationResult(configurationId, false, '', {
          error: JSON.stringify(error)
        })
      }
    }
  }

  async Rotate(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<RotationResult> {
    const scrubbedResource = this.ApplyDefaults(resource)

    const secretName = scrubbedResource.keyVaultSecretPrefix + configurationId
    const client = new KeyVaultClient(this.settings, scrubbedResource.keyVault)

    if (this.secretType === 'secret') {
      const secretFound = await client.GetSecretIfExists(secretName)

      if (!secretFound) {
        // don't rotate, secret wasn't initialized yet
        return new RotationResult(
          configurationId,
          false,
          'Secret was not yet initialized',
          { secretName }
        )
      }

      if (
        !this.settings.force &&
        !ShouldRotate(
          secretFound.properties.expiresOn,
          scrubbedResource.expirationOverlapDays
        )
      ) {
        // not time to rotate yet, and not forced
        return new RotationResult(
          configurationId,
          false,
          'Not time to rotate yet',
          {
            expiration: secretFound.properties.expiresOn,
            expirationOverlapDays: scrubbedResource.expirationOverlapDays
          }
        )
      }
    } else if (this.secretType === 'certificate') {
      const certificateFound = await client.GetCertificateIfExists(secretName)

      if (!certificateFound) {
        // don't rotate, secret wasn't initialized yet
        return new RotationResult(
          configurationId,
          false,
          'Secret was not yet initialized',
          { secretName }
        )
      }

      if (
        !this.settings.force &&
        !ShouldRotate(
          certificateFound.properties.expiresOn,
          scrubbedResource.expirationOverlapDays
        )
      ) {
        // not time to rotate yet, and not forced
        return new RotationResult(
          configurationId,
          false,
          'Not time to rotate yet',
          {
            expiration: certificateFound.properties.expiresOn,
            expirationOverlapDays: scrubbedResource.expirationOverlapDays
          }
        )
      }
    }

    // all good, lets rotate!
    try {
      const result = await this.PerformRotation(
        configurationId,
        scrubbedResource,
        secretName,
        client
      )
      return result
    } catch (error) {
      if (error instanceof Error) {
        return new RotationResult(configurationId, false, error.message, {
          error: JSON.stringify(error)
        })
      } else {
        return new RotationResult(configurationId, false, '', {
          error: JSON.stringify(error)
        })
      }
    }
  }

  async Inspect(
    configurationId: string,
    resource: Partial<ManagedResource>
  ): Promise<InspectionResult> {
    const scrubbedResource = this.ApplyDefaults(resource)

    const secretName = scrubbedResource.keyVaultSecretPrefix + configurationId
    const client = new KeyVaultClient(this.settings, scrubbedResource.keyVault)

    const result = await this.PerformInspection(
      configurationId,
      scrubbedResource,
      secretName,
      client
    )

    return result
  }

  protected abstract PerformInitialization(
    configurationId: string,
    resource: ManagedResource,
    secretName: string,
    client: KeyVaultClient
  ): Promise<RotationResult>

  protected abstract PerformRotation(
    configurationId: string,
    resource: ManagedResource,
    secretName: string,
    client: KeyVaultClient
  ): Promise<RotationResult>

  protected abstract PerformInspection(
    configurationId: string,
    resource: ManagedResource,
    secretName: string,
    client: KeyVaultClient
  ): Promise<InspectionResult>
}
