export class InvalidUniverseIdError extends Error {
    constructor() {
        super('Invalid Universe ID.')
    }
}
export class InvalidApiKeyError extends Error {
    constructor() {
        super('Invalid API key.')
    }
}
export class ApiKeyPermissionsError extends Error {
    constructor(universeId: string) {
        super(`This API key does not have permission to publish to Messaging Service on universe ${universeId}.`)
    }
}

import { STATUS_CODES } from 'node:http'
export class RobloxServerError extends Error {
    constructor(errorCode: number) {
        if (errorCode < 500 || errorCode > 600) throw new RangeError()
        super(`The Roblox server responded with HTTP ${errorCode}: ${STATUS_CODES[errorCode]}`)
    }
}