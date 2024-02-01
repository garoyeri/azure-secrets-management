# Key Vault SSL Certificate Requests and Renewals

In this rotation strategy, the Key Vault API is used to request a certificate (generate a certificate signing request or CSR), fulfill the certificate creation externally (usually through some offline or ticket driven process), and then merge the certificate with the trust chain and private key securely. The benefit here is that all the private secure bits stay in the Key Vault and off people's machines. The certificate can be used securely by Azure services without needing to touch to the dirty clipboards of human workstations.

## Configuration File Structure

Use the following snippet to configure a Key Vault SSL Certificate request:

```jsonc
// certificate name
"appCertificate1": {
  "type": "azure/keyvault/ssl-certificate",
  "name": "app.company.com",
  "expirationDays": 365,
  "expirationOverlapDays": 60,
  "certificate": {
    "subject": "C=US, ST=TX, L=Houston, O=Company, OU=Department Name, CN=app.company.com",
    "dnsNames": ["app.company.com", "*.app.company.com"],
    "keyStrength": 2048,
    "trustChainPath": "certificates/company.pem",
    "issuedCertificatePath": "certificates/app.company.com.pem"
  }
}
```

The configuration entry has some extra certificate details that are explained here:

- `subject`: Must follow the X.520 attributes for a distinguished name. The documentation is long and complicated to read, so just make sure it follows the format similar to the one above. Your certificate issuer may require more fields to be provided, but just separate them by commas and spaces. The `CN` attribute is required, the rest may be optional.
  - `C`: two letter ISO country code
  - `ST`: state or province code
  - `L`: city or locality
  - `O`: organization name
  - `OU`: organizational unit (or department)
  - `CN`: common name (usually a DNS name)
- `dnsNames`: Array of strings representing the DNS names that will be supported by this certificate. These can be wildcards as well, and feed into the SAN (Subject Alternate Names) part of the certificate. These are required (at least one entry) by modern certificate issuers, so be sure to include it otherwise things won't work.
- `keyStrength`: Available values: `2048`, `3072`, `4096`. Represents the strength of the RSA private key used to secure the certificate.
- `trustChainPath`: Repository-rooted path to a PEM encoded file (one that starts with `-----BEGIN CERTIFICATE-----`) that contains the list of trusted certificates leading to the root CA certificate. If you are getting your certificates signed by an untrusted root (i.e. a private company root CA) then you'll need to include the trust chain here so that Azure Key Vault knows how to trust your certificate and offer the trust chain to web browsers. Make sure this points to a valid file, or just leave it blank if you're signing your certs with something publicly trusted.
- `issuedCertificatePath`: When you receive the certificate from your issuer, it will just be the public certificate, so you can commit it to your GitHub repository without issue. You'll be offering to every HTTPS client anyway. The secret stuff is in the private key, so don't give that away. This is used when you rotate the certificate, and you can overwrite it with the new certificates each time since the older certs are not useful to keep around when they expire.

## Certificate Signing Requests

To start the process, a CSR should be created first. This will create a placeholder secret in Key Vault that will generate a new private key and let you download a CSR to send to your certificate issuer. You can run the action like this:

```yaml
# assume this is already part of a `job` in your GitHub Actions workflow
# ...
- name: Azure login
  uses: azure/login@v1
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Request CSR
  uses: garoyeri/azure-secrets-management@main
  with:
    configuration: certs/dev/config.json
    # force: true # you can choose to force the CSR generation in case you need to rotate early
    operation: request-csr
    # for the resources, list the single resource ID you want, the request CSR operation only works on one
    resources: |
      appCertificate1
# ...
```

The step will automatically generate an artifact named `csr` if you successfully request a CSR or have one pending. Download this CSR to send it to your issuer to get a certificate.

## Certificate Merging

Once you receive the certificate from the issuer, you need to merge it with the trust chain and the private key so it can be used to handle secure communication. In Key Vault, this is called "merging". Here's how we handle it here:

```yaml
# assume this is already part of a `job` in your GitHub Actions workflow
# ...
- name: Azure login
  uses: azure/login@v1
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Merge CSR
  uses: garoyeri/azure-secrets-management@main
  with:
    configuration: certs/dev/config.json
    # force: true # you can choose to force the certificate merging in case you need to rotate early
    operation: rotate
    # for the resources, list the single resource ID you want
    resources: |
      appCertificate1
# ...
```

This will merge the certificate with the pending Key Vault certificate and create a complete PFX package inside Key Vault. You can use the Azure CLI to download this PFX if you want or install it into Kubernetes.
