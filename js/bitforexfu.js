'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { TICK_SIZE } = require ('./base/functions/number');
const { ExchangeError, AuthenticationError, OrderNotFound, InsufficientFunds, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bitforexfu extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bitforexfu',
            'name': 'Bitforex Futures',
            'countries': [ 'CN' ],
            // 'version': 'v1',
            'has': {
                'cancelOrder': false,
                'createLimitOrder': false,
                'createMarketOrder': false,
                'createOrder': false,
                'editOrder': false,
                'fetchBalance': false,
                'fetchL2OrderBook': false,
                'fetchMarkets': true,
                'fetchOHLCV': true,
                'fetchOrderBook': false,
                'fetchStatus': 'emulated',
                'fetchTicker': false,
                'fetchTrades': false,
                'privateAPI': false,
                'publicAPI': false,
            },
            'timeframes': {
                '1m': '1min',
                '5m': '5min',
                '15m': '15min',
                '30m': '30min',
                '1h': '1hour',
                '2h': '2hour',
                '4h': '4hour',
                '12h': '12hour',
                '1d': '1day',
                '1w': '1week',
                '1M': '1month',
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/44310033-69e9e600-a3d8-11e8-873d-54d74d1bc4e4.jpg',
                'api': {
                    'public': 'https://www.bitforex.com/contract',
                    'private': 'https://www.bitforex.com/contract',
                },
                'www': 'https://www.bitforex.com',
                'doc': 'https://github.com/githubdev2020/API_Doc_en/wiki',
                'fees': 'https://help.bitforex.com/en_us/?cat=13',
                'referral': undefined,
            },
            'api': {
                'public': {
                    'get': [
                        'swap/contract/listAll',
                        'mkapi/depth',
                        'mkapi/kline',
                    ],
                },
                'private': {
                    'post': [
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.04 / 100,
                    'taker': 0.06 / 100,
                },
                'funding': {
                    'tierBased': false,
                    'percentage': true,
                    'deposit': {},
					'withdraw': {},
                },
            },
            'exceptions': {
                '4004': OrderNotFound,
                '1013': AuthenticationError,
                '1016': AuthenticationError,
                '3002': InsufficientFunds,
                '10204': DDoSProtection,
            },
            'precisionMode': TICK_SIZE,
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetSwapContractListAll (params);
        //  {
        //    "data": [
        //      {
        //          id  10002
        //          symbol  "swap-usd-btc"
        //          baseSymbol  "BTC"
        //          quoteSymbol "USD"
        //          initMargins 0.01
        //          maintenanceMargins  0.005
        //          fundPreminumSymbol  "BTC"
        //          unitQuantity    1
        //          beginTime   1560648043415
        //          leverageLevel   100
        //          minOrderPrice   1e-8
        //          maxOrderPrice   1000000
        //          minOrderVolume  1
        //          maxOrderVolume  2000000
        //          maxUserVolume   5500000
        //          pricePrecision  2
        //          basePrecision   8
        //          openBuyLimitRate    0.01
        //          openSellLimitRate   0.01
        //          openBuyLimitRateMax 0.02
        //          openSellLimitRateMax    1000
        //          openBuyLimitRateMin 1
        //          openSellLimitRateMin    0.02
        //          feeRateMaker    0.0004
        //          feeRateTaker    0.0006
        //          fundPeriod  8
        //          isAutoReduce    true
        //          contractType    1
        //          dealNum 3
        //          deepJoinNum "2"
        //          minChangePrice  0.5
        //          alias   "BTC/USD"
        //          limitQuota  200000
        //          increaseLimitQuota  null
        //          status  "0"
        //          ctime   1560561643416
        //          mtime   1568855964408
        //          depthConfig "1,2,5,10,20"
        //          priceOrderPrecision 1
        //          baseShowPrecision   8
        //          depthOffset 10
        //          floatY  0.005
        //          riskRate    1
        //          outStatus   "0"
        //          inStatus    "0"
        //          currentPricePrecision   2
        //      }
        //    ]
        //  }
        const data = response['data'];
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const market = data[i];
            const id = this.safeString (market, 'symbol');
            const symbolParts = id.split ('-');
            const baseId = symbolParts[2];
            const quoteId = symbolParts[1];
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const active = true;
            const maker = this.safeFloat (market, 'feeRateMaker');
            const taker = this.safeFloat (market, 'feeRateTaker');
            const pricePrecision = this.safeInteger (market, 'priceOrderPrecision');
            const precision = {
                'amount': this.safeInteger (market, 'unitQuantity'),
                'price': Math.pow (10, -pricePrecision), // TICK_SIZE
            };
            const limits = {
                'amount': {
                    'min': this.safeFloat (market, 'minOrderVolume'),
                    'max': this.safeFloat (market, 'maxOrderVolume'),
                },
                'price': {
                    'min': this.safeFloat( market, 'minOrderPrice'),
                    'max': this.safeFloat( market, 'maxOrderPrice'),
                },
                'cost': {
                    'min': undefined,
                    'max': undefined,
                },
            };
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': active,
                'precision': precision,
                'limits': limits,
                'maker': maker,
                'taker': taker,
                'type': 'swap',
                'spot': false,
                'swap': true,
                'future': false,
                'info': market,
            });
        }
        return result;
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
		// const quoteVolume = this.safeFloat (ohlcv, 'vol');
        return [
            this.safeInteger (ohlcv, 'time'),
            this.safeFloat (ohlcv, 'open'),
            this.safeFloat (ohlcv, 'high'),
            this.safeFloat (ohlcv, 'low'),
            this.safeFloat (ohlcv, 'close'),
            undefined,
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
		// size is required, max 600
        let size = 600;
        if (limit !== undefined) {
            size = limit;
        }
        const request = {
            'businessType': market['id'],
            'kType': this.timeframes[timeframe],
			'size': size,
        };
        const response = await this.publicGetMkapiKline (this.extend (request, params));
        const ohlcvs = this.safeValue (response, 'data', []);
        return this.parseOHLCVs (ohlcvs, market, timeframe, since, limit);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/' + this.implodeParams (path, params);
        const query = this.omit (params, this.extractParams (path));
        if (api === 'public') {
            if (Object.keys (query).length) {
                url += '?' + this.urlencode (query);
            }
        } else {
            this.checkRequiredCredentials ();
            let payload = this.urlencode ({ 'accessKey': this.apiKey });
            query['nonce'] = this.milliseconds ();
            if (Object.keys (query).length) {
                payload += '&' + this.urlencode (this.keysort (query));
            }
            // let message = '/' + 'api/' + this.version + '/' + path + '?' + payload;
            const message = '/' + path + '?' + payload;
            const signature = this.hmac (this.encode (message), this.encode (this.secret));
            body = payload + '&signData=' + signature;
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (typeof body !== 'string') {
            return; // fallback to default error handler
        }
        if ((body[0] === '{') || (body[0] === '[')) {
            const feedback = this.id + ' ' + body;
            const success = this.safeValue (response, 'success');
            if (success !== undefined) {
                if (!success) {
                    const code = this.safeString (response, 'code');
                    this.throwExactlyMatchedException (this.exceptions, code, feedback);
                    throw new ExchangeError (feedback);
                }
            }
        }
    }
};
