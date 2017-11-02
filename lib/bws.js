/*!
 * bws.js - websocket-tcp backend for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

const Socket = require('./socket');
const Server = require('./server');

/**
 * Socket
 * @constructor
 */

exports.Socket = Socket;

/**
 * Server
 * @constructor
 */

exports.Server = Server;

/**
 * Create a TCP socket and connect.
 * @param {Number} port
 * @param {String} host
 * @returns {Object}
 */

exports.connect = Socket.connect;

/**
 * Create a TCP socket and connect.
 * @param {Number} port
 * @param {String} host
 * @returns {Object}
 */

exports.createSocket = Socket.connect;

/**
 * Create a TCP socket and connect.
 * @param {Number} port
 * @param {String} host
 * @returns {Object}
 */

exports.createConnection = Socket.connect;

/**
 * Create a TCP server.
 * @param {Function?} handler
 * @returns {Object}
 */

exports.createServer = function createServer(handler) {
  return new Server(handler);
};
