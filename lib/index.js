#!/usr/bin/env node
'use strict'

const express = require('express')
const mediatorUtils = require('openhim-mediator-utils')
const pino = require('pino')
const request = require('request')
const uuid = require('uuid/v4')
const parser = require('xml2json')
const URL = require('url')

const {
  MEDIATOR_PORT,
  MEDIATOR_HEARTBEAT,
  OPENHIM_USERNAME,
  OPENHIM_PASSWORD,
  OPENHIM_API_URL,
  OPENHIM_TRUST_SELF_SIGNED,
  LOG_LEVEL
} = require('./constants.js')
const mediatorConfig = require('../mediatorConfig.json')
let config = {}

const logger = pino({
  level: LOG_LEVEL,
  prettyPrint: true,
  serializers: {
    err: pino.stdSerializers.err
  }
})

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
  let jsonDhisData = parser.toJson(xmlData, { object: true, trim: true })

  logger.info('Received XML data from DHIS2')

  if (
    jsonDhisData &&
    jsonDhisData.metadata &&
    jsonDhisData.metadata.organisationUnits &&
    jsonDhisData.metadata.organisationUnits.organisationUnit
  ) {
    const organisationUnits =
      jsonDhisData.metadata.organisationUnits.organisationUnit

    logger.info('Adding universally unique id(uuid) to each org unit...')
    organisationUnits.forEach(organisationUnit => {
      organisationUnit.systemID = uuid()
    })
    return organisationUnits
  } else {
    // The Data structure may change with DHIS2 versions
    logger.error(`Unexpected data structure: ${jsonDhisData}`)
    return null
  }
}

function setUpApp() {
  const app = express()

  app.get('/facilities', async (req, res) => {
    res.set('Content-Type', 'application/json+openhim')
    if (config.dhis && config.dhis.url && config.dhis.path) {
      const dhisUri = URL.resolve(config.dhis.url, config.dhis.path)
      request.get(dhisUri, (err, resp, body) => {
        if (err) {
          logger.error('Failed request to DHIS.', err)
          res.send(buildReturnObject(mediatorConfig.urn, 'Failed', 500, err))
          return
        }
        if (resp.statusCode !== 200) {
          logger.error(
            `Unexpected status code from DHIS: ${
              resp.statusCode
            }. URL: ${dhisUri}`
          )
          res.send(
            buildReturnObject(
              mediatorConfig.urn,
              'Failed',
              resp.statusCode,
              resp.body
            )
          )
          return
        }
        let facilities

        try {
          facilities = transformDhisData(body)
        } catch (err) {
          logger.error('Error parsing xml', err.message)
          res.send(buildReturnObject(mediatorConfig.urn, 'Failed', 500, err))
          return
        }

        logger.info('Successfully transformed data from DHIS!')
        res.send(
          buildReturnObject(mediatorConfig.urn, 'Successful', 200, facilities)
        )
      })
    } else {
      logger.error('Missing mediator config...')
      res.send(
        buildReturnObject(mediatorConfig.urn, 'Failed', 400, {
          message: 'Please add DHIS2 config via OpenHIM console'
        })
      )
    }
  })

  app.all('*', (req, res) => {
    logger.info('Current config: ', config)
    res.send('Hope you are enjoying the tutorial!!')
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
      config = newConfig

      logger.info('Successfully registered mediator!')

      let app = setUpApp()
      const server = app.listen(MEDIATOR_PORT, () => {
        if (MEDIATOR_HEARTBEAT) {
          const configEmitter = mediatorUtils.activateHeartbeat(openHimConfig)
          configEmitter.on('error', err => {
            Winston.error('Heartbeat failed', err)
          })

          configEmitter.on('config', newConfig => {
            logger.info('Received updated config:', JSON.stringify(newConfig))

            // Update config for mediator
            config = newConfig
          })
        }
        callback(server)
      })
    })
  })
}

start(() => logger.info(`Listening on port ${MEDIATOR_PORT}...`))
