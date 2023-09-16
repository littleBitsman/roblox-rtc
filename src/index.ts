import { Server, CreateServerOptions } from './server';

function createServer(options: CreateServerOptions) {
    return new Server(options)
}

export = module.exports = {
    Server,
    createServer
}