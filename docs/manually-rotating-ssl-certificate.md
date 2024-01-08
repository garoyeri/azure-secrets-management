# Manually Rotating SSL Certificate

NOTE: this will get split into its own action.

In this strategy, the SSL certificate is issued by some external process, and it just needs to be updated in Key Vault when it's ready to expire. The tricky bit is that the certificate when issued would be stored in a GitHub secret as a base64-encoded PFX, with an optional password stored in a separate secret. This action would need to configured manually for each separate certificate since the secrets need to be referenced explicitly by the GitHub Action to use them.

For a single certificate rotation, the process is as follows:

1. Check the expiration date on the Key Vault certificate secret (this should've been set already to the certificate's expiration).
2. If the expiration is within the rotation period, fetch the new certificate value from the secret.
3. Check the certificate to ensure it's the newer certificate that expires after the original secret's expiration. This will ensure that you don't accidentally overwrite with the same certificate thinking it's newer.
4. Update the Key Vault certificate with the new version (import PFX into Key Vault).
5. If the certificate was changed, then make sure the output flag is set in case downstream changes are needed to be done manually as well.
