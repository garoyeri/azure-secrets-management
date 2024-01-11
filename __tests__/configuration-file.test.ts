import {
  LoadConfigurationFromFile,
  ManagedResource
} from '../src/configuration-file'

describe('configuration-file.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads empty configuration file', () => {
    const configuration = LoadConfigurationFromFile(
      './__tests__/config-files/empty.json'
    )

    expect(configuration.defaults).toStrictEqual({})
    expect(configuration.resources.size).toBe(0)
  })

  it('loads sample configuration from documentation', () => {
    const configuration = LoadConfigurationFromFile(
      './__tests__/config-files/test.json'
    )

    expect(configuration.defaults).toStrictEqual({
      resourceGroup: 'resourceGroup1',
      keyVaultResourceGroup: 'resourceGroup1',
      keyVault: 'vault1',
      keyVaultSecretPrefix: '',
      expirationDays: 90,
      expirationOverlapDays: 30
    })
    expect(configuration.resources.get('storage1')).toStrictEqual({
      resourceGroup: 'resourceGroup1',
      keyVaultResourceGroup: 'resourceGroup1',
      keyVault: 'vault1',
      keyVaultSecretPrefix: '',
      expirationDays: 90,
      expirationOverlapDays: 30,
      name: 'storageaccountname',
      type: 'azure/storage-account'
    } as Partial<ManagedResource>)
  })
})