/*!
 * bws.js - websocket-tcp backend for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

const EventEmitter = require('events');

/**
 * Server
 * @extends EventEmitter
 */

class Server extends EventEmitter {
  constructor(protocols) {
    super();
  }

  address() {
    return {
      address: '127.0.0.1',
      family: 'IPv4',
      port: 0
    };
  }

  async close() {
    return;
  }

  async getConnections() {
    return 0;
  }

  async listen(...args) {
    return;
  }

  get listening() {
    return false;
  }

  set listening(value) {}

  get maxConnections() {
    return undefined;
  }

  set maxConnections(value) {}

  ref() {}

  unref() {}
}

/*
 * Expose
 */

module.exports = Server;
