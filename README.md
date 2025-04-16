# README

App is built with React + TypeScript + Vite.

1. Build image

  ```sh
  podman build --platform linux/arm64 -t de.icr.io/mace2/resources-viewer:latest .
  ```

1. Push the image

  ```sh
  podman push de.icr.io/mace2/resources-viewer:latest
  ```

  ```sh
  ibmcloud ce project create --name resources-viewer-project
  ```

  ```sh
  ibmcloud ce project select --name resources-viewer-project
  ```

  ```sh
  ibmcloud ce registry create --name icr-access --server de.icr.io --username iamapikey --password $API_KEY
  ```

  ```sh
  ibmcloud ce application create --name resources-viewer \
    --image de.icr.io/mace2/resources-viewer:latest \
    --port 8080 \
    --cpu 0.125 \
    --memory 250M \
    --min-scale 1 \
    --max-scale 1 \
    --registry-secret icr-access
  ```
Using Code Engine's build feature will handle the cross-architecture compilation directly in the cloud. 

  ```sh
  ibmcloud ce build create \
    --name resources-viewer-build \
    --source . \
    --strategy dockerfile \
    --size medium \
    --image de.icr.io/mace2/resources-viewer:latest \
    --registry-secret icr-access
  ```
