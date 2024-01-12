import { OperationSettings } from '../operation-settings'
import { Rotator } from './abstract-rotator'
import { ManualSecretRotator } from './manual-secret'

const rotators = new Map<string, Rotator>()

export function Setup(settings: OperationSettings): void {
  const manual = new ManualSecretRotator(settings)
  rotators.set(manual.type, manual)
}

export function Resolve(type: string): Rotator | undefined {
  return rotators.get(type)
}
