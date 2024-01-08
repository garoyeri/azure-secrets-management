import fs from 'fs';

export type ManagedResource = {
    type: string;
    name: string;
    resourceGroup: string;
    keyVault: string;
    keyVaultResourceGroup: string;
    keyVaultSecretPrefix: string;
    expirationDays: number;
    expirationOverlapDays: number;
    contentType: string;
    decodeBase64: boolean;
};

export type ConfigurationFile = {
    defaults: Partial<ManagedResource>;
    resources: Partial<ManagedResource>[];
};

export function LoadConfigurationFromFile(path: string) : ConfigurationFile {
    const file = fs.readFileSync(path, 'utf-8');
    const configSource = JSON.parse(file.toString()) as ConfigurationFile;
    const configMapped = {
        defaults: configSource.defaults,
        resources: configSource.resources.map(src => ({ ...configSource.defaults, ...src }))
    }

    return configMapped;
}
