'use strict'

import express from 'express'

// The OpenHIM Mediator Utils is an essential package for quick mediator setup.
// It handles the OpenHIM authentication, mediator registration, and mediator heartbeat.
import {
  activateHeartbeat,
  fetchConfig,
  registerMediator
} from 'openhim-mediator-utils'

import fetch from 'node-fetch'
import uuid from 'uuid/v4'
import { toJson } from 'xml2json'
import { resolve } from 'url'

// The mediatorConfig file contains some basic configuration settings about the mediator
// as well as details about the default channel setup.
import mediatorConfig, { urn } from './mediatorConfig.json'

const openhimConfig = {
  username: 'root@openhim.org',
  password: 'password',
  apiURL: 'https://openhim-core:8080',
  trustSelfSigned: true,
  urn
}

// Allow config to be updated from the OpenHIM Console and make the updates accessible.
let config = {}

// The OpenHIM accepts a specific response structure which allows transactions to display correctly
function buildReturnObject(urn, status, statusCode, responseBody) {
  var response = {
    status: statusCode,
    headers: { 'content-type': 'application/json' },
    body: responseBody,
    timestamp: new Date().getTime()
  }
  return {
    'x-mediator-urn': urn,
    status,
    response,
    properties: { property: 'Primary Route' }
  }
}

// Take the XML facility data from DHIS2 and convert it to JSON and add a UUID
// The logic applied here is arbitrary however it is useful to see how it is implemented.
function transformXmlDhisDataToJson(xmlData) {
  const jsonDhisData = toJson(xmlData, { object: true, trim: true })

  console.log('Received XML data from DHIS2')

  // Make sure the structure of the GET request is in the expected form...
  if (
    jsonDhisData &&
    jsonDhisData.metadata &&
    jsonDhisData.metadata.organisationUnits &&
    jsonDhisData.metadata.organisationUnits.organisationUnit
  ) {
    // An Organisation Unit in DHIS2 is a generic grouping term. In this context it refers to a medical Facility.
    const organisationUnits =
      jsonDhisData.metadata.organisationUnits.organisationUnit

    console.log('Adding universally unique id(uuid) to each org unit...')

    // Add a UUID to each facility. This is arbitrary and is just for demonstration purposes.
    organisationUnits.forEach(organisationUnit => {
      organisationUnit.systemID = uuid()
    })
    return organisationUnits
  } else {
    // The data structure may change with DHIS2 versions
    console.error(`Unexpected data structure: ${jsonDhisData}`)
    return null
  }
}

const app = express()

// Only a GET request to /facilities will trigger the DHIS2 orchestration
app.get('/facilities', async (_req, res) => {
  // The config here comes from the config entered by the User in the openHIM console.
  if (config.dhis && config.dhis.url && config.dhis.path) {
    const dhisUri = resolve(config.dhis.url, config.dhis.path)

    const dhisFacilitiesInXml = await fetch(dhisUri).then(res => res.text())

    const facilityDataInJson = transformXmlDhisDataToJson(dhisFacilitiesInXml)

    const returnObject = buildReturnObject(
      urn,
      'Successful',
      200,
      facilityDataInJson
    )

    res.send(returnObject)
  } else {
    // Remind the User to add the mediator config in the console if they attempt requests before adding it.
    console.error('Missing mediator config...')

    const returnObject = buildReturnObject(urn, 'Failed', 400, {
      message: 'Please add DHIS2 config via OpenHIM console'
    })
    res.send(returnObject)
  }
})

// Any request regardless of request type or url path to the mediator port will be caught here
// and trigger the canned response.
app.all('*', (_req, res) => {
  res.send('Hope you are enjoying the tutorial!!')
})

app.listen(3001, () => {
  console.log('Listening on port 3001...')

  mediatorSetup()
})

const mediatorSetup = () => {
  // The purpose of registering the mediator is to allow easy communication between the mediator and the OpenHIM.
  // The details received by the OpenHIM will allow quick channel setup which will allow tracking of requests from
  // the client through any number of mediators involved and all the responses along the way(if the mediators are
  // properly configured). Moreover, if the request fails for any reason all the details are recorded and it can
  // be replayed at a later date to prevent data loss.
  registerMediator(openhimConfig, mediatorConfig, err => {
    if (err) {
      throw new Error(`Failed to register mediator. Check your Config. ${err}`)
    }

    console.log('Successfully registered mediator!')

    // This function retrieves existing config contained in the OpenHIM. This config may be existing for two reasons:
    // Firstly, config can be set on mediator registration, Second, the config will be persisted between mediator restarts.
    fetchConfig(openhimConfig, (err, initialConfig) => {
      if (err) {
        throw new Error(`Failed to fetch initial config. ${err}`)
      }

      console.log('Initial Config: ', JSON.stringify(initialConfig))

      // Add initial config values
      config = initialConfig

      // The activateHeartbeat method returns an Event Emitter which allows the mediator to attach listeners waiting
      // for specific events triggered by OpenHIM responses to the mediator posting its heartbeat.
      const emitter = activateHeartbeat(openhimConfig)
      emitter.on('error', err => {
        console.error(`Heartbeat failed: ${err}`)
      })

      // The config events is emitted when the heartbeat request posted by the mediator returns data from the OpenHIM.
      emitter.on('config', newConfig => {
        console.log('Received updated config:', JSON.stringify(newConfig))

        // Update config for mediator
        config = newConfig
      })
    })
  })
}
