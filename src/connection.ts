import { EventEmitter } from 'node:events'
import { SessionData } from 'express-session'
import { Server } from './server'
import { randomUUID } from 'node:crypto'

interface ConnectionOpts {
    JobId: string,
    PlaceId: string,
    SessionId: string,
    Server: Server,
    id: string,
    GetSession: (id: string) => SessionData | undefined,
    DataStream: EventEmitter
}

export interface InternalData {
    players: string[]
}

export class Connection {
    private eventStream = new EventEmitter()
    readonly JobId: string
    readonly PlaceId: string
    readonly Server: Server
    private readonly SessionId: string
    readonly id: string
    readonly secret: string = randomUUID().replace('-', '')
    private readonly getSessionData: (id: string) => SessionData | undefined
    private customData: object | undefined = {}
    private Players: string[] = []
    constructor(opts: ConnectionOpts) {
        this.JobId = opts.JobId
        this.PlaceId = opts.PlaceId
        this.SessionId = opts.SessionId
        this.id = opts.id
        this.Server = opts.Server
        this.getSessionData = opts.GetSession
        opts.DataStream.on('data', (data: object) => {
            this.emit('message', data)
        })
        opts.DataStream.on('internalData', (data: InternalData) => {
            this.Players = data.players
        })
        opts.DataStream.on('close', () => {
            this.emit('close')
        })
    }

    /**
     * Get the session data for this Connection.
     */
    get session() {
        return this.getSessionData(this.SessionId)
    }

    get players() { return this.Players }

    /**
     * Get custom data for this Connection. You can set custom data with `connection.setCustomData()`.
     */
    get getCustomData(): object | undefined {
        return this.customData
    }

    /**
     * Set custom data for this Connection. You can get custom data with `connection.getCustomData()`.
     */
    set setCustomData(newData: object | undefined) {
        this.customData = newData
    }

    /**
     * Send data to the server represented by this object. *Note: The* `jobId` *and* `placeId` *are handled for you.*
     * @param data The data to send.
     */
    async send(data: object) {
        return this.Server.send(data, {
            jobId: this.JobId,
            placeId: this.PlaceId
        })
    }

    /**
     * Adds the `listener` function to the end of the listeners array for the event named `event`. No checks are made to see if the `listener` has already been added. Multiple calls passing the same combination of `event` and `listener` will result in the listener being added, and called, multiple times.
     * @param event The name of the event.
     * @param listener The callback function.
     */
    on(event: 'message', listener: (data: Object) => void): this
    on(event: 'close', listener: () => void): this
    on(event: string, listener: (...params: any[]) => void): this {
        this.eventStream.on(event, listener)
        return this
    }

    /**
     * Adds a **one-time** `listener` function for the event named `event`. The next time `event` is triggered, this listener is removed and then invoked.
     * @param event The name of the event.
     * @param listener The callback function.
     */
    once(event: 'message', listener: (data: Object) => void): this
    once(event: 'close', listener: () => void): this 
    once(event: string, listener: (...params: any[]) => void): this {
        this.eventStream.once(event, listener)
        return this
    }

    /**
     * Alias for `connection.on(event, listener)`.
     */
    addListener(event: 'message', listener: (data: Object) => void): this
    addListener(event: 'close', listener: () => void): this 
    addListener(event: string, listener: (...params: any[]) => void): this {
        this.eventStream.addListener(event, listener)
        return this
    }

    /**
     * Removes the specified `listener` from the listener array for the event named `event`. At most, only removes 1 listener from the array.
     */
    removeListener(event: 'message', listener: (data: Object) => void): this
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
        return this.eventStream.emit(event, params)
    }
}