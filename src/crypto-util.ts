import type {
  ArrayOneOrMore,
  CertificatePolicy
} from '@azure/keyvault-certificates'
import * as crypto from 'crypto'

export type KeyStrength = 2048 | 3072 | 4096

/**
 * Parse the PEM content from a file into a set of x509 certificates.
 * @param content - content from x509 certificate file
 * @returns - the decoded x509 certificates, or an empty array if none were parseable
 */
export function ParsePemToCertificates(
  content: string
): crypto.X509Certificate[] {
  if (!content) return []

  // split up certs in PEM encoded file, ensure that newlines are all UNIX-y
  const certs = content
    .split(/-----END CERTIFICATE-----/)
    .filter(c => c.trim()) // remove any strings that are just whitespace
    .map(c => c.replace('\r\n', '\n').concat('-----END CERTIFICATE-----\n'))

  return certs.map(c => new crypto.X509Certificate(c))
}

/**
 * Create a policy for a certificate signing request (CSR) based on the
 * certificate parameters.
 *
 * @param subject - Subject for the certificate, TODO: provide a format.
 * @param keyStrength - Strength of the cryptographic key for securing the certificate.
 * @param dnsNames  - List of DNS names to use for the certificate, likely needs at least one.
 * @returns - The certificate policy details, including the CSR if it was generated correctly.
 */
export function CreatePolicy(
  subject: string,
  keyStrength: KeyStrength,
  dnsNames: string[]
): CertificatePolicy {
  const policy: CertificatePolicy = {
    issuerName: 'Unknown',
    subject,
    subjectAlternativeNames: dnsNames
      ? {
          dnsNames: dnsNames as ArrayOneOrMore<string>
        }
      : undefined,
    contentType: 'application/x-pem-file', // we'll usually do a PEM import here
    enhancedKeyUsage: [
      '1.3.6.1.5.5.7.3.1' // serverAuth
    ],
    exportable: true,
    keyType: 'RSA',
    keySize: keyStrength,
    keyUsage: ['keyEncipherment', 'dataEncipherment'],
    reuseKey: true,
    validityInMonths: 12
  }

  return policy
}
