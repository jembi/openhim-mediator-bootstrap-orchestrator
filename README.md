# Openhim Mediator Bootstrap Basic Orchestrator

Basic OpenHIM Orchestrator mediator to be used for tutorials

## Setup

OpenHIM Config can be found [here](./index.js#L22)

### Docker

To run startup the orchestrator open a terminal and navigate to the project directory and run the following commands:

```sh
docker build -t orchestrator .

docker network ls

docker run --network {openhim-network} -p 3001:3001 --name orchestrator --rm orchestrator
```

> If you start the bootstrap orchestrator with Docker it would be easiest to also have the OpenHIM Core running in a container using Docker.

### Node NPM

To run startup the orchestrator open a terminal and navigate to the project directory and run the following commands:

```sh
npm install

npm start
```

> If you start the bootstrap orchestrator with NPM it would be easiest to also have the OpenHIM Core running locally using NPM.

## Add DHIS2 Details via the Console

**DHIS2 URL**: <https://admin:district@play.dhis2.org>
**DHIS2 Path**: /2.32.0/api/organisationUnits.xml?paging=false
