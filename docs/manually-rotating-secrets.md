# Manually Rotating Secrets

Sometimes secrets need to be rotated manually in a generic way. The common case
here is GitHub Personal Access Tokens: these must be generated by a human and
copied into the "Secrets" for a GitHub repository. The secrets manaagement
action will use these secret values to update the Key Vault with the new secret
value, and potentially trigger any downstream updates.

Configuring the manually rotated secrets uses the following JSON fragment in
your configuration:

```json
"secretName": {
    "type": "manual/generic",
    // "name": "" // not used here
    "contentType": "text/plain", // arbitrary, but consider using standard mime-types here
    "decodeBase64": false, // if the source is base64 encoded, set this to decode it first
}
```

Key Vault will store the secret plainly, so that it can most easily be used by
the downstream consumers. So if your source secret is base64-encoded as a GitHub
secret, then you should set the `decodeBase64: true` and set the
`contentType: application/json` to hint to the consumers that the secret is JSON
text.
