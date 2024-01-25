import * as fs from 'fs'
import { ManagedResource } from '../src/configuration-file'
import { GetCertificateIfExists, ImportCertificate } from '../src/key-vault'
import { OperationSettings } from '../src/operation-settings'
import { DefaultAzureCredential } from '@azure/identity'
import { KeyVaultSslCertificateRotator } from '../src/rotators/keyvault-ssl-certificate'
import { ParsePemToCertificates } from '../src/crypto-util'
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

function setup(): {
  settings: OperationSettings
  manual: KeyVaultSslCertificateRotator
  resource: Partial<ManagedResource>
} {
  const settings = {
    credential: new DefaultAzureCredential(),
    force: false,
    operation: '',
    resourcesFilter: '*',
    whatIf: false
  } as OperationSettings

  return {
    settings,
    manual: new KeyVaultSslCertificateRotator(settings),
    resource: {
      name: 'myResource',
      type: 'azure/keyvault/ssl-certificate',
      expirationDays: 365,
      expirationOverlapDays: 60,
      keyVault: 'myVault'
    } as Partial<ManagedResource>
  }
}

describe('keyvault-ssl-certificate.ts', () => {
  it('can parse a single certificate', () => {
    const content = fs.readFileSync(
      '__tests__/certs/public-domain-cert.pem.txt',
      'utf-8'
    )
    const certs = ParsePemToCertificates(content)

    expect(certs.length).toBe(1)
    expect(certs[0].issuer).toContain('CN=garoyeri.dev')
    expect(certs[0].serialNumber).toBe(
      '0265AD28B1DFED4FE4822BC0B6A2C4C767E12ECE'
    )
  })

  it('can parse a certificate chain', () => {
    const content = fs.readFileSync(
      '__tests__/certs/public-domain-cert-chain.pem.txt',
      'utf-8'
    )
    const certs = ParsePemToCertificates(content)

    expect(certs.length).toBe(2)

    expect(certs[0].ca).toBeTruthy()
    expect(certs[0].subject).toContain('CN=garoyeri.dev')

    expect(certs[1].issuer).toContain('CN=garoyeri.dev')
    expect(certs[1].serialNumber).toBe(
      '0265AD28B1DFED4FE4822BC0B6A2C4C767E12ECE'
    )

  })
})
