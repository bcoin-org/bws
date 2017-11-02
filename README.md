# bws

Wrap websockets to make them look like node.js tcp sockets.

## Usage

``` js
const net = require('bws');

const server = net.createServer();
server.on('connect', (socket) => {
  socket.setEncoding('utf8');
  socket.on('data', (data) => {
    console.log(data);
  });
});
server.listen(8080);

const socket = net.connect(8080, '127.0.0.1');
socket.on('connect', () => {
  socket.write('hello', 'utf8');
});
```

## Contribution and License Agreement

If you contribute code to this project, you are implicitly allowing your code
to be distributed under the MIT license. You are also implicitly verifying that
all code is your original work. `</legalese>`

## License

- Copyright (c) 2017, Christopher Jeffrey (MIT License).

See LICENSE for more info.
