import { OperationSettings } from '../operation-settings'
import { Operation } from './abstract-operation'
import { InitializeOperation } from './initialize-operation'
import { InspectOperation } from './inspect-operation'
import { ManualSecretOperation } from './manual-secret-operation'
import { NothingOperation } from './nothing-operation'
import { RequestCsrOperation } from './request-csr-operation'
import { RotateOperation } from './rotate-operation'

const operations = new Map<string, Operation>()

export function Setup(settings: OperationSettings): void {
  const opsList = [
    new NothingOperation(settings),
    new InitializeOperation(settings),
    new RotateOperation(settings),
    new RequestCsrOperation(settings),
    new InspectOperation(settings),
    new ManualSecretOperation(settings)
  ]

  for (const o of opsList) {
    operations.set(o.operation, o)
  }
}

export function Resolve(type: string): Operation | undefined {
  return operations.get(type)
}
