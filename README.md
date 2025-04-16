# README

App is built with React + TypeScript + Vite.

Let's use Code Engine's build feature to handle the cross-architecture compilation directly in the cloud. 

1. Let's build the image

  ```sh
  ibmcloud ce build create \
    --name resources-viewer-build \
    --source https://github.com/lionelmace/resources-viewer.git \
    --strategy dockerfile \
    --size medium \
    --image de.icr.io/mace2/resources-viewer:latest \
    --registry-secret icr-access
  ```

1. After creating the build, you'll need to create an application in Code Engine to run your container. Here's the command to deploy your application:

  ```sh
  ibmcloud ce application create \
    --name resources-viewer \
    --image de.icr.io/mace2/resources-viewer:latest \
    --registry-secret icr-access \
    --port 3000
  ```

1. After deployment, you can check the application status

  ```ssh
  ibmcloud ce application get -n resources-viewer
  ```

## Local build

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

1. Skip this step
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

  Output: "exec /docker-entrypoint.sh: exec format error"