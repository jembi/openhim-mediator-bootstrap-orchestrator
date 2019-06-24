#!/usr/bin/env node
'use strict'

// Mediator Server Config
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
export const MEDIATOR_PORT = process.env.MEDIATOR_PORT || 3001
export const MEDIATOR_HEARTBEAT =
  process.env.MEDIATOR_HEARTBEAT === 'false' ? false : true

// OpenHIM instance Config
export const OPENHIM_API_URL =
  process.env.OPENHIM_API_URL || 'https://localhost:8080'
export const OPENHIM_USERNAME =
  process.env.OPENHIM_USERNAME || 'root@openhim.org'
export const OPENHIM_PASSWORD =
  process.env.OPENHIM_PASSWORD || 'openhim-password'
export const OPENHIM_TRUST_SELF_SIGNED =
  process.env.OPENHIM_TRUST_SELF_SIGNED === 'true' ? true : false
