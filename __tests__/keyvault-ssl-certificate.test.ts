import { ManagedResource } from '../src/configuration-file'
import { GetCertificateIfExists, ImportCertificate } from '../src/key-vault'
import { OperationSettings } from '../src/operation-settings'
import { DefaultAzureCredential } from '@azure/identity'
import { AddDays } from '../src/util'
import type { KeyVaultCertificateWithPolicy } from '@azure/keyvault-certificates'

jest.mock('../src/key-vault')
const mockGetIfExists = jest.mocked(GetCertificateIfExists)
const mockUpdate = jest.mocked(ImportCertificate)

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

describe('keyvault-ssl-certificate.ts', () => {
  
})