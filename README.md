# Openhim Mediator Bootstrap Basic Orchestrator

Basic OpenHIM Orchestrator mediator to be used for tutorials

## Setup

To run startup the orchestrator open a terminal and navigate to the project directory and run the following commands:

```sh
docker build -t orchestrator .

docker network ls

docker run --network {openhim-network} -p 3001:3001 --name orchestrator --rm orchestrator
```

## Add DHIS2 Details via the Console

**DHIS2 URL**: <https://admin:district@play.dhis2.org>
**DHIS2 Path**: /2.32.0/api/organisationUnits.xml?paging=false
