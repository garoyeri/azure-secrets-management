import * as fs from 'fs'
import * as core from '@actions/core'
import { OperationSettings } from '../operation-settings'
import { IdentifiedManagedResource } from '../configuration-file'
import { ResourceOperation } from './abstract-resource-operation'
import { Rotator } from '../rotators/abstract-rotator'
import { RotationResult } from '../rotators/shared'
import { DefaultArtifactClient } from '@actions/artifact'

type ContextWithCsr = {
  csr: string | undefined
}

export class RequestCsrOperation extends ResourceOperation {
  constructor(settings: OperationSettings) {
    super('request-csr', settings)
  }

  protected async PerformSingleRun(
    rotator: Rotator,
    r: IdentifiedManagedResource
  ): Promise<RotationResult> {
    const result = await rotator.Initialize(r.id, r.resource)

    await this.UploadCsrArtifact(result)

    if (result.rotated) {
      core.setOutput('rotated-resources', r.id)
    } else {
      core.setOutput('rotated-resources', '')
    }

    return result
  }

  protected async UploadCsrArtifact(
    rotationResult: RotationResult
  ): Promise<void> {
    if (!rotationResult.rotated) {
      return
    }

    const csr = (rotationResult.context as ContextWithCsr)?.csr
    if (!csr) {
      return
    }

    // save CSR to file
    fs.writeFileSync('csr.txt', csr)

    const artifact = new DefaultArtifactClient()
    await artifact.uploadArtifact('csr', ['csr.txt'], '.')
  }
}
