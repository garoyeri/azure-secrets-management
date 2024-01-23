import * as crypto from 'crypto'

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
    .filter(Boolean) // remove blanks
    .map(c =>
      c.replace(/-----BEGIN CERTIFICATE-----/, '').replace('\r\n', '\n')
    )

  return certs.map(c => new crypto.X509Certificate(c))
}
