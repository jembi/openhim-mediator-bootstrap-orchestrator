#!/usr/bin/env node
'use strict'

const express = require('express')
const mediatorUtils = require('openhim-mediator-utils')
const pino = require('pino')
const request = require('request')
const uuid = require('uuid/v4')
const parser = require('xml2json')

const {
  MEDIATOR_PORT,
  MEDIATOR_HEARTBEAT,
  OPENHIM_USERNAME,
  OPENHIM_PASSWORD,
  OPENHIM_API_URL,
  OPENHIM_TRUST_SELF_SIGNED,
  LOG_LEVEL,
  DHIS_DEMO_URL
} = require('./constants.js')
const mediatorConfig = require('../mediatorConfig.json')

const logger = pino({
  level: LOG_LEVEL,
  prettyPrint: true,
  serializers: {
    err: pino.stdSerializers.err
  }
})

function buildReturnObject (urn, status, statusCode, responseBody) {
  var response = {
    status: statusCode,
    headers: { "content-type": "application/json" },
    body: responseBody,
    timestamp: new Date().getTime()
  }
  return {
    'x-mediator-urn': urn,
    status,
    response,
    properties: { property: "Primary Route" }
  }
}

function transformDhisData(xmlData) {
  const jsonDhisData = parser.toJson(xmlData, { object: true, trim: true })
  if (
    jsonDhisData &&
    jsonDhisData.metadata &&
    jsonDhisData.metadata.organisationUnits &&
    jsonDhisData.metadata.organisationUnits.organisationUnit
  ) {
    const organisationUnits =
      jsonDhisData.metadata.organisationUnits.organisationUnit
    organisationUnits.forEach(organisationUnit => {
      organisationUnit.systemID = uuid()
    })
    return organisationUnits
  } else {
    // The Data structure may change with DHIS2 versions
    logger.error(`Unexpected data structure from DHIS. Check DHIS2 version.`)
  }
}

function setUpApp() {
  const app = express()

  app.all('*', async (req, res) => {
    request.get(DHIS_DEMO_URL, async (err, resp, body) => {
      if (err) {
        logger.error(err)
      }
      if (resp.statusCode !== 200) {
        logger.error(`Unexpected status code from DHIS: ${res.statusCode}`)
      }
      const facilities = await transformDhisData(body)
      res.send(
        buildReturnObject(mediatorConfig.urn, 'Successful', 200, facilities)
      )
    })
  })
  return app
}

const openHimConfig = {
  username: OPENHIM_USERNAME,
  password: OPENHIM_PASSWORD,
  apiURL: OPENHIM_API_URL,
  trustSelfSigned: OPENHIM_TRUST_SELF_SIGNED
}

function start(callback) {
  if (OPENHIM_TRUST_SELF_SIGNED) {
    logger.warn('Disabled TLS Authentication!!')
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  mediatorUtils.registerMediator(openHimConfig, mediatorConfig, err => {
    if (err) {
      logger.error('Failed to register mediator. Check your Config...')
      logger.error(err)
      process.exit(1)
    }
    openHimConfig.urn = mediatorConfig.urn
    mediatorUtils.fetchConfig(openHimConfig, (err, newConfig) => {
      if (err) {
        logger.error('Failed to fetch initial config')
        logger.error(err)
        process.exit(1)
      }

      logger.info(`Received new config: ${JSON.stringify(newConfig)}`)

      logger.info('Successfully registered mediator!')

      let app = setUpApp()
      const server = app.listen(MEDIATOR_PORT, () => {
        if (MEDIATOR_HEARTBEAT) {
          mediatorUtils.activateHeartbeat(openHimConfig)
        }
        callback(server)
      })
    })
  })
}

start(() => logger.info(`Listening on port ${MEDIATOR_PORT}...`))
