import { Server } from "./server";

export = {
    function() {
        return new Server()
    },
    Server: Server
}