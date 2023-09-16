# roblox-rtc
A Roblox real-time communication module between a Roblox game server and your own server.

**NOTE: THE PACKAGE IS COMPLETE BUT HAS NOT BEEN TESTED. TESTING WILL BE DONE SOON.**

## Features
- Send a message to a specific server.
- Send a message to a server with a matching JobId (`game.JobId`).
- Send a message to a server with a matching PlaceId (`game.PlaceId`).
- Broadcast a message to all servers.
- Get players in a server.

## Quick Start
Install:
```bash
npm install roblox-rtc
```

Create a server:
```js
const roblox_rtc = require("roblox-rtc")
roblox_rtc.createServer().listen(3000)
```

Create an HTTPS server:
```js
const roblox_rtc = require("roblox-rtc")
const fs = require("fs")
roblox_rtx.createServer({
    key: fs.readFileSync('path/to/key.pem'), // change this to your private key file. It does not have to be a .pem, it can be any file that is editable normally in a 
                                             // editor with UTF8 encoding
    cert: fs.readFileSync('path/to/cert.pem') // same as above, for your certificate file
}).listen(3000, () => {
    console.log('started HTTPS server on port 3000')
})
```