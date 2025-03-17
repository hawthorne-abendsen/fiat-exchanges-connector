const PriceData = require('../models/price-data')
const PriceProviderBase = require('./price-provider-base')

const baseApiUrl = 'https://v6.exchangerate-api.com/v6/'

//Rates are updated every 5 minutes, cache the data
const lastRates = new Map()

class ExchangerateApiProvider extends PriceProviderBase {
    constructor(apiKey, secret) {
        super(apiKey, secret)
    }

    name = 'exchangerate'

    async __getTradeData(timestamp, timeout) {
        if (!this.apiKey) {
            throw new Error('API key is required for abstractapi')
        }
        const normalizeTimestamp = PriceProviderBase.normalizeTimestamp(timestamp, 5 * 60 * 1000)
        //check cache
        if (lastRates.has(normalizeTimestamp)) {
            const data = lastRates.get(normalizeTimestamp)
            //clone and update timestamp
            return Object.entries(data).reduce((acc, [symbol, priceData]) => {
                acc[symbol] = new PriceData({
                    price: priceData.price,
                    source: priceData.source,
                    ts: timestamp
                })
                return acc
            }, {})
        }
        const klinesUrl = `${baseApiUrl}/${this.apiKey}/latest/USD`
        const response = await this.__makeRequest(klinesUrl, {timeout})
        if (response?.data?.result !== 'success') {
            throw new Error('Failed to get data from exchangerate')
        }
        const data = Object.keys(response.data.conversion_rates).reduce((acc, symbol) => {
            acc[symbol] = new PriceData({
                price: response.data.conversion_rates[symbol],
                source: this.name,
                ts: timestamp
            })
            acc[symbol].price = PriceProviderBase.calcCrossPrice(acc[symbol].price, 10000000n)
            return acc
        }, {})
        lastRates.clear()
        lastRates.set(normalizeTimestamp, data)
        return data
    }
}

module.exports = ExchangerateApiProvider