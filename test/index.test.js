/*eslint-disable no-undef */
const {setGateway, getTradesData} = require('../src')
const PriceProviderBase = require('../src/providers/price-provider-base')
const {assets, getTimestamp} = require('./test-utils')

const proxies = [
    'http://localhost:8081',
    'http://localhost:8082'
]

describe('index', () => {

    const timeframe = 60
    const count = 100
    const timestamp = getTimestamp() - (timeframe * count)

    it('get prices', async () => {
        const tradesData = await getTradesData(assets, 'USD', timestamp, timeframe, count,
            {
                batchSize: 5,
                batchDelay: 1000,
                timeout: 15000,
                sources: {
                    'apilayer': {apiKey: ''},
                    'nbp': {},
                    'ecb': {},
                    'abstractapi': {apiKey: ''},
                    'exchangerate': {apiKey: ''}
                }
            })
        expect(tradesData.length).toBe(count)
        expect(tradesData[tradesData.length - 1].length).toBe(assets.length)
        expect(tradesData[tradesData.length - 1][0].length).toBe(5)
    }, 30000)


    it('set gateway', () => {
        setGateway(proxies, true)
        expect(PriceProviderBase.gatewayUrls.length).toBe(proxies.length)
        setGateway(null)
        expect(PriceProviderBase.gatewayUrls).toBeNull()
    }, 30000)
})