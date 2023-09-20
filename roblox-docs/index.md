# Roblox Module Docs

## Module Download
[Roblox RTC Module](https://create.roblox.com/marketplace/asset/14549265835/Real-Time-Communications-Module)

## Require
```lua
local rtc = require(script.RTCModule)
```
***OR***
```lua
local rtc = require(14549265835) -- not recommended unless you want less clutter in your explorer, only do AFTER developing your game-server-side script
```

## Functions
***Note that all of these examples assumes that the variable `rtc` is a require statement to the module.***

### Open Connection
```lua
rtc:StartConnection(url: string): nil
```

Start the connection between this Roblox game server and the backend server specified by `url`. The backend should be set up by the npm module `roblox-rtc` for ease of use.

Parameters:
| Name | Type | Description |
|------|------|-------------|
| url | `string` | The url of the server to connect to. |

### Send Data
```lua
rtc:SendData(data: { [string]: any }): nil
```

Send data to the backend server.

Parameters:
| Name | Type | Description |
|------|------|-------------|
| data | `{ [string]: any }` | The data to be sent to the backend server. This should be a *dictionary*, and it is automatically `HTTPService:JSONEncode()`d. |

### Get an event
```lua
rtc.event(eventName: string): RBXScriptSignal
```

Gets an event from the event array.
*Note that the only valid event is `message`. Any other parameters passed will result in a return of `nil`.*

Parameters:
| Name | Type | Description |
|------|------|-------------|
| eventName | `string` | The name of the event to get. |

### Listen to an event
```lua
rtc:on(eventName: string, callback: (...any) -> ()): string
rtc:addEventListener(eventName: string, callback: (...any) -> ()): string
```

Adds `callback` to the listener array for `eventName`.

Parameters:
| Name | Type | Description |
|------|------|-------------|
| eventName | `string` | The name of the event. |
| callback | `(...any) -> ()` | The function that will be called every time event `eventName` is fired. |

### Remove an event listener
```lua
rtc:removeEventListener(eventName: string, listenerKey: string)
```

Removes the listener for `listenerKey` from the listener array for `eventName`.

Parameters:
| Name | Type | Description |
|------|------|-------------|
| eventName | `string` | The name of the event. |
| listenerKey | `string` | The key returned by `rtc:on()` and `rtc:addEventListener()` that specifies the location of the event listener. |

### Listen to an event once
```lua
rtc:once(eventName: string, callback: (...any) -> ()): string
```

Adds `callback` to the listener array for `eventName`. When the event is fired, the `callback` is removed from the array, then invoked.

Parameters:
| Name | Type | Description |
|------|------|-------------|
| eventName | `string` | The name of the event. |
| callback | `(...any) -> ()` | The function that will be called the first time event `eventName` is fired. |

### Stop the connection
```lua
rtc:Stop()
```

Stops the receiving from, and removes the ability to send data to the backend server.
- This function does the following:
- Disables the ability to call `rtc:SendData()`.
- Disconnects the `MessagingService` subscription.
- Deletes the connection on the backend server.
- Enables the ability to call `rtc:StartConnection()` to restart the connection.