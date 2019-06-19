#!/usr/bin/env node
'use strict'

const express = require('express')
const mediatorUtils = require('openhim-mediator-utils')
const pino = require('pino')

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

const logger = pino({
  level: LOG_LEVEL,
  prettyPrint: true,
  serializers: {
    err: pino.stdSerializers.err
  }
})

function setUpApp() {
  const app = express()

  app.all('*', async (req, res) => {
    res.send('Success')
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
