import axios from 'axios'

export const PlayerCache = new Map<string, InternalPlayer>()

interface InternalPlayer {
    id: string,
    name?: string,
    displayName?: string,
    created?: Date,
    description?: string,
    isBanned?: boolean,
    isPartial: boolean
}

type ID = string | number | symbol

export class Player {
    private _id: string
    private selfData?: InternalPlayer
    /**
     * how
     * @private
     */
    constructor(id: ID) {
        this._id = id.toString()
        if (!PlayerCache.has(id.toString())) PlayerCache.set(id.toString(), { id: id.toString(), isPartial: true })
    }

    private get data(): InternalPlayer {
        if (!this.selfData) 
            this.selfData = PlayerCache.get(this.id)!

        return this.selfData
    }
    /**
     * The player's user ID.
     */
    get id(): string {
        return this._id
    }

    /**
     * The username of the Roblox player associated with user ID `this.id`.
     * 
     * **Note**: *Display names* and *usernames* are ***different***. Display names are the name that is displayed on the profile page, 
     * in game leaderboards (the one showing every player in your game server), and in in-game chat messages. You can get a formatted version of the player's name and 
     * display name combined at `Player.getFormattedName()` that will look like `DisplayName (@UserName)` if the display name and usernames are unique, or just `@UserName`
     * if not.
     * @returns {string | undefined} The player's display name, or undefined if the data was not `fetch()`'d.
     */
    get name(): string | undefined {
        return this.data.name
    }

    /**
     * The display name of the Roblox player associated with user ID `this.id`.
     * 
     * **Note**: *Display names* and *usernames* are ***different***. Display names are the name that is displayed on the profile page, 
     * in game leaderboards (the one showing every player in your game server), and in in-game chat messages. You can get a formatted version of the player's name and 
     * display name combined at `Player.formattedName` that will look like `DisplayName (@Username)` if the display name and usernames are unique, or just `@Username`
     * if not.
     * @returns {string | undefined} The player's display name, or undefined if the data was not `fetch()`'d.
     */
    get displayName(): string | undefined {
        return this.data.displayName
    }

    /**
     * The Date when the Roblox player associated with user ID `this.id` was created.
     * @returns {Date | undefined} A Date defining when this player was created, or undefined if the data was not `fetch()`'d.
     */
    get created(): Date | undefined {
        return this.data.created
    }

    /**
     * The description text of the player on their profile page.
     * @returns {string | undefined} The description text of this player on their profile page, or undefined if the data was not `fetch()`'d.
     */
    get description(): string | undefined {
        return this.data.description
    }

    /**
     * A boolean that shows if the Roblox player associated with the user ID `this.id` is banned (terminated) or not.
     * @returns {boolean | undefined} A boolean defining if this player is banned, or undefined if the data was not `fetch()`'d.
     */
    get isBanned(): boolean | undefined {
        return this.data.isBanned
    }
    
    /**
     * A boolean defining whether this `Player` object has all the properties available.
     * Set to `false` after `Player.fetch()` is called successfully.
     */
    get isPartial() {
        return this.data.isPartial
    }

    /**
     * The formatted name of the player. If the player data has not been `Player.fetch()`'d, `undefined` will be returned. The return string is formatted as follows 
     * (where `DisplayName` is replaced by `this.displayName` and `Username` is replaced by `this.name`):
     * - Unique display name and username: `DisplayName (@Username)`
     * - Display name and username are the same: `@Username`
     * @returns {string | undefined} The formatted name of the player, or undefined if the data was not `fetch()`'d.
     */
    get formattedName(): string | undefined {
        if (!this.name || !this.displayName) return
        else if (this.name == this.displayName) return `@${this.name}`
        else return `${this.displayName} (@${this.name})`
    }

    /**
     * Fetches all player data by `id` from the Roblox Users API.
     * @async
     */
    async fetch(): Promise<this> {
        const res = await axios.get(`https://users.roblox.com/v1/users/${this.id}`)
        const data = res.data
        this.data.created = new Date(data.created)
        this.data.description = data.description
        this.data.isBanned = data.isBanned
        this.data.displayName = data.displayName
        this.data.name = data.name

        this.data.isPartial = !!(this.data.created && this.data.description && this.data.isBanned && this.data.displayName && this.data.name)
        return this
    }

    static get(id: ID): Player {
        return getPlayer(id)
    }
    static new(id: ID): Player {
        return getPlayer(id)
    }
}

export function getPlayer(id: ID): Player {
    return new Player(id.toString())
}