import { OperationSettings } from '../operation-settings'
import { Rotator } from './abstract-rotator'
import { KeyVaultSslCertificateRotator } from './keyvault-ssl-certificate'
import { ManualCertificateRotator } from './manual-certificate'
import { ManualSecretRotator } from './manual-secret'

const rotators = new Map<string, Rotator>()

export function Setup(settings: OperationSettings): void {
  const rotatorList: Rotator[] = [
    new ManualSecretRotator(settings),
    new ManualCertificateRotator(settings),
    new KeyVaultSslCertificateRotator(settings)
  ]

  for (const r of rotatorList) {
    rotators.set(r.type, r)
  }
}

export function Resolve(type: string): Rotator | undefined {
  return rotators.get(type)
}
