/*!
 * bws.js - websocket-tcp backend for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

/* global Blob, FileReader */

const assert = require('assert');
const WebSocket = require('./backend').Client;

/*
 * Constants
 */

const codes = {
  1000: 'NORMAL_CLOSURE',
  1001: 'GOING_AWAY',
  1002: 'PROTOCOL_ERROR',
  1003: 'UNSUPPORTED_DATA',
  1004: 'RESERVED',
  1005: 'NO_STATUS_RECVD',
  1006: 'ABNORMAL_CLOSURE',
  1007: 'INVALID_FRAME_PAYLOAD_DATA',
  1008: 'POLICY_VIOLATION',
  1009: 'MESSAGE_TOO_BIG',
  1010: 'MISSING_EXTENSION',
  1011: 'INTERNAL_ERROR',
  1012: 'SERVICE_RESTART',
  1013: 'TRY_AGAIN_LATER',
  1014: 'BAD_GATEWAY',
  1015: 'TLS_HANDSHAKE'
};

const noop = () => {};

/**
 * Socket
 * @extends EventEmitter
 */

class Socket extends EventEmitter {
  /**
   * Create a socket.
   * @constructor
   */

  constructor() {
    super();

    this.ws = null;
    this.readable = true;
    this.writable = true;
    this.encoding = null;
    this.encrypted = false;
    this.bufferSize = 0;
    this.bytesWritten = 0;
    this.bytesRead = 0;
    this.connecting = false;
    this.destroyed = false;
    this.localAddress = '127.0.0.1';
    this.localPort = 0;
    this.remoteAddress = '127.0.0.1';
    this.remoteFamily = 'IPv4';
    this.remotePort = 0;

    this.maxFrame = 0;
    this.maxBase64 = 0;
    this.setMaxFrame(24 + 4000000);
  }

  setMaxFrame(size) {
    assert((size >>> 0) === size);
    this.maxFrame = size;
    this.maxBase64 = (((4 * size / 3) + 3) & ~3) >>> 0;
  }

  accept(req, socket, ws) {
    assert(!this.ws, 'Cannot accept twice.');

    assert(req);
    assert(socket);
    assert(socket.remoteAddress);
    assert(socket.remotePort != null);
    assert(ws);

    this.encrypted = socket.encrypted || false;
    this.localAddress = socket.localAddress;
    this.localPort = socket.localPort;
    this.remoteAddress = socket.remoteAddress;
    this.remoteFamily = socket.remoteFamily;
    this.remotePort = socket.remotePort;
    this.ws = ws;
    this.connecting = false;
    this.bind();

    return this;
  }

  connect(port, host, ssl, protocols) {
    assert(!this.ws, 'Cannot connect twice.');

    let proto = 'ws';
    let family = 'IPv4';
    let encrypted = false;

    if (ssl) {
      proto = 'wss';
      encrypted = true;
    }

    if (!host)
      host = '127.0.0.1';

    assert(typeof host === 'string');
    assert((port & 0xffff) === port, 'Must pass a port.');
    assert(!ssl || typeof ssl === 'boolean');
    assert(!protocols || Array.isArray(protocols));

    let hostname = host;

    if (host.indexOf(':') !== -1 && host[0] !== '[') {
      hostname = `[${host}]`;
      family = 'IPv6';
    }

    const url = `${proto}://${hostname}:${port}/`;

    const ws = new WebSocket(url, protocols, {
      headers: {
        'User-Agent': 'bws',
        // Spoof
        'Origin': 'https://www.example.com/'
      },
      maxLength: 14 << 20
    });

    this.encrypted = encrypted;
    this.localAddress = host;
    this.localPort = port;
    this.remoteAddress = host;
    this.remoteFamily = family;
    this.remotePort = port;
    this.ws = ws;
    this.connecting = true;
    this.bind();

    return this;
  }

  bind() {
    const ws = this.ws;

    assert(ws);

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      this.handleOpen();
    };

    ws.onmessage = async (event) => {
      await this.handleMessage(event);
    };

    ws.onerror = (event) => {
      this.handleError(event);
    };

    ws.onclose = (event) => {
      this.handleClose(event);
    };

    if (typeof ws.on === 'function') {
      ws.on('drain', () => {
        this.handleDrain();
      });
    }
  }

  handleOpen() {
    this.connecting = false;
    this.emit('connect');
  }

  async handleMessage(event) {
    let data;

    try {
      data = await readBinary(event.data);
    } catch (e) {
      this._error(e);
      return;
    }

    if (typeof data === 'string') {
      if (data.length > this.maxBase64) {
        this._error(new Error('Frame base64 length exceeds max.'));
        return;
      }
      data = Buffer.from(data, 'base64');
    }

    if (data.length > this.maxFrame) {
      this._error(new Error('Frame length exceeds max.'));
      return;
    }

    this.bytesRead += data.length;

    if (this.encoding)
      data = data.toString(this.encoding);

    this.emit('data', data);
  }

  handleError(event) {
    this._error(new Error(event.message));
  }

  handleClose(event) {
    if (event.code === 1000 || event.code === 1001) {
      this.destroy();
      return;
    }

    const code = codes[event.code] || 'UNKNOWN_CODE';
    const reason = event.reason || 'Unknown reason';
    const msg = `Websocket Closed: ${reason} (code=${code}).`;

    const err = new Error(msg);
    err.reason = event.reason || '';
    err.code = code;

    this.emit('error', err);
    this.destroy();
  }

  handleDrain() {
    this.bufferSize = 0;
    this.emit('drain');
  }

  _error(err, code) {
    err.code = code || 'UNKNOWN_CODE';
    this.emit('error', err);
  }

  address() {
    return {
      address: this.remoteAddress,
      family: this.remoteFamily,
      port: this.remotePort
    };
  }

  setKeepAlive(enable, delay) {
    return this;
  }

  setNoDelay(enable) {
    return this;
  }

  setTimeout(timeout, callback) {
    return this;
  }

  write(data, enc, callback) {
    if (!this.ws)
      return true;

    if (typeof enc === 'function') {
      callback = enc;
      enc = undefined;
    }

    if (typeof data === 'string')
      data = Buffer.from(data, enc);

    assert(Buffer.isBuffer(data));

    this.bytesWritten += data.length;

    if (callback)
      setImmediate(callback);

    // Browser
    if (typeof this.ws.write !== 'function') {
      this.ws.send(data);
      return true;
    }

    if (this.ws.write(data) === false) {
      this.bufferSize += data.length;
      return false;
    }

    return true;
  }

  end(data, enc) {
    if (data != null)
      this.write(data, enc);

    return this.destroy();
  }

  pause() {
    if (!this.ws)
      return this;

    // Browser
    if (typeof this.ws.pause !== 'function')
      return this;

    this.ws.pause();

    return this;
  }

  resume() {
    if (!this.ws)
      return this;

    // Browser
    if (typeof this.ws.resume !== 'function')
      return this;

    this.ws.resume();

    return this;
  }

  destroy(err) {
    if (!this.ws)
      return this;

    this.ws.onopen = noop;
    this.ws.onmessage = noop;
    this.ws.onerror = noop;
    this.ws.onclose = noop;

    if (typeof this.ws.removeAllListeners === 'function')
      this.ws.removeAllListeners('drain');

    this.ws.close();
    this.ws = null;
    this.destroyed = true;

    if (err)
      this.emit('error', err);

    this.emit('close');

    return this;
  }

  setEncoding(enc) {
    assert(!enc || typeof enc === 'string');
    this.encoding = enc || null;
    return this;
  }

  ref() {
    return this;
  }

  unref() {
    return this;
  }

  static accept(req, socket, ws) {
    return new this().accept(req, socket, ws);
  }

  static connect(port, host, ssl, protocols) {
    return new this().connect(port, host, ssl, protocols);
  }
}

/*
 * Helpers
 */

function readBinary(data) {
  return new Promise((resolve, reject) => {
    if (typeof data === 'string') {
      resolve(data);
      return;
    }

    if (!data || typeof data !== 'object') {
      reject(new Error('Bad data object.'));
      return;
    }

    if (Buffer.isBuffer(data)) {
      resolve(data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      const result = Buffer.from(data);
      resolve(result);
      return;
    }

    if (data.buffer instanceof ArrayBuffer) {
      const result = Buffer.from(data.buffer);
      resolve(result);
      return;
    }

    if (typeof Blob !== 'undefined' && Blob) {
      if (data instanceof Blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = Buffer.from(reader.result);
          resolve(result);
        };
        reader.readAsArrayBuffer(data);
        return;
      }
    }

    reject(new Error('Bad data object.'));
  });
}

/*
 * Expose
 */

module.exports = Socket;
