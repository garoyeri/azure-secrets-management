import { ManagedResource } from '../src/configuration-file'
import { ManualCertificateRotator } from '../src/rotators/manual-certificate'
import { KeyVaultClient } from '../src/key-vault'
import { OperationSettings } from '../src/operation-settings'
import { DefaultAzureCredential } from '@azure/identity'
import { AddDays } from '../src/util'
import type { KeyVaultCertificateWithPolicy } from '@azure/keyvault-certificates'

jest.mock('../src/key-vault')
const mockGetIfExists = jest.spyOn(
  KeyVaultClient.prototype,
  'GetCertificateIfExists'
)
const mockUpdate = jest.spyOn(KeyVaultClient.prototype, 'ImportCertificate')

jest.mock('@azure/identity')
const mockDefaultAzureCredential = jest.mocked(DefaultAzureCredential)

beforeEach(() => {
  mockGetIfExists.mockClear()
  mockUpdate.mockClear()
  mockDefaultAzureCredential.mockClear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

function setup(): {
  settings: OperationSettings
  manual: ManualCertificateRotator
  resource: Partial<ManagedResource>
} {
  const settings = {
    credential: new DefaultAzureCredential(),
    force: false,
    operation: '',
    resourcesFilter: '*',
    secretValue1: Buffer.from('abcdefgh').toString('base64'),
    whatIf: false
  } as OperationSettings

  return {
    settings,
    manual: new ManualCertificateRotator(settings),
    resource: {
      name: 'myResource',
      type: 'manual/certificate',
      expirationOverlapDays: 30,
      keyVault: 'myVault'
    } as Partial<ManagedResource>
  }
}

describe('manual-certificate.ts', () => {
  it('does not initialize secret if already initialized', async () => {
    const { manual, resource } = setup()

    // when trying to get the secret, return something indicating it was already initialized
    mockGetIfExists.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'application/x-pkcs12',
          createdOn: new Date(2023, 1, 1),
          expiresOn: new Date(2024, 1, 1)
        },
        value: '123456'
      } as KeyVaultCertificateWithPolicy)
    )

    const rotationResult = await manual.Initialize(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBe(false)
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(rotationResult.notes).toBe('Secret already initialized')
  })

  it('initializes secret if not already initialized', async () => {
    const { manual, resource } = setup()

    // when trying to get the secret, return undefined indicating it is not initialized
    mockGetIfExists.mockReturnValue(Promise.resolve(undefined))

    jest.spyOn(Date, 'now').mockReturnValue(new Date(2023, 3, 1).valueOf())
    mockUpdate.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'application/x-pkcs12',
          createdOn: new Date(2023, 3, 1),
          expiresOn: AddDays(new Date(2023, 3, 1), 365)
        },
        value: 'abcdefgh'
      } as KeyVaultCertificateWithPolicy)
    )

    const rotationResult = await manual.Initialize(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBeTruthy()
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      'myResourceConfig',
      Buffer.from('abcdefgh').valueOf(),
      undefined
    )
  })

  it('initializes secret if forced', async () => {
    const { settings, manual, resource } = setup()
    settings.force = true

    // when trying to get the secret, return something indicating it was already initialized
    mockGetIfExists.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'application/x-pkcs12',
          createdOn: new Date(2023, 1, 1),
          expiresOn: AddDays(new Date(2023, 1, 1), 365)
        },
        value: '123456'
      } as KeyVaultCertificateWithPolicy)
    )

    jest.spyOn(Date, 'now').mockReturnValue(new Date(2023, 3, 1).valueOf())
    mockUpdate.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'application/x-pkcs12',
          createdOn: new Date(2023, 3, 1),
          expiresOn: AddDays(new Date(2023, 3, 1), 365)
        },
        value: 'abcdefgh'
      } as KeyVaultCertificateWithPolicy)
    )

    const rotationResult = await manual.Initialize(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBeTruthy()
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      'myResourceConfig',
      Buffer.from('abcdefgh').valueOf(),
      undefined
    )
  })

  it('does not rotate when secret is uninitialized', async () => {
    const { manual, resource } = setup()

    // when trying to get the secret, return undefined indicating it wasn't found
    mockGetIfExists.mockReturnValue(Promise.resolve(undefined))

    const rotationResult = await manual.Rotate(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBeFalsy()
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(rotationResult.notes).toBe('Secret was not yet initialized')
  })

  it('does not rotate when not within the right number of days', async () => {
    const { manual, resource } = setup()

    // Set the current time to a day where the secret is not yet ready to rotate
    mockGetIfExists.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'application/x-pkcs12',
          createdOn: new Date(2023, 1, 1),
          expiresOn: AddDays(new Date(2023, 1, 1), 365)
        },
        value: '123456'
      } as KeyVaultCertificateWithPolicy)
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
    const { manual, resource } = setup()

    // Set the current time to a day where the secret is not yet ready to rotate
    mockGetIfExists.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'application/x-pkcs12',
          createdOn: new Date(2023, 1, 1),
          expiresOn: AddDays(new Date(2023, 1, 1), 365)
        },
        value: '123456'
      } as KeyVaultCertificateWithPolicy)
    )
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2024, 0, 15).valueOf())
    mockUpdate.mockReturnValue(
      Promise.resolve({
        name: 'myResourceConfig',
        properties: {
          contentType: 'application/x-pkcs12',
          createdOn: new Date(2024, 1, 1),
          expiresOn: AddDays(new Date(2024, 1, 1), 365)
        },
        value: 'abcdefgh'
      } as KeyVaultCertificateWithPolicy)
    )

    const rotationResult = await manual.Rotate(
      'myResourceConfig',
      manual.ApplyDefaults(resource)
    )

    expect(rotationResult.rotated).toBeTruthy()
    expect(rotationResult.name).toBe('myResourceConfig')
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      'myResourceConfig',
      Buffer.from('abcdefgh').valueOf(),
      undefined
    )
  })
})
