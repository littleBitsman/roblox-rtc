local serverUrl = "http://your-url-here.com"

local RTC = require(14549265835) -- docs are somewhere

RTC:StartConnection(serverUrl)

RTC.event("message"):Connect(function(data) { -- data is a dictionary of JSONDecode()'d data that was sent by the backend
    if data.action == "kick" then
        -- example kick logic:
        local player = game.Players:GetPlayerByUserId(data.userId)
        if player then player:Kick(data.reason) end
    elseif data.action == "ban" then
        -- your ban logic here...
    elseif data.action == "unban" then
        -- your unban logic here...
    end
})