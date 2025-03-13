const PriceData = require('../models/price-data')
const PriceProviderBase = require('./price-provider-base')

function getStartPeriod() {
    const startPeriod = new Date()
    startPeriod.setDate(new Date().getDate() - 14)
    return startPeriod.toISOString().split('T')[0] //current date - 14 days
}

//ECB takes long time to respond, cache the data
const ecbRates = new Map()

//Europe Central Bank
class ECBPriceProvider extends PriceProviderBase {
    constructor(apiKey, secret) {
        super(apiKey, secret)
    }

    name = 'ecb'

    async __getTradeData(timestamp, timeout) {
        const startPeriod = getStartPeriod()
        //check cache
        if (ecbRates.has(startPeriod)) {
            const data = ecbRates.get(startPeriod)
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
        const url = `https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?format=jsondata&detail=dataonly&lastNObservations=1&includeHistory=false&startPeriod=${startPeriod}`
        const response = await this.__makeRequest(url, {timeout})
        if (!response)
            throw new Error('Failed to get data from ecb')
        const {data} = response
        const currencies = data?.structure?.dimensions?.series?.find(s => s.id === 'CURRENCY')?.values
        if (!currencies)
            throw new Error('Failed to get data from ecb')
        const prices = data?.dataSets?.[0]?.series
        if (!prices)
            throw new Error('Failed to get data from ecb')
        const priceData = {}
        for (let i = 0; i < currencies.length; i++) {
            const currency = currencies[i]
            priceData[currency.id] = new PriceData({
                price: prices[`0:${i}:0:0:0`]?.observations[0]?.[0] ?? 0,
                source: this.name,
                ts: timestamp
            })
        }
        if (!priceData.USD)
            throw new Error('USD rate not found')

        const usdPrice = priceData.USD.price
        delete priceData.USD //remove USD rate
        //convert all rates to USD
        for (const symbol of Object.keys(priceData)) {
            priceData[symbol].price = PriceProviderBase.calcCrossPrice(priceData[symbol].price, usdPrice)
        }
        //add EUR rate
        priceData.EUR = new PriceData({
            price: PriceProviderBase.calcCrossPrice(10000000n, usdPrice),
            source: this.name,
            ts: timestamp
        })
        //add to cache, clear old data
        ecbRates.clear()
        ecbRates.set(startPeriod, priceData)
        return priceData
    }
}

module.exports = ECBPriceProvider