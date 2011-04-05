/**
 * serve files with node.js
 * 
 * npm install connect && node ./server.js
 */

var connect = require('connect');

connect(
  connect.logger(),
  connect.static(__dirname)
).listen(4000);