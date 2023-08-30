import express from 'express'
import axios, { AxiosResponse } from 'axios'
import session from 'express-session'
import memorystore from 'memorystore'
import { Collection } from '@discordjs/collection'
const store = memorystore(session)
import crypto from 'node:crypto'
import { Server as httpServer, createServer as createHttpServer } from 'node:http'
import { EventEmitter } from 'node:events'
import { Connection } from './connection'
import { Server as httpsServer, createServer as createHttpsServer } from 'node:https'

function assert(bool?: boolean, message: string = 'assertion failed!'): void | never {
    if (!bool) throw message
}

function stringSafeEqual(a?: string, b?: string) {
    if (!a || !b) return false
    a = a.trim()
    b = b.trim()
    try {
        return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
    } catch {
        return a == b
    }
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

interface ListenOptions {
    /**
     * The port that the Server should listen on. If `httpsPort` is specified, this is ignored. (See below for reasoning)
     * If `key` and `cert` are specified, but `httpsPort` is not, this option is used as the `httpsPort`.
     * 
     * This option is ignored if `httpsPort` is present due to HTTPS being preferred for most operations and being more secure.
     */
    port?: number,
    /**
     * The port that the Server should listen with an HTTPS server on. 
     * If this is specified, `key` and `cert` are required to make the HTTPS server have a valid certificate present on requests to the server.
     * No checks are made to make sure that `key` and `cert` are valid.
     */
    httpsPort?: number
    /**
     * Private keys in PEM format. PEM allows the option of private keys being encrypted. 
     * Encrypted keys will be decrypted with `options.passphrase`. 
     * Multiple keys using different algorithms can be provided either as an array of unencrypted key strings or buffers, 
     * or an array of objects in the form {pem: <string|buffer>[, passphrase: ]}. The object form can only occur in an array. 
     * No checks are made to make sure that this key is valid.
     */
    key?: string | Buffer | (string | Buffer)[],
    /**
     * Cert chains in PEM format. One cert chain should be provided per private key. 
     * Each cert chain should consist of the PEM formatted certificate for a provided private key, followed by the PEM formatted intermediate certificates (if any), in order, and not including the root CA (the root CA must be pre-known to the peer, see ca). When providing multiple cert chains, they do not have to be in the same order as their private keys in key. If the intermediate certificates are not provided, the peer will not be able to validate the certificate, and the handshake will fail.
     * No checks are made to make sure that this cert is valid.
     */
    cert?: string | Buffer | (string | Buffer)[],
    /**
     * Shared passphrase used for a single private key and/or a PFX.
     */
    passphrase?: string
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
    private readonly app = express()
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
        if (!options.serverKey) options.serverKey = makeKey(64)
        const serverKey = options.serverKey.trim()

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
        }), express.json())

        this.app.get('/apikey', async (_, res) => {
            await axios.post(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/RealTimeCommunicationsData`, { message: JSON.stringify({ ApiKey: serverKey }) }, {
                headers: { 'x-api-key': key, 'Content-Type': 'application/json' }
            })
            res.status(200).send()
        })
        this.app.post('/connect', async (req, res) => {
            if (req.get('API-Key')?.trim() != serverKey) return res.sendStatus(401)
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
            req.session['JobId'] = JobId
            req.session['PlaceId'] = PlaceId
            req.session['ServerId'] = conn.id
            this.Connections.set(JobId, conn)
            this.Streams.set(JobId, stream)
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
            res.sendStatus(204)
        })
        this.app.post('/servers/:serverId/data', (req, res) => {
            const __a = this.validateRequest(req)
            if (__a != true) return res.sendStatus(__a)
            const serverId = req.params.serverId
            const connection = this.Connections.find((v) => v.id == serverId)
            if (!connection) return res.sendStatus(404)
            this.Streams.find((_, k) => k == connection.JobId)!.emit('data', req.body.data)
            res.sendStatus(204)
        })
        this.app.post('/servers/:serverId/close', (req, res) => {
            const __a = this.validateRequest(req)
            if (__a != true) return res.sendStatus(__a)
            const serverId = req.params.serverId
            const connection = this.Connections.find((v) => v.id == serverId)
            if (!connection) return res.sendStatus(404)
            this.Streams.find((_, k) => k == connection.JobId)!.emit('close')
            this.Connections.delete(connection.JobId)
            res.sendStatus(204)
        })

    }

    private validateRequest(req: express.Request) {
        if (!stringSafeEqual(req.get('API-Key'), this.serverApiKey)) return 401

        const conn = this.Connections.find((conn) => conn.id == req.params['serverId'])
        if (!conn) return 404

        if (req.body) {
            if (!req.get('data-signature')) return 401
            const headerHash = req.get('data-signature')!.split('=')[1]!
            const calcHash = crypto.createHmac('sha256', calculateHmacKey(conn)!).update(JSON.stringify(req.body)).digest()
            if (!crypto.timingSafeEqual(Buffer.from(headerHash, 'hex'), calcHash)) return 401
        }

        if (!stringSafeEqual(req.get('Roblox-JobId'), conn.JobId) || !stringSafeEqual(req.get('Roblox-JobId'), req.session['JobId'])) return 401
        if (!stringSafeEqual(req.get('Roblox-PlaceId'), conn.PlaceId) || !stringSafeEqual(req.get('Roblox-PlaceId'), req.session['PlaceId'])) return 401
        if (req.session['ServerId'] != conn.id) return 401

        return true
    }

    /**
     * Adds the `listener` function to the end of the listeners array for the event named `event`. 
     * No checks are made to see if the `listener` has already been added. 
     * Multiple calls passing the same combination of `event` and `listener` will result in the `listener` being added, and called, multiple times. 
     * @param {string} event The event that the listener function will listen for.
     * @param listener The listener function to add to the listener array.
     * @returns {ThisType} This, so that calls can be chained.
     */
    on(event: 'connection', listener: (connection: Connection) => void): this {
        this.eventStream.on(event, listener)
        return this
    }

    /**
     * Adds the `listener` function to the *beginning* of the listeners array for the event named `event`. 
     * No checks are made to see if the `listener` has already been added. 
     * Multiple calls passing the same combination of `event` and `listener` will result in the `listener` being added, and called, multiple times. 
     * @param {string} event The event that the listener function will listen for.
     * @param listener The listener function to add to the listener array.
     * @returns {ThisType} This, so that calls can be chained.
     */
    prependListener(event: 'connection', listener: (connection: Connection) => void): this {
        this.eventStream.prependListener(event, listener)
        return this
    }

    /** 
     * Alias for `Server.on()`.
    */
    addListener(event: 'connection', listener: (connection: Connection) => void): this {
        return this.on(event, listener)
    }

    /**
     * Adds a **one-time** `listener` function for the event named `event`. The next time `event` is triggered, this listener is removed and *then* invoked.
     * 
     * @param {string} event The event that the listener function will listen for.
     * @param listener The listener function to add to the listener array.
     * @returns {ThisType} This, so that calls can be chained.
     */
    once(event: 'connection', listener: (connection: Connection) => void): this {
        this.eventStream.once(event, listener)
        return this
    }

    /**
     * Adds a **one-time** `listener` function for the event named `event` to the *beginning* of the listeners array. The next time `event` is triggered, this listener is removed and *then* invoked.
     * 
     * @param {string} event The event that the listener function will listen for.
     * @param listener The listener function to add to the listener array.
     * @returns {ThisType} This, so that calls can be chained.
     */
    prependOnceListener(event: 'connection', listener: (connection: Connection) => void): this {
        this.eventStream.prependOnceListener(event, listener)
        return this
    }

    /**
     * Removes the specified `listener` from the listener array for the event named `event`.
     * 
     * At most, `removeListener` will remove **one** instance of `listener` from the listener array. 
     * If any single listener has been added multiple times to the listener array for the specified `event`, then `removeListener()` must be called multiple times to remove each instance.
     * @param {string} event The event that the `listener` is listening for.
     * @param listener The listener function to be removed.
     * @returns {ThisType} This, so that calls can be chained.
     */
    removeListener(event: 'connection', listener: (connection: Connection) => void): this {
        this.eventStream.removeListener(event, listener)
        return this
    }

    /**
     * Alias for `Server.removeListener()`.
     */
    off(event: 'connection', listener: (connection: Connection) => void): this {
        return this.removeListener(event, listener)
    }

    private emit(event: 'connection', connection: Connection) {
        this.eventStream.emit(event, connection)
    }

    /**
     * Sends `data` to Roblox game servers via Roblox OpenCloud Messaging Service. 
     * @async
     * @param {object} data The data to send with the request. *`JSON.stringify()` is executed on this automatically, so there is no need to run it yourself.*
     * Note that if your data object has a `ApiKey` value, the `ApiKey` will be **deleted**.
     * A `timestamp` value is added automatically.
     * @param {DataSendOptions | undefined} options The options for the request. Note that if you do not specify any options, the data will be sent to ALL game servers.
     * 
     * Options:
     * @param {string | undefined} options.jobId Adds a filter to the request to Roblox such that only the game server where `game.JobId == jobId` will get the message.
     * @param {string | undefined} options.placeId Adds a filter to the request to Roblox such that only game servers where `game.PlaceId == placeId` will get the message. 
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

    /**
     * Alias for `Server.getServerByJobId()`.
     */
    getServer(JobId: string): Connection | undefined {
        return this.getServerByJobId(JobId)
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
     * Get the server with the player (where `player.UserId == userId`) in it.
     
     * *Note: If the player is not in a server with the Roblox RTC module running in it, this will return undefined.*
     * @param {string | number} userId The userId of the player to search for
     * @returns The server with the player in it, or undefined if it could not be found. (See note above for more info)
     */
    getServerWithPlayer(userId: string | number): Connection | undefined | never {
        const searchFor = userId.toString()
        if (isNaN(Number.parseFloat(searchFor))) throw 'Provide a valid numeric value or string as the userId.'
        axios.get(`https://users.roblox.com/v1/users/${searchFor}`).catch((reason) => {
            if (reason.response.status == 404) throw 'Invalid userId.'
        })
        return this.Connections.find((conn) => conn.players.find((id) => searchFor == id))
    }

    /**
     * Get a server by its JobId (`game.JobId` Roblox equivalent)
     * @param {string} JobId The JobId to look for.
     * @returns {Connection | undefined} A server connection, or undefined if it does not exist.
     */
    getServerByJobId(JobId: string): Connection | undefined {
        return this.Connections.get(JobId)
    }

    /**
     * Get a server by its assigned ID. *The ID is assigned when the server POSTs to `localhost/connect`.*
     * @param {string | number | symbol} id The assigned ID of the server.
     * @returns {Connection | undefined} A server connection, or undefined if it does not exist.
     */
    getServerById(id: string | number | symbol): Connection | undefined {
        return this.Connections.find((conn) => conn.id == id.toString())
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
     * Or
     * ```js
     * const fs = require('fs')
     * const { Server } = require('roblox-rtc')
     * const server = new Server({
     *     // your options here...
     * })
     * server.listen({
     *     httpsPort: 443,
     *     key: fs.readFileSync('path/to/key.pem', 'utf8'),
     *     cert: fs.readFileSync('path/to/cert.pem', 'utf8')
     * })
     * ```
     * If you want to make an HTTP and HTTPS server, you can do so with `Server.listen(options)`.
     * 
     * Overloads:
     * 
     * 
     * @returns {httpServer | httpsServer} A httpServer or httpsServer. An httpsServer is only returns when you use options and not only a port.
     */
    listen(port: number): httpServer
    listen(port: number, callback: () => void): httpServer
    listen(options: ListenOptions, callback: () => void): httpServer | httpsServer
    listen(opts: number | ListenOptions, callback?: () => void): httpServer | httpsServer {
        if (typeof opts == 'object') {
            if (opts.httpsPort) {
                return createHttpsServer({
                    key: opts.key,
                    cert: opts.cert,
                }, this.app).listen(opts.httpsPort, callback)
            } else if (opts.key && opts.cert) {
                return createHttpsServer({
                    key: opts.key,
                    cert: opts.cert
                }, this.app).listen(opts.port || opts.httpsPort, callback)
            } else return this.app.listen(opts.port, callback)
        } else return this.app.listen(opts, callback)
    }
}