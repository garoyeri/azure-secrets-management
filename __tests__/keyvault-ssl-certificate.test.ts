import * as fs from 'fs'
import { ManagedResource } from '../src/configuration-file'
import { KeyVaultClient } from '../src/key-vault'
import { OperationSettings } from '../src/operation-settings'
import { DefaultAzureCredential } from '@azure/identity'
import { KeyVaultSslCertificateRotator } from '../src/rotators/keyvault-ssl-certificate'
import { ParsePemToCertificates } from '../src/crypto-util'
import type {
  CertificateOperationState,
  KeyVaultCertificateWithPolicy
} from '@azure/keyvault-certificates'
import { ConvertCsrToText } from '../src/util'

jest.mock('@azure/identity')
const mockDefaultAzureCredential = jest.mocked(DefaultAzureCredential)

const configurationId = 'MyCertificateConfiguration'

beforeEach(() => {
  mockDefaultAzureCredential.mockClear()
})

afterEach(() => {
  jest.resetAllMocks()
  jest.restoreAllMocks()
})

function setup(): {
  settings: OperationSettings
  rotator: KeyVaultSslCertificateRotator
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
    rotator: new KeyVaultSslCertificateRotator(settings),
    resource: {
      name: '',
      type: 'azure/keyvault/ssl-certificate',
      expirationDays: 365,
      expirationOverlapDays: 60,
      keyVault: 'myVault',
      certificate: {
        subject: 'CN=garoyeri.dev',
        dnsNames: ['garoyeri.dev'],
        keyStrength: 2048,
        issuedCertificatePath: '__tests__/certs/public-domain-cert.pem.txt',
        trustChainPath: '__tests__/certs/public-root-ca.pem.txt'
      }
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

  it('can request a CSR when conditions are correct', async () => {
    // today is January 2, 2023, certificate expires February 2, 2023
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2023, 0, 2).valueOf())
    const getCertificateMock = jest
      .spyOn(KeyVaultClient.prototype, 'GetCertificateIfExists')
      .mockImplementation(async name => {
        return Promise.resolve<KeyVaultCertificateWithPolicy>({
          name: configurationId,
          secretId: name,
          properties: {
            expiresOn: new Date(2023, 1, 2)
          }
        })
      })

    const checkCertificateMock = jest
      .spyOn(KeyVaultClient.prototype, 'CheckCertificateRequest')
      .mockImplementation(async name => {
        return Promise.resolve<CertificateOperationState>({
          certificateName: name,
          isStarted: false,
          isCancelled: false,
          isCompleted: true
        })
      })

    const createCsrMock = jest
      .spyOn(KeyVaultClient.prototype, 'CreateCsr')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementation(async (name, _subject, _keyStrength) => {
        return Promise.resolve<CertificateOperationState>({
          certificateName: name,
          isCompleted: false,
          isStarted: true,
          isCancelled: false,
          certificateOperation: {
            csr: new Uint8Array([1, 2, 3, 4])
          }
        })
      })

    const { rotator, resource } = setup()

    const result = await rotator.Initialize(configurationId, resource)

    expect(getCertificateMock).toHaveBeenCalledTimes(1)
    expect(checkCertificateMock).toHaveBeenCalledTimes(1)
    expect(createCsrMock).toHaveBeenCalledTimes(1)
    expect(result.rotated).toBeTruthy()
    expect(result.context).toStrictEqual({
      csr: ConvertCsrToText(new Uint8Array([1, 2, 3, 4]))
    })
  })

  it('can get a pending CSR details', async () => {
    // today is January 2, 2023, certificate expires February 2, 2023
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2023, 0, 2).valueOf())
    const getCertificateMock = jest
      .spyOn(KeyVaultClient.prototype, 'GetCertificateIfExists')
      .mockImplementation(async name => {
        return Promise.resolve<KeyVaultCertificateWithPolicy>({
          name: configurationId,
          secretId: name,
          properties: {
            expiresOn: new Date(2023, 1, 2)
          }
        })
      })

    const checkCertificateMock = jest
      .spyOn(KeyVaultClient.prototype, 'CheckCertificateRequest')
      .mockImplementation(async name => {
        return Promise.resolve<CertificateOperationState>({
          certificateName: name,
          isStarted: true,
          isCancelled: false,
          isCompleted: false,
          certificateOperation: {
            csr: new Uint8Array([1, 2, 3, 4])
          }
        })
      })

    const createCsrMock = jest
      .spyOn(KeyVaultClient.prototype, 'CreateCsr')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementation(async (name, _subject, _keyStrength) => {
        return Promise.resolve<CertificateOperationState>({
          certificateName: name,
          isCompleted: false,
          isStarted: true,
          isCancelled: false,
          certificateOperation: {
            csr: new Uint8Array([1, 2, 3, 4])
          }
        })
      })

    const { rotator, resource } = setup()

    const result = await rotator.Initialize(configurationId, resource)

    expect(getCertificateMock).toHaveBeenCalledTimes(1)
    expect(checkCertificateMock).toHaveBeenCalledTimes(1)
    expect(createCsrMock).toHaveBeenCalledTimes(0)
    expect(result.rotated).toBeTruthy()
    expect(result.context).toStrictEqual({
      csr: ConvertCsrToText(new Uint8Array([1, 2, 3, 4]))
    })
  })
})
