'use strict'

import express from 'express'
import {
  activateHeartbeat,
  fetchConfig,
  registerMediator
} from 'openhim-mediator-utils'
import { get } from 'request'
import uuid from 'uuid/v4'
import { toJson } from 'xml2json'
import { resolve } from 'url'

import mediatorConfig, { urn } from './mediatorConfig.json'

const openhimConfig = {
  username: 'root@openhim.org',
  password: 'password',
  apiURL: 'https://openhim-core:8080',
  trustSelfSigned: true,
  urn
}

let config = {}

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

function transformDhisData(xmlData) {
  const jsonDhisData = toJson(xmlData, { object: true, trim: true })

  console.log('Received XML data from DHIS2')

  if (
    jsonDhisData &&
    jsonDhisData.metadata &&
    jsonDhisData.metadata.organisationUnits &&
    jsonDhisData.metadata.organisationUnits.organisationUnit
  ) {
    const organisationUnits =
      jsonDhisData.metadata.organisationUnits.organisationUnit

    console.log('Adding universally unique id(uuid) to each org unit...')
    organisationUnits.forEach(organisationUnit => {
      organisationUnit.systemID = uuid()
    })
    return organisationUnits
  } else {
    // The Data structure may change with DHIS2 versions
    console.error(`Unexpected data structure: ${jsonDhisData}`)
    return null
  }
}

const app = express()

app.get('/facilities', async (req, res) => {
  res.set('Content-Type', 'application/json+openhim')
  if (config.dhis && config.dhis.url && config.dhis.path) {
    const dhisUri = resolve(config.dhis.url, config.dhis.path)
    get(dhisUri, (err, resp, body) => {
      if (err) {
        console.error('Failed request to DHIS.', err)
        res.send(buildReturnObject(urn, 'Failed', 500, err))
        return
      }
      if (resp.statusCode !== 200) {
        console.error(
          `Unexpected status code from DHIS: ${
            resp.statusCode
          }. URL: ${dhisUri}`
        )
        res.send(buildReturnObject(urn, 'Failed', resp.statusCode, resp.body))
        return
      }
      let facilities

      try {
        facilities = transformDhisData(body)
      } catch (err) {
        console.error('Error parsing xml', err.message)
        res.send(buildReturnObject(urn, 'Failed', 500, err))
        return
      }

      console.log('Successfully transformed data from DHIS!')
      res.send(buildReturnObject(urn, 'Successful', 200, facilities))
    })
  } else {
    console.error('Missing mediator config...')
    res.send(
      buildReturnObject(urn, 'Failed', 400, {
        message: 'Please add DHIS2 config via OpenHIM console'
      })
    )
  }
})

app.all('*', (req, res) => {
  res.send('Hope you are enjoying the tutorial!!')
})

app.listen(3001, () => {
  const configEmitter = activateHeartbeat(openhimConfig)
  configEmitter.on('error', err => {
    console.error('Heartbeat failed', err)
  })

  configEmitter.on('config', newConfig => {
    console.log('Received updated config:', JSON.stringify(newConfig))

    // Update config for mediator
    config = newConfig
  })
})

registerMediator(openhimConfig, mediatorConfig, err => {
  if (err) {
    console.error('Failed to register mediator. Check your Config: ', err)
    process.exit(1)
  }

  console.log('Successfully registered mediator!')
})

fetchConfig(openhimConfig, (err, initialConfig) => {
  if (err) {
    console.error('Failed to fetch initial config: ', err)
    process.exit(1)
  }

  console.log('Initial Config: ', JSON.stringify(initialConfig))
  config = initialConfig
})
