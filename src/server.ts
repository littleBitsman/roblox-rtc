import express from 'express'
import axios, { AxiosResponse } from 'axios'
import session from 'express-session'
import memorystore from 'memorystore'
import { Collection } from '@discordjs/collection'
const store = memorystore(session)
import crypto from 'node:crypto'
import { Server as httpServer } from 'node:http'
import { EventEmitter } from 'node:events'
import { Connection } from './connection'

function assert(bool?: boolean, message: string = 'assertion failed!'): void | never {
    if (!bool) throw message
}

function stringSafeEqual(a: string, b: string) {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function calculateHmacKey(connection: Connection) {
    return `${connection.secret}-${connection.PlaceId}-${connection.JobId}`
}

function isValidJsonString(obj?: any): boolean {
    if (!obj) return false
    if (typeof obj != 'string') return false
    try {
        JSON.parse(obj)
        return true
    } catch {
        return false
    }
}

interface ServerOptions {
    /**
     * The ID of the **universe** (also known as **game**, contains multiple **places**). Required for functionality.
     */
    universeId: string,
    /**
     * The API key to authenticate with the Roblox OpenCloud API. Required for functionality.
     */
    robloxApiKey: string,
    /**
     * The API key to have game servers use to authenticate with this server. If it is not specified, a random 64-character key will be generated pseudorandomly.
     */
    serverKey?: string
}

interface DataSendOptions {
    /**
     * Adds a filter to the request to Roblox such that only the server with this `placeId` will get the message. 
     * *WARNING: If you specify the wrong place ID and you specify a job ID, the message may not be received by the server. The logic on the Roblox game server side checks BOTH place ID (if the filter exists) and job ID (if the filter exists).*
     */
    placeId?: string,
    /**
     * Adds a filter to the request to Roblox such that only the server with this `jobId` will get the message.
     */
    jobId?: string
}

function makeKey(length: number = 16) {
    var result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export class Server {
    readonly app = express()
    private eventStream = new EventEmitter()
    private readonly Connections: Collection<string, Connection> = new Collection()
    private readonly Streams: Collection<string, EventEmitter> = new Collection()
    private readonly universeId: string
    private readonly robloxApiKey: string
    private readonly serverApiKey: string
    private readonly sessionStore: session.MemoryStore
    constructor(options: ServerOptions) {
        const universeId = options.universeId
        const key = options.robloxApiKey
        console.log(key)
        if (!options.serverKey) options.serverKey = makeKey(64)
        const serverKey = options.serverKey

        this.universeId = universeId
        this.robloxApiKey = key
        this.serverApiKey = serverKey

        axios.get(`https://develop.roblox.com/v1/universes/${universeId}`).catch(() => {
            throw 'Invalid universeId.'
        })
        axios.post(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/RealTimeCommunicationsTest`,
            { message: 'none' },
            { headers: { 'x-api-key': key, 'Content-Type': 'application/json' } })
            .catch((res) => {
                if (res.response.status == 401) throw 'Invalid API key.'
                if (res.response.status == 403) throw `This API key does not have permissions to publish to Messaging Service on universe ${universeId}.`
            })
        this.sessionStore = new store({ ttl: Number.MAX_SAFE_INTEGER })
        this.app.use(session({
            store: this.sessionStore,
            secret: crypto.randomUUID(),
            cookie: { secure: false },
            resave: false,
            saveUninitialized: false
        }))

        this.app.get('/apikey', async (_, res) => {
            await axios.post(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/RealTimeCommunicationsData`, { message: JSON.stringify({ ApiKey: serverKey }) }, {
                headers: { 'x-api-key': key, 'Content-Type': 'application/json' }
            })
            res.status(200).send()
        })
        this.app.get('/connect', async (req, res) => {
            console.log(req.get('API-Key'))
            if (req.get('API-Key') != key) return res.sendStatus(401)
            const JobId = req.get('Roblox-JobId')
            if (!JobId) return res.sendStatus(400)
            if (this.Connections.has(JobId)) return res.status(403).json({
                'error-code': 403,
                error: 'This server (that made this request) has already requested a connection previously and has not closed it.'
            })

            const PlaceId = req.get('Roblox-PlaceId')
            if (!PlaceId) return res.sendStatus(400)
            const stream = new EventEmitter()
            const conn = new Connection({
                JobId: JobId,
                PlaceId: PlaceId,
                SessionId: req.sessionID,
                Server: this,
                id: this.Connections.size.toString(),
                GetSession: (id) => {
                    var a
                    this.sessionStore.get(id, (_, b) => {
                        a = b
                    })
                    return a
                },
                DataStream: stream
            })
            this.Connections.set(JobId, conn)
            this.emit('connection', conn)
            res.status(200).json({
                secret: conn.secret,
                id: conn.id
            })
        })
        this.app.post('/servers/:serverId/internalData', (req, res) => {
            const __a = this.validateRequest(req)
            if (__a != true) return res.sendStatus(__a)
            if (!req.get('data-type') || req.get('data-type') != 'internal') return res.sendStatus(400)
            const serverId = req.params.serverId
            const connection = this.Connections.find((v) => v.id == serverId)
            if (!connection) return res.sendStatus(404)
            this.Streams.find((_, k) => k == connection.JobId)!.emit('internalData', req.body.data)
        })
        this.app.post('/servers/:serverId/data', (req, res) => {
            const __a = this.validateRequest(req)
            if (__a != true) return res.sendStatus(__a)
            const serverId = req.params.serverId
            const connection = this.Connections.find((v) => v.id == serverId)
            if (!connection) return res.sendStatus(404)
            this.Streams.find((_, k) => k == connection.JobId)!.emit('data', req.body.data)
        })
        this.app.post('/servers/:serverId/close', (req, res) => {
            const __a = this.validateRequest(req)
            if (__a != true) return res.sendStatus(__a)
        })
    }

    private validateRequest(req: express.Request) {
        if (!stringSafeEqual(req.get('API-Key')!, this.serverApiKey)) return 401

        const conn = this.Connections.find((conn) => conn.id == req.params['serverId'])
        if (!conn) return 404

        if (req.body) {
            if (!req.get('data-signature')) return 401
            const headerHash = req.get('data-signature')!.split('=')[1]!
            const calcHash = crypto.createHmac('sha256', calculateHmacKey(conn)!).update(JSON.stringify(req.body)).digest()
            if (!crypto.timingSafeEqual(Buffer.from(headerHash, 'hex'), calcHash)) return 401
        }

        if (!stringSafeEqual(req.get('Roblox-JobId')!, conn.JobId)) return 401
        if (!stringSafeEqual(req.get('Roblox-PlaceId')!, conn.PlaceId)) return 401

        return true
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

    /**
     * Sends `data` to Roblox game servers via Roblox OpenCloud Messaging Service. 
     * @async
     * @param data The data to send with the request. `JSON.stringify()` is executed on this automatically, so there is no need to run it yourself.
     * Note that if your data object has a `ApiKey` value, the `ApiKey` will be **deleted**.
     * A `timestamp` value is added automatically.
     * @param options The options for the request. Note that if you do not specify any options, the data will be sent to ALL game servers.
     * 
     * Options:
     * @param options.jobId Adds a filter to the request to Roblox such that only the game server where `game.JobId == jobId` will get the message.
     * @param options.placeId Adds a filter to the request to Roblox such that only game servers where `game.PlaceId == placeId` will get the message. 
     * *WARNING: If you specify the wrong place ID and you specify a job ID, the message may not be received by the server you intended. The logic on the Roblox game server side checks BOTH place ID (if the filter exists) and job ID (if the filter exists).*
     */
    async send(data: any, options?: DataSendOptions) {
        if (isValidJsonString(data)) data = JSON.parse(data)
        if (data['ApiKey']) delete data.ApiKey
        const json = { data: data }
        if (options) {
            if (options.jobId) json['ServerJobId'] = options.jobId
            if (options.placeId) json['ServerPlaceId'] = options.placeId
        }

        const response = await this.sendData(JSON.stringify(json))
        if (response.status == 401) throw 'Invalid API key or the API key does not have the required permissions to publish to Messaging Service.'
        if (response.status == 403) throw 'Publishing to Messaging Service is not allowed on this universe/experience.'
        if (response.status == 500) throw 'The Roblox server had an internal error.'
    }

    getConnection(JobId: string): Connection | undefined {
        return this.Connections.get(JobId)
    }

    private async sendData(data: string): Promise<AxiosResponse> {
        return await new Promise((resolve) => {
            axios.post(`https://apis.roblox.com/messaging-service/v1/universes/${this.universeId}/topics/RealTimeCommunicationsData`,
                { message: data },
                { headers: { 'x-api-key': this.robloxApiKey, 'Content-Type': 'application/json' } })
            .then((res) => {
                resolve(res)
            })
            .catch((err) => {
                resolve(err.response)
            })
        })
    }

    /**
     * Start listening for conections on port `port`.
     * ```js
     * const { Server } = require('roblox-rtc')
     * const server = new Server({
     *     // your options here...
     * })
     * server.listen(3000) // replace 3000 with your port of choice
     * ```
     * If you want to make an HTTP and HTTPS server, you can do so with `https.createServer({...}, server.app).listen(443)`.
     * @param port The port to listen on. Defaults to port 3000.
     */
    listen(port: number): httpServer
    listen(port: number, callback: () => void): httpServer
    listen(port: number = 3000, callback?: () => void): httpServer {
        return this.app.listen(port, callback)
    }
}