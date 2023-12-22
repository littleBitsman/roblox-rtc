const server = require('roblox-rtc').createServer({
    universeId: '0', // universe ID
    robloxApiKey: '' // your Roblox API key (from https://create.roblox.com/credentials)
})
// PLEASE NOTE THAT for this to work, you need to implement your own 
// event listening and handling on the game server on your own. 
// An example is provided (main.lua).

// Basic echo server
server.on('connection', (conn) => {
    console.log("a")
    conn.on('message', (data) => {
        conn.send(data)
        console.log(data)
    })
})

server.listen(3000)