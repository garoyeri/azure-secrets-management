import { OperationSettings } from '../operation-settings'
import { AbstractRotator } from './abstract-rotator'
import { ManualSecretRotator } from './manual-secret'

const rotators = new Map<string, AbstractRotator>()

export function Setup(settings: OperationSettings): void {
  const manual = new ManualSecretRotator(settings)
  rotators.set(manual.type, manual)
}

export function Resolve(type: string): AbstractRotator | undefined {
  return rotators.get(type)
}
