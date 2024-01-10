import { ManagedResource } from '../src/configuration-file'
import { ManualSecretRotator } from '../src/rotators/manual-secret'
import { GetSecretIfExists, UpdateSecret } from '../src/key-vault'
import { OperationSettings } from '../src/operation-settings'
import { DefaultAzureCredential } from '@azure/identity'
import { AddDays } from '../src/util'

import type { KeyVaultSecret } from '@azure/keyvault-secrets'

jest.mock('../src/key-vault')
const mockGetSecretIfExists = jest.mocked(GetSecretIfExists)
const mockUpdateSecret = jest.mocked(UpdateSecret)

jest.mock('@azure/identity')
const mockDefaultAzureCredential = jest.mocked(DefaultAzureCredential)

beforeEach(() => {
  mockGetSecretIfExists.mockClear()
  mockUpdateSecret.mockClear()
  mockDefaultAzureCredential.mockClear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('manual-secret.ts', () => {
  it('does not rotate when secret is uninitialized', async () => {
    const settings = {
      credential: new DefaultAzureCredential(),
      force: false,
      operation: '',
      resourcesFilter: '*',
      secretValue1: 'abcdefgh',
      whatIf: false
    } as OperationSettings
    const manual = new ManualSecretRotator(settings)
    const resource = {
      name: 'myResource',
      type: 'manual/secret',
      expirationDays: 30,
      expirationOverlapDays: 15,
      keyVault: 'myVault'
    } as Partial<ManagedResource>

    // when trying to get the secret, return undefined indicating it wasn't found
    mockGetSecretIfExists.mockReturnValue(Promise.resolve(undefined))

    const rotationResult = await manual.Rotate(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBeFalsy()
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(rotationResult.notes).toBe('Secret was not yet initialized')
  })

  it('does not rotate when not within the right number of days', async () => {
    const settings = {
      credential: new DefaultAzureCredential(),
      force: false,
      operation: '',
      resourcesFilter: '*',
      secretValue1: 'abcdefgh',
      whatIf: false
    } as OperationSettings
    const manual = new ManualSecretRotator(settings)
    const resource = {
      name: 'myResource',
      type: 'manual/secret',
      expirationDays: 30,
      expirationOverlapDays: 15,
      keyVault: 'myVault'
    } as Partial<ManagedResource>

    // Set the current time to a day where the secret is not yet ready to rotate
    mockGetSecretIfExists.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'text/plain',
          createdOn: new Date(2023, 1, 1),
          expiresOn: new Date(2023, 2, 1)
        },
        value: '123456'
      } as KeyVaultSecret)
    )
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2023, 1, 2).valueOf())

    const rotationResult = await manual.Rotate(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBeFalsy()
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(rotationResult.notes).toBe('Not time to rotate yet')
  })

  it('performs rotation when the appropriate', async () => {
    const settings = {
      credential: new DefaultAzureCredential(),
      force: false,
      operation: '',
      resourcesFilter: '*',
      secretValue1: 'abcdefgh',
      whatIf: false
    } as OperationSettings
    const manual = new ManualSecretRotator(settings)
    const resource = {
      name: 'myResource',
      type: 'manual/secret',
      expirationDays: 30,
      expirationOverlapDays: 15,
      keyVault: 'myVault'
    } as Partial<ManagedResource>

    // Set the current time to a day where the secret is not yet ready to rotate
    mockGetSecretIfExists.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'text/plain',
          createdOn: new Date(2023, 1, 1),
          expiresOn: new Date(2023, 2, 1)
        },
        value: '123456'
      } as KeyVaultSecret)
    )
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2023, 1, 17).valueOf())
    mockUpdateSecret.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'text/plain',
          createdOn: new Date(2023, 1, 17),
          expiresOn: AddDays(new Date(2023, 1, 17), 30)
        },
        value: 'abcdefgh'
      } as KeyVaultSecret)
    )

    const rotationResult = await manual.Rotate(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBeTruthy()
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(mockUpdateSecret).toHaveBeenCalledTimes(1)
    expect(mockUpdateSecret).toHaveBeenCalledWith(
      resource.keyVault,
      settings.credential,
      'myResourceConfig',
      'abcdefgh',
      AddDays(new Date(2023, 1, 17), 30),
      'text/plain'
    )
  })
})
