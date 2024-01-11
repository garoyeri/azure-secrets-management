# Configuration of Secrets Management

Secrets Management tries to derive all its inputs from the resources as they exist and not rely on any extra state that would need to be synchronized. At minimum, it needs a configuration file to give it some hints though:

1. Which Key Vault should it use for storing rotated secrets?
2. Which (and what type of) resources should be managed / rotated?
3. What rotation policies to apply to these resources?
4. Any other "extra" synchronizations that should be done after rotation?

## Setting up Secrets Management

This action aims to be very limited and focused in its role, to provide a headless way to manage existing secrets and rotate them.

### Supported Resource Types

These are the types of rotations that are supported:

* SSL Certificates
  * Manual Rotation
    * These are a special case because they use the GitHub secrets to store the certificate content. They can't be automated all together, but separately only.
* Storage Accounts
  * If you are using shared key authentication, then the keys should be rotated. When the keys are rotated, then any SAS tokens created using those keys are invalidated automatically.
  * SAS Tokens should be used for all operations if shared key authentication is the necessary approach. However, in some cases only the Shared Key is supported due to limitations in the application.
* Service Bus / Event Hub / IoT Hub
  * If you are using local authentication, then the keys should be rotated. Access policies created using those keys will be invalidated when the keys are rotated. The access keys need to be regenerated as well when the secrets are rotated. The root keys should not be shared or used with any applications.
* Redis Cache
  * These keys are rotated and shared.
* PostgreSQL
  * Flexible Server
    * Admin Credentials
      * An "Admin" credential is required to allow these databases to be managed. The "Admin" credential should not be used by any applications, but only to manage the server itself.
    * Application Credentials
      * Each application should have its own database credential to rotate. In a microservice architecture, each microservice should also get its own credential. These should be initialized and rotated at the appropriate intervals.
      * In this strategy, a "template" is required to manage the permissions for each application to create the appropriate credentials each time. The template should just require a "role" or set of "roles" that are created on the database and granted permissions.
* SQL Azure (TBD)
  * Admin Credentials
  * Application Credentials
* GitHub Tokens
  * Manual Rotation
    * This one is trickier as a human is required to create the tokens, and having a token doesn't grant permission to create new tokens. When a token is ready to rotate, it must be done manually as well (like SSL certificates).

When a rotation occurs, then an output is set on the action that can be used to trigger further actions. For example: updating the GitHub token secret should synchronize that value with all the affected Kubernetes namespaces controlled by that secret. That sort of activity is out of scope here, but can be scripted as a secondary action: the goal for this action is only to make sure the secrets are rotated and the Key Vault is updated.

### Initialization

This action assumes that you've already `az login`'ed with the right credentials and that using `DefaultAzureCredential` will "do the right thing". This should be the case in most cases... hopefully. If you don't have any resources to manage, then there's no state to maintain. Initialization is different for manually rotated resources versus automatically rotated ones.

#### Manual Rotations

These must be split into their own custom actions to make life easier for everyone. These would all require custom / conditional inputs and changing the way things work.

#### Automatic Rotations

The action will not look at a resource unless it's part of a configuration. As such, when the action is run, a configuration file must be passed in to tell it what resources to look and what to ignore. When a new resource is added, it must be onboarded and set to an initial secret state.

Configuration file example:

```json
{
    // applies this property to every resource by default
    "defaults": {
        "resourceGroup": "resourceGroup1",
        "keyVaultResourceGroup": "resourceGroup1",
        "keyVault": "vault1",
        "keyVaultSecretPrefix": "",
        "expirationDays": 90,
        "expirationOverlapDays": 30
    },
    "resources": {
        "storage1": {
            "type": "azure/storage-account",
            "name": "storageaccountname"
        },
        "databaseServer1": {
            "type": "azure/postgresql-flexible-server",
            "name": "serverName1"
        },
        "databaseApplication1": {
            "type": "azure/postgresql-flexible-server/user",
            "name": "app1",
            "serverName": "databaseServer1",
            "roles": [ "ROLE1", "ROLE2" ]
        }
    }
}
```

To know if the rotation is working, a secret needs to be created to house the latest rotated secret value. This matches the key of the resource in the `resources` block. For example, the Storage Account `storageaccountname` would have a secret named `storage1` in the Key Vault containing the active shared key. When initializing the secrets management, it will look to see if the secret has been created yet, and, if not, then rotate the resource secrets and update the secret with the correct initial value.

For example: initializing `storage1` requires looking at the Storage Account keys, assuming the Primary Key is the active one, and saving it. When it's time to check for a rotation, then it can review the age of both keys to decide which to make the next active key. However, if the Key Vault secret is found, it will assume the resource is initialized already. You can force initialization by passing `force: true` and `resources: comma,separate,resource-ref,list`.

To initialize, use the `initialize` flag:

```yaml
steps:
  # ...
  - uses: garoyeri/azure-secrets-management@v1
    with:
      configuration: ./environments/whatever/secrets.json
      operation: initialize
```

To force a resource to re-initialize (this could force a rotation):

```yaml
steps:
  # ...
  - uses: garoyeri/azure-secrets-management@v1
    with:
      configuration: ./environments/whatever/secrets.json
      operation: initialize
      force: true
      resources: storage1,databaseServer1
```

### Performing Rotations

Once configured, then rotations can be performed by just running the action:

```yaml
steps:
  # ...
  - uses: garoyeri/azure-secrets-management@v1
    with:
      configuration: ./environments/whatever/secrets.json
```

You can force a rotation using the `force` flag and optionally specifying which resources to rotate:

```yaml
steps:
  # ...
  - uses: garoyeri/azure-secrets-management@v1
    with:
      configuration: ./environments/whatever/secrets.json
      force: true
      resources: storage1
```

If you run the rotation and the target secret isn't initialized yet, then the rotation will be skipped. Resources should be onboarded explicitly to ensure that the wrong resources aren't rotated prematurely.

The action has an output to list which resources were rotated, if any. This allows you to setup a subsequent action to check if any synchronization is required as post-actions. For example: replicating a secret value to Kubernetes manually (so far this is only done for manually rotated things like GitHub tokens and SSL certificates).

### Testing Things Out

You can use the `what-if` flag to just do a practice run of the rotation.

```yaml
steps:
  # ...
  - uses: garoyeri/azure-secrets-management@v1
    with:
      configuration: ./environments/whatever/secrets.json
      what-if: true
```

### Generate Configuration by Scanning Resources

The secrets management tool knows which resources are supported and can scan a resource group for potentially supported resources as well. You'll need at least a minimal configuration file with a default resource group defined. The scan process will poke at the default resource group and any other configured resource groups to see what resources are available, and output a default configuration in the run output that you can copy / paste into your configuration file.

Configuration File:

```json
{
    "defaults": {
        "resourceGroup": "resourceGroup1"
    }
}
```

```yaml
steps:
  # ...
  - uses: garoyeri/azure-secrets-management@v1
    with:
      configuration: ./environments/whatever/secrets.json
      operation: generate-configuration
```

Make any desired adjustments and run the initialization operation when you're ready to use them.

### Configuration Reference

* `defaults`: these key-value pairs will be applied by default to all resources in the configuration.
* `resources`: these are the resources that should be configured to be rotated.

For each `resource`, there is a name identifier which is used by the action to identify resources when the `resources` filter is used to call the action. These must be unique within a configuration file.

Each `resource` entry has some common properties:

* `type`: How to interpret this resource entry. Different types have different configuration fields and different defaults. Review the documentation to see which types are supported. This field is case-sensitive.
* `name`: (optional based on type) the name of the resource based on the type, this is used to find the resource in the specifed Azure resource group.
* `resourceGroup`: (optional based on type) the name of the resource group where the resource is located.
* `keyVault`: the name of the Key Vault to store the rotated secret into.
* `keyVaultResourceGroup`: the name of the resource group where the Key Vault is located.
* `keyVaultSecretPrefix`: the prefix of the secret name to use (the secret name will always be the identifier name... for now).
* `expirationDays`: (optional based on type) how many days the secret is valid for.
* `expirationOverlapDays`: the number of days remaining for the secret before starting the rotation process. This should be less than `expirationDays` and can be `0` meaning that it should be rotated when it expires. You will want to have some overlap between the old secret and the new one to allow services to shift over to the new secret and use the old one while they do, avoiding any unnecessary errors.
