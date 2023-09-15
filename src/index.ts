import { Server, CreateServerOptions } from './server';

function createServer(options: CreateServerOptions) {
    const server = new Server(options)
}

export = module.exports = {
    Server: Server
}