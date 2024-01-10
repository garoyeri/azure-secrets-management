import { ManagedResource } from '../src/configuration-file'
import { ManualSecretRotator } from '../src/rotators/manual-secret'
import { GetSecretIfExists, UpdateSecret } from '../src/key-vault'
import { OperationSettings } from '../src/operation-settings'
import { DefaultAzureCredential } from '@azure/identity'

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

describe('manual-secret.ts', () => {
  it('does not rotate when secret is uninitialized', async () => {
    const settings = <OperationSettings>{
      credential: new DefaultAzureCredential(),
      force: false,
      operation: '',
      resourcesFilter: '*',
      secretValue1: 'abcdefgh',
      whatIf: false
    }
    const manual = new ManualSecretRotator(settings)
    const resource = <Partial<ManagedResource>>{
      name: 'myResource',
      type: 'manual/secret',
      expirationDays: 30,
      expirationOverlapDays: 15,
      keyVault: 'myVault'
    }

    // when trying to get the secret, return undefined indicating it wasn't found
    mockGetSecretIfExists.mockReturnValue(Promise.resolve(undefined))

    const rotationResult = await manual.Rotate(manual.ApplyDefaults(resource))

    expect(rotationResult.rotated).toBeFalsy()
    expect(rotationResult.name).toBe('myResource')
  })
})
