import axios from 'axios'
export class Player {
    private _id: string
    private _isPartial: boolean = true
    private _name?: string
    private _displayName?: string
    private _created?: Date
    private _description?: string
    private _isBanned?: boolean
    /**
     * how
     * @private
     */
    constructor(id: string | number | symbol) {
        this._id = id.toString()
    }
    /**
     * The player's user ID.
     */
    get id() {
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
        return this._name
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
        return this._displayName
    }
    /**
     * The Date when the Roblox player associated with user ID `this.id` was created.
     * @returns {Date | undefined} A Date defining when this player was created, or undefined if the data was not `fetch()`'d.
     */
    get created(): Date | undefined {
        return this._created
    }
    /**
     * The description text of the player on their profile page.
     * @returns {string | undefined} The description text of this player on their profile page, or undefined if the data was not `fetch()`'d.
     */
    get description(): string | undefined {
        return this._description
    }
    /**
     * A boolean that shows if the Roblox player associated with the user ID `this.id` is banned (terminated) or not.
     * @returns {boolean | undefined} A boolean defining if this player is banned, or undefined if the data was not `fetch()`'d.
     */
    get isBanned(): boolean | undefined {
        return this._isBanned
    }
    /**
     * A boolean defining whether this `Player` object has all the properties available.
     * Set to `false` after `Player.fetch()` is called successfully.
     */
    get isPartial() {
        return this._isPartial
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
        this._created = new Date(data.created)
        this._description = data.description
        this._isBanned = data.isBanned
        this._displayName = data.displayName
        this._name = data.name

        this._isPartial = !!(this._created && this._description && this._isBanned && this._displayName && this._name)
        return this
    }
}
