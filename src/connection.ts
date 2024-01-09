import { EventEmitter } from 'node:events'
import { Server } from './server'
import { randomUUID } from 'node:crypto'
import { Player } from './player'

interface ConnectionOpts {
    JobId: string,
    PlaceId: string,
    SessionId: string,
    Server: Server,
    id: string,
    DataStream: EventEmitter
}

interface InternalData {
    players: string[]
}

export class Connection {
    private eventStream = new EventEmitter()
    /**
     * The `game.JobId` of the connected Roblox server.
     */
    readonly JobId: string
    /**
     * The `game.PlaceId` of the connected Roblox server.
     */
    readonly PlaceId: string
    /**
     * The `Server` that is managing this connection object.
     */
    readonly Server: Server
    /**
     * The `Server`-assigned ID for this (game) server. Is a numeric string.
     */
    readonly id: string
    /**
     * The `Server`-assigned client secret that is sent to the Roblox game server to add an extra layer of security.
     * This secret is used to HMAC the body of a request to `/servers/:serverId/data` with sha256. 
     * The only clients that know this `secret` are the `Server` and the Roblox game server.
     * All `secret`s are unique between game servers.
     */
    readonly secret: string = randomUUID().replace('-', '')
    private customDataVar: object | string | number | undefined = {}
    private Players: Player[] = []
    /**
     * how
     * @private
     */
    constructor(opts: ConnectionOpts) {
        this.JobId = opts.JobId
        this.PlaceId = opts.PlaceId
        this.id = opts.id
        this.Server = opts.Server
        
        opts.DataStream.on('data', (...data: any[]) => {
            this.emit('message', ...data)
        })
        opts.DataStream.on('internalData', (data: InternalData) => {
            data.players.filter(v => !this.Players.find(p => p.id == v)).forEach(v => this.Players.push(new Player(v)))
            this.Players = this.Players.filter(p => data.players.find(v => p.id == v))
        })
        opts.DataStream.on('close', () => {
            this.emit('close')
        })
    }

    /**
     * Players in the Roblox game server where Luau (Server is this object) `game.JobId == Server.JobId` returns true.
     */
    get players() { return this.Players }

    /**
     * Custom data for this Connection.
     */
    get customData(): typeof this.customDataVar {
        return this.customDataVar
    }

    set customData(newData: typeof this.customDataVar) {
        this.customDataVar = newData
    }

    /**
     * Send data to the server represented by this object. *Note: The* `jobId` *and* `placeId` *are handled for you.*
     * @param {object} data The data to send.
     */
    send(data: object) {
        return this.Server.send(data, {
            jobId: this.JobId,
            placeId: this.PlaceId
        })
    }

    /**
     * Adds the `listener` function to the end of the listeners array for the event named `event`. 
     * No checks are made to see if the `listener` has already been added. 
     * Multiple calls passing the same combination of `event` and `listener` will result in the `listener` being added, and called, multiple times. 
     * @param {string} event The event that the listener function will listen for.
     * @param listener The listener function to add to the listener array.
     * @returns {ThisType} This, so that calls can be chained.
     */
    on(event: 'message', listener: (data: object) => void): this
    on(event: 'close', listener: () => void): this
    on(event: string, listener: (...params: any[]) => void): this {
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
    prependListener(event: 'message', listener: (data: object) => void): this
    prependListener(event: 'close', listener: () => void): this
    prependListener(event: string, listener: (...params: any[]) => void): this {
        this.eventStream.prependListener(event, listener)
        return this
    }

    /**
     * Alias for `Connection.on(event, listener)`.
     */
    addListener(event: 'message', listener: (data: object) => void): this
    addListener(event: 'close', listener: () => void): this 
    addListener(event: string, listener: (...params: any[]) => void): this {
        this.eventStream.addListener(event, listener)
        return this
    }

    /**
     * Adds a **one-time** `listener` function for the event named `event`. The next time `event` is triggered, this listener is removed and *then* invoked.
     * 
     * @param {string} event The event that the listener function will listen for.
     * @param listener The listener function to add to the listener array.
     * @returns {ThisType} This, so that calls can be chained.
     */
    once(event: 'message', listener: (data: object) => void): this
    once(event: 'close', listener: () => void): this 
    once(event: string, listener: (...params: any[]) => void): this {
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
    prependOnceListener(event: 'message', listener: (data: object) => void): this
    prependOnceListener(event: 'close', listener: () => void): this 
    prependOnceListener(event: string, listener: (...params: any[]) => void): this {
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
    removeListener(event: 'message', listener: (data: object) => void): this
    removeListener(event: 'close', listener: () => void): this
    removeListener(event: string, listener: (...params: any[]) => void): this {
        this.eventStream.removeListener(event, listener)
        return this
    }
    
    /**
     * how
     * @private
     */
    private emit(event: 'message' | 'close', ...params: any[]): boolean {
        return this.eventStream.emit(event, ...params)
    }
}