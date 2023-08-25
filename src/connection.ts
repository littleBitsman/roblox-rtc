import { Express } from 'express'
import { EventEmitter } from 'node:events'

interface ConnectionOpts {
    JobId: string,
    PlaceId: number,
    SessionId: string,
    SessionStore: Express.SessionStore
}

export class Connection {
    private eventStream = new EventEmitter()
    readonly JobId: string
    readonly PlaceId: number
    private readonly SessionId: string
    private readonly SessionStore: Express.SessionStore
    constructor(opts: ConnectionOpts) {
        this.JobId = opts.JobId
        this.PlaceId = opts.PlaceId
        this.SessionId = opts.SessionId
        this.SessionStore = opts.SessionStore
    }

    get session() {
        var a
        this.SessionStore.get(this.SessionId, (_, session) => {
            a = session
        })
        return a
    }
}