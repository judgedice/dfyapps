# Azure setup (one time)

These steps create the `dfyapps` Container App next to the hub, give it somewhere to keep survey responses, and put it on `dfy.work`. After this, every push to `main` deploys automatically.

You need the Azure CLI, signed in with rights on `rg-dreemweaver-hub`, and access to the `dfy.work` DNS records.

## 1. Set variables

```bash
RG=rg-dreemweaver-hub
LOCATION=eastus
REGISTRY=dreemweaverhubacr
APP=dfyapps
STORAGE=dfyappsresponses        # globally unique, 3–24 lowercase letters and digits
ENV_NAME=$(az containerapp env list -g $RG --query "[0].name" -o tsv)
echo "Using Container Apps environment: $ENV_NAME"
```

If the resource group has more than one environment, set `ENV_NAME` to the hub's environment by hand.

## 2. Create storage for responses

Each response is saved as one JSON file in a private blob container.

```bash
az storage account create -n $STORAGE -g $RG -l $LOCATION \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
  --allow-blob-public-access false

STORAGE_CONNECTION=$(az storage account show-connection-string -n $STORAGE -g $RG -o tsv)

az storage container create --name responses --connection-string "$STORAGE_CONNECTION"
```

Responses land at `responses/workflow-survey/<timestamp>_<id>.json`.

## 3. Build the first image

The Container App needs an image to start from. Run this from the repo root:

```bash
az acr build --registry $REGISTRY --resource-group $RG \
  --image $APP:latest --build-arg BUILD_SHA=initial .
```

## 4. Create the Container App

This mirrors how the hub's MCP broker is created. The export password protects the CSV download; save it in your password manager.

```bash
EXPORT_PASSWORD=$(openssl rand -base64 24)
echo "Export password: $EXPORT_PASSWORD"

ENV_ID=$(az containerapp env show -n "$ENV_NAME" -g $RG --query id -o tsv)
ACR_PASSWORD=$(az acr credential show -n $REGISTRY --query 'passwords[0].value' -o tsv)

umask 077   # the file holds secrets until it is removed below
cat > dfyapps.yaml <<EOF
properties:
  managedEnvironmentId: $ENV_ID
  configuration:
    ingress:
      external: true
      targetPort: 8080
    secrets:
      - name: acr-registry-password
        value: "$ACR_PASSWORD"
      - name: storage-connection
        value: "$STORAGE_CONNECTION"
      - name: export-password
        value: "$EXPORT_PASSWORD"
    registries:
      - server: $REGISTRY.azurecr.io
        username: $REGISTRY
        passwordSecretRef: acr-registry-password
  template:
    containers:
      - name: dfyapps
        image: $REGISTRY.azurecr.io/$APP:latest
        resources:
          cpu: 0.25
          memory: 0.5Gi
        env:
          - name: AZURE_STORAGE_CONNECTION_STRING
            secretRef: storage-connection
          - name: EXPORT_PASSWORD
            secretRef: export-password
        probes:
          - type: Readiness
            httpGet:
              path: /health
              port: 8080
    scale:
      minReplicas: 0
      maxReplicas: 2
EOF

az containerapp create -n $APP -g $RG --environment "$ENV_NAME" --yaml dfyapps.yaml
rm dfyapps.yaml
```

Check it:

```bash
FQDN=$(az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv)
curl https://$FQDN/health
```

Then open `https://$FQDN/workflow-survey/` in a browser.

`minReplicas: 0` means the app sleeps when idle and costs almost nothing, but the first visitor after a quiet spell waits a few seconds. While the survey is open, you can keep one replica warm:

```bash
az containerapp update -n $APP -g $RG --min-replicas 1
```

## 5. Put it on dfy.work

`dfy.work` is the bare (apex) domain, so it uses an A record rather than a CNAME. `hub.dfy.work` and `mcp.dfy.work` are separate records and aren't affected.

> If `dfy.work` already points somewhere, changing its A record moves all of `dfy.work` to this app. Check before you change it.

Get the values for DNS:

```bash
az containerapp env show -n "$ENV_NAME" -g $RG --query properties.staticIp -o tsv
az containerapp show -n $APP -g $RG --query properties.customDomainVerificationId -o tsv
```

Add these records at your DNS provider:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | the static IP |
| TXT | `asuid` | the verification ID |

After DNS has propagated, add the domain and a free managed certificate. Apex domains use HTTP validation:

```bash
az containerapp hostname add -n $APP -g $RG --hostname dfy.work
az containerapp hostname bind -n $APP -g $RG --hostname dfy.work \
  --environment "$ENV_NAME" --validation-method HTTP
```

The certificate can take up to 20 minutes. Then `https://dfy.work/workflow-survey/` is live.

## 6. Let GitHub deploy

In this repo's **Settings → Secrets and variables → Actions**, add `AZURE_CREDENTIALS` with the same value the hub repo uses. Its service principal already has Contributor rights on `rg-dreemweaver-hub`, which covers the registry build and the Container App update.

From then on, each push to `main` runs the tests, builds the image in the registry, deploys it, and waits until `/health` reports the new commit.

## Changing secrets later

```bash
az containerapp secret set -n $APP -g $RG --secrets export-password="new-password"
az containerapp revision restart -n $APP -g $RG \
  --revision $(az containerapp show -n $APP -g $RG --query properties.latestRevisionName -o tsv)
```
