# Manually Rotating SSL Certificate

In this strategy, the SSL certificate is issued by some external process, and it
just needs to be updated in Key Vault when it's ready to expire. The tricky bit
is that the certificate when issued would be stored in a GitHub secret as a
base64-encoded PFX, with an optional password stored in a separate secret. This
action would need to configured manually for each separate certificate since the
secrets need to be referenced explicitly by the GitHub Action to use them.

For a single certificate rotation, the process is as follows:

1. Check the expiration date on the Key Vault certificate secret (this should've
   been set already to the certificate's expiration).
1. If the expiration is within the rotation period, fetch the new certificate
   value from the secret.
1. Check the certificate to ensure it's the newer certificate that expires after
   the original secret's expiration. This will ensure that you don't
   accidentally overwrite with the same certificate thinking it's newer.
1. Update the Key Vault certificate with the new version (import PFX into Key
   Vault).
1. If the certificate was changed, then make sure the output flag is set in case
   downstream changes are needed to be done manually as well.

Certificates are stored specially in Key Vault, and they must be imported as a
PFX file. Certificate can be imported using the Key Vault API:
[https://learn.microsoft.com/en-us/rest/api/keyvault/certificates/import-certificate/import-certificate?view=rest-keyvault-certificates-7.4&tabs=HTTP].
When the certificate is imported, its expiration should be set automatically
based on the certificate details by the API, so we shouldn't need to calculate
that. When the certificate is imported, the password is removed and the Key
Vault uses its own access policies or role-based access controll to manage
access to the secret. The certificate will be marked as exportable so that it
can be exported to be used in Kubernetes.

Configure a SSL certificate like this:

```json
"secretName": {
    "type": "manual/certificate",
    // "name": "" // not used here
    "contentType": "application/x-pkcs12", // arbitrary, but consider using standard mime-types here
    "decodeBase64": true, // if the source is base64 encoded, set this to decode it first
}
```

Certificates need to be passed to GitHub Actions as base64-encoded text since
the inputs are all strings. This is why `decodeBase64: true` is the default.
