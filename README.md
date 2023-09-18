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

Send a message to all servers:
```js
const roblox_rtc = require("roblox-rtc")
const server = roblox_rtc.createServer(...) // replace ... with your options...

server.send({
    // your data here...
}).then(() => {
    // some logic here
}).catch(() => {
    // catch any errors
})

// Or you can do it asynchronously
async function main() {
    await server.send({
        // your data here...
    })
}
```

Send data to all servers that are connected with a specific `game.PlaceId` or the server with the same `game.JobId`:
```js
const roblox_rtc = require("roblox-rtc")
const server = roblox_rtc.createServer({
    // your options here
})

server.send({
    // your data here
}, {
    PlaceId: 0, // replace with your PlaceId
    // JobId: "" // replace this with the server JobId. Also, instead of doing this, you can take a Connection object and directly call send (next example)
})
```

Send a message to a server using a Connection object (and also Connection listening):
```js
const roblox_rtc = require("roblox-rtc")
const server = roblox_rtc.createServer({
    // your options here
})

server.on("connection", (conn) => {
    conn.send({
        // your data here...
    })
})
```