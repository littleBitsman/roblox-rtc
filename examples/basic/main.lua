local serverUrl = "http://your-url-here.com"

local RTC = require(14549265835) -- docs are somewhere

RTC:StartConnection(serverUrl)

RTC.event("message"):Connect(function(data) { -- data is a dictionary of JSONDecode()'d data that was sent by the backend
    -- your logic here
})