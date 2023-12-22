const server = require('roblox-rtc').createServer({
    universeId: '0', // universe ID
    robloxApiKey: '' // your Roblox API key (from https://create.roblox.com/credentials)
})
// PLEASE NOTE THAT for this to work, you need to implement your own 
// event listening and handling on the game server on your own. 
// An example is provided (main.lua).
async function kickPlayer(user, reason) {
    if (!(typeof user == "number" || typeof user == "string")) throw 'you cant do that!'
    const conn = server.getServerWithPlayer(user)
    conn?.send({
        action: "kick",
        userId: user,
        reason: reason.toString()
    })
}

async function banPlayer(user, reason) {
    if (!(typeof user == "number" || typeof user == "string")) throw 'you cant do that!'
    const conn = server.getServerWithPlayer(user)
    conn?.send({
        action: "ban",
        userId: user,
        reason: reason.toString()
    })
}

async function unbanPlayer(user, reason) {
    if (!(typeof user == "number" || typeof user == "string")) throw 'you cant do that!'
    const conn = server.getServerWithPlayer(user)
    conn?.send({
        action: "unban",
        userId: user,
        reason: reason.toString()
    })
}

server.listen(3000)