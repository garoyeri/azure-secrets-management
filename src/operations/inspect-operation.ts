import * as core from '@actions/core'
import { OperationSettings } from '../operation-settings'
import { ConfigurationFile, FilterResources } from '../configuration-file'
import { InspectionResult } from '../rotators/shared'
import { Operation } from './abstract-operation'
import { Resolve } from '../rotators/rotators'
import { SummaryTableCell, SummaryTableRow } from '@actions/core/lib/summary'

export class InspectOperation extends Operation {
  constructor(settings: OperationSettings) {
    super('inspect', settings)
  }

  async Run(
    configuration: ConfigurationFile,
    targetResources: string[]
  ): Promise<void> {
    const targetResourceDetails = FilterResources(
      configuration,
      targetResources
    )

    const inspectionResults: InspectionResult[] = []

    for (const r of targetResourceDetails) {
      const rotator = Resolve(r.resource.type ?? '')
      if (!rotator) {
        // skip unsupported resource types
        core.warning(
          `Resource '${r.id}' of type '${
            r.resource.type ?? ''
          }' is not a supported resource type`
        )
        continue
      }

      try {
        const result = await rotator.Inspect(r.id, r.resource)
        inspectionResults.push(result)

        core.debug(`Inspected: ${r.id}: ${JSON.stringify(result.toJSON())}`)
      } catch (error) {
        if (error instanceof Error) {
          core.error(
            `Resource '${r.id}' encountered an error: '${error.message}'`
          )
        }
      }
    }

    const summaryHeader: SummaryTableRow = [
      'name',
      'type',
      'secretId',
      'resourceId',
      'expiresOn',
      'updatedOn',
      'notes'
    ].map(
      c =>
        ({
          header: true,
          data: c
        }) as SummaryTableCell
    )

    const summaryRows: SummaryTableRow[] = [
      summaryHeader,
      ...inspectionResults.map<SummaryTableRow>(
        c =>
          [
            c.name,
            c.type,
            c.secretId,
            c.resourceId,
            c.expiresOn?.toISOString(),
            c.updatedOn?.toISOString(),
            c.notes
          ] as SummaryTableRow
      )
    ]

    await core.summary
      .addHeading('Secrets Inspection')
      .addTable(summaryRows)
      .write()
  }
}
