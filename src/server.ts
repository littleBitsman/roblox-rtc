import express from 'express'
import axios from 'axios'
import { EventEmitter } from 'node:events'
import { Connection } from './connection'

interface ServerOptions {
    /**
     * The ID of the **universe** (also known as **game**, contains multiple **places**). Required for functionality.
     */
    universeId: number,
    /**
     * The API key to authenticate with the Roblox OpenCloud API. Required for functionality.
     */
    robloxApiKey: string,
    /**
     * The API key to have game servers use to authenticate with this server.
     */
    serverKey?: string
}

export class Server {
    private app = express()
    private eventStream = new EventEmitter()
    constructor(options: ServerOptions) {
        const universeId = options.universeId
        const key = options.robloxApiKey
        axios.get(`https://develop.roblox.com/v1/universes/${universeId}`).catch(() => {
            throw new Error('Invalid universeId.')
        })
        axios.post(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/RealTimeCommunications-Test`,
            { message: 'none' },
            {
                headers: { 'x-api-key': key, 'Content-Type': 'application/json' }
            }).catch((res) => {
                if (res.response.status == 401) throw new Error('Invalid API key.')
            })
        const app = this.app
        const session = require('express-session')

        app.use(session({
            store: new (require('memorystore')(session))({ ttl: Number.MAX_SAFE_INTEGER }),
            secret: require('node:crypto').randomUUID(),
            cookie: { secure: true },
            resave: false,
            saveUninitialized: false
        }))
        
        app.get('/apikey', async (_, res) => {
            await axios.post(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/RealTimeCommunications-Data`, { message: JSON.stringify({ ApiKey: `` }) }, {
                headers: { 'x-api-key': key, 'Content-Type': 'application/json' }
            })
            res.sendStatus(204)
        })
        app.get('/connect', async (req, res) => {
            const JobId = req.get('Roblox-JobId')
            const PlaceId = req.get('Roblox-PlaceId')
            if (req.get('API-Key') != key) return res.sendStatus(401)
        })
    }

    on(event: 'connection', callback: (connection: Connection) => void) {
        this.eventStream.on(event, callback)
    }

    once(event: 'connection', callback: (connection: Connection) => void) {
        this.eventStream.once(event, callback)
    }

    addListener(event: 'connection', callback: (connection: Connection) => void) {
        this.on(event, callback)
    }

    removeListener(event: 'connection', callback: (connection: Connection) => void) {
        this.eventStream.removeListener(event, callback)
    }

    off(event: 'connection', callback: (connection: Connection) => void) {
        this.removeListener(event, callback)
    }

    private emit(event: 'connection', connection: Connection) {
        this.eventStream.emit(event, connection)
    }
}