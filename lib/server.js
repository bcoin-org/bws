/*!
 * bws.js - websocket-tcp backend for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const http = require('http');
const WebSocket = require('./backend');
const Socket = require('./socket');

/**
 * Server
 * @extends EventEmitter
 */

class Server extends EventEmitter {
  constructor(protocols) {
    super();
    assert(!protocols || Array.isArray(protocols));
    this.server = new http.Server();
    this.protocols = protocols || undefined;
    this.init();
  }

  init() {
    this.server.on('close', () => {
      this.emit('close');
    });

    this.server.on('error', (err) => {
      this.emit('error', err);
    });

    this.server.on('listening', () => {
      this.emit('listening');
    });

    this.server.on('request', (req, res) => {
      req.socket.on('error', () => {});
      req.on('error', () => {});
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
      res.statusCode = 200;
      res.end();
    });

    this.server.on('upgrade', (req, socket, body) => {
      if (!socket.remoteAddress) {
        socket.destroy();
        return;
      }

      if (!WebSocket.isWebSocket(req)) {
        socket.destroy();
        return;
      }

      const ws = new WebSocket(req, socket, body, this.protocols, {
        maxLength: 14 << 20
      });

      this.emit('connection', Socket.accept(req, socket, ws));
    });
  }

  address() {
    return this.server.address();
  }

  close() {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  getConnections() {
    return new Promise((resolve, reject) => {
      this.server.getConnections((err, count) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(count);
      });
    });
  }

  listen(port, host) {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, () => {
        this.server.removeListener('error', reject);
        resolve();
      });
    });
  }

  get listening() {
    return this.server.listening;
  }

  set listening(value) {}

  get maxConnections() {
    return this.server.maxConnections;
  }

  set maxConnections(value) {
    this.server.maxConnections = value;
  }

  ref() {
    this.server.ref();
    return this;
  }

  unref() {
    this.server.unref();
    return this;
  }
}

/*
 * Expose
 */

module.exports = Server;
