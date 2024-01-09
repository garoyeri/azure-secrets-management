import * as core from '@actions/core'
import { ManagedResource } from 'src/configuration-file'
import { OperationSettings } from 'src/operation-settings'
import { GetSecretIfExists, UpdateSecret } from 'src/key-vault'
import { RotationResult, ShouldRotate } from './shared'
import { ActionError } from 'src/util'

export const SupportedType = 'manual/generic'

function ApplyDefaults(resource: Partial<ManagedResource>): ManagedResource {
  return <ManagedResource>{
    name: resource.name ?? '',
    contentType: resource.contentType ?? 'text/plain',
    decodeBase64: resource.decodeBase64 ?? false,
    expirationDays: resource.expirationDays,
    expirationOverlapDays: resource.expirationOverlapDays ?? 0,
    keyVault: resource.keyVault ?? '',
    keyVaultSecretPrefix: resource.keyVaultSecretPrefix ?? '',
    resourceGroup: resource.resourceGroup ?? '',
    type: resource.type ?? ''
  }
}

export async function RotateManualSecret(
  resource: Partial<ManagedResource>,
  settings: OperationSettings
): Promise<RotationResult> {
  const scrubbedResource = ApplyDefaults(resource)

  const secretName =
    scrubbedResource.keyVaultSecretPrefix + scrubbedResource.name
  const secretFound = await GetSecretIfExists(
    scrubbedResource.keyVault,
    settings.credential,
    secretName
  )

  if (!secretFound) {
    // don't rotate, secret wasn't initialized yet
    return new RotationResult(
      scrubbedResource.name,
      false,
      'Secret was not yet initialized',
      { secretName }
    )
  }

  if (
    !settings.force &&
    !ShouldRotate(
      secretFound.properties.expiresOn,
      scrubbedResource.expirationOverlapDays
    )
  ) {
    // don't rotate
    return new RotationResult(
      scrubbedResource.name,
      false,
      'Not time to rotate yet',
      {
        expiration: secretFound.properties.expiresOn,
        expirationOverlapDays: scrubbedResource.expirationOverlapDays
      }
    )
  }

  try {
    const newExpiration = scrubbedResource.expirationDays
      ? new Date(
          Date.now() + scrubbedResource.expirationDays * 24 * 60 * 60 * 1000
        )
      : undefined
    const result = await UpdateSecret(
      scrubbedResource.keyVault,
      settings.credential,
      secretName,
      settings.secretValue1,
      newExpiration,
      scrubbedResource.contentType
    )

    return new RotationResult(scrubbedResource.name, true)
  } catch (error) {
    if (error instanceof Error) {
      throw new ActionError(error.message, {
        cause: error,
        context: { resource: scrubbedResource.name }
      })
    } else {
      throw new ActionError(JSON.stringify(error), {
        context: { resource: scrubbedResource.name }
      })
    }
  }
}
