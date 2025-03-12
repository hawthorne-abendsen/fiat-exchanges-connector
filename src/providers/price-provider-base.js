/*eslint-disable class-methods-use-this */
const https = require('https')
const http = require('http')
const {default: axios} = require('axios')

const defaultAgentOptions = {keepAlive: true, maxSockets: 50, noDelay: true}

const requestedUrls = new Map()

const httpAgent = new http.Agent(defaultAgentOptions)
axios.defaults.httpAgent = httpAgent

const httpsAgent = new https.Agent(defaultAgentOptions)
axios.defaults.httpsAgent = httpsAgent

function getRotatedIndex(index, length) {
    return (index + 1) % length
}

class PriceProviderBase {
    constructor(apiKey, secret) {
        if (this.constructor === PriceProviderBase)
            throw new Error('PriceProviderBase is an abstract class and cannot be instantiated')
        this.apiKey = apiKey
        this.secret = secret
    }

    static normalizeTimestamp(timestamp, timeframe) {
        return Math.floor(timestamp / timeframe) * timeframe
    }

    static setGateway(gatewayConnectionSting, validationKey, useCurrentProvider) {
        if (!gatewayConnectionSting) {
            PriceProviderBase.gatewayUrls = null
            PriceProviderBase.validationKey = null
            return
        }

        if (!Array.isArray(gatewayConnectionSting))
            gatewayConnectionSting = [gatewayConnectionSting]

        const proxies = gatewayConnectionSting

        if (proxies.length === 0) {
            PriceProviderBase.gatewayUrls = null
            PriceProviderBase.validationKey = null
            return
        }

        if (useCurrentProvider) //add current server
            proxies.unshift(undefined)

        PriceProviderBase.gatewayUrls = proxies
        PriceProviderBase.validationKey = validationKey
    }

    static getGatewayUrl(url) {
        if (!PriceProviderBase.gatewayUrls) //no proxies
            return undefined

        if (PriceProviderBase.gatewayUrls.length === 1) //single gateway, no need to rotate
            return PriceProviderBase.gatewayUrls[0]

        const host = new URL(url).host
        if (!requestedUrls.has(host)) {//first request to the host. Assign first gateway
            requestedUrls.set(host, 0)
            return PriceProviderBase.gatewayUrls[0]
        }
        const index = requestedUrls.get(host)
        const newIndex = getRotatedIndex(index, PriceProviderBase.gatewayUrls.length)
        requestedUrls.set(host, newIndex)
        return PriceProviderBase.gatewayUrls[newIndex]
    }

    static calcCrossPrice(basePrice, price) {
        return (price * (10n ** BigInt(7))) / basePrice
    }

    static deleteRequestedUrl(url) {
        requestedUrls.delete(url)
    }

    /**
     * @type {string}
     * @readonly
     */
    base = ''

    /**
     * @type {string}
     * @readonly
     */
    name = ''

    /**
     * @type {string}
     * @protected
     */

    apiKey
    /**
     * @type {string}
     * @protected
     */
    secret

    /**
     *
     * @param {number} timestamp - timestamp in seconds
     * @param {number} [timeout] - request timeout in milliseconds. Default is 3000ms
     * @returns {Promise<Object.<string, PriceData>[]|null>} Returns PriceData array for current timestamp
     */
    getTradesData(timestamp, timeout = 3000) {
        if (typeof timestamp !== 'number' || timestamp <= 0)
            throw new Error('Invalid timestamp')
        return this.__getTradeData(timestamp, timeout)
    }

    /**
     * @param {number} timestamp
     * @param {number} timeout
     * @returns {Promise<Object.<string, PriceData>[]|null>}
     * @abstract
     * @protected
     */
    __getTradeData(timestamp, timeout) {
        throw new Error('Not implemented')
    }

    /**
     * @param {string} url - request url
     * @param {any} [options] - request options
     * @returns {Promise<any>}
     * @protected
     */
    async __makeRequest(url, options = {}) {
        const gatewayUrl = PriceProviderBase.getGatewayUrl(url)
        if (gatewayUrl) {
            url = `${gatewayUrl}/gateway?url=${encodeURIComponent(url)}`
            //add validation key
            if (!options)
                options = {}
            options.headers = {
                ...options.headers,
                'x-gateway-validation': PriceProviderBase.validationKey
            }
        }
        const requestOptions = {
            ...options,
            url
        }
        try {
            const start = Date.now()
            const response = await axios.request(requestOptions)
            const time = Date.now() - start
            PriceProviderBase.deleteRequestedUrl(url)
            if (time > 1000)
                console.debug(`Request to ${url} took ${time}ms. Gateway: ${gatewayUrl ? gatewayUrl : 'no'}`)
            return response
        } catch (err) {
            console.error(`Request to ${url} failed: ${err.message}. Gateway: ${gatewayUrl ? gatewayUrl : 'no'}`)
            return null
        }
    }
}

module.exports = PriceProviderBase