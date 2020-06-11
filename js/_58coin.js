'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { BadSymbol, ExchangeError, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection, PermissionDenied, AddressPending, OnMaintenance } = require ('./base/errors');
const { TICK_SIZE } = require ('./base/functions/number');

//  ---------------------------------------------------------------------------

module.exports = class _58coin extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': '_58coin',
            'name': '58 Coin',
            'countries': [ 'CN' ],
            'version': 'v1',
            // 'rateLimit': undefined,
            'has': {
                'cancelOrder': false,
                'createLimitOrder': false,
                'createMarketOrder': false,
                'createOrder': false,
                'fetchBalance': false,
                // 'fetchClosedOrders': false,
                'fetchL2OrderBook': false,
                // 'fetchMyTrades': true,
                'fetchOHLCV': true,
                // 'fetchOpenOrders': true,
                // 'fetchOrder': true,
                'fetchOrderBook': false,
                // 'fetchOrders': true,
                // 'fetchOrderTrades': false,
                'fetchTicker': false,
                'fetchTickers': true,
                'fetchTrades': false,
            },
            'timeframes': {
                '1m': '1min',
                '3m': '3min',
                '5m': '5min',
                '15m': '15min',
                '30m': '30min',
                '1h': '1hour',
                '2h': '2hour',
                '4h': '4hour',
                '6h': '6hour',
                '12h': '12hour',
                '1d': '1day',
                '1w': '1week',
            },
            'urls': {
                'logo': undefined,
                'api': {
                    'public': 'https://openapi.58ex.com',
                    'private': 'https://openapi.58ex.com',
                },
                'www': 'https://58ex.com',
                'doc': 'https://github.com/58COIN/open-api-docs/wiki',
                'fees': [
                    'https://58coin-support.zendesk.com/hc/zh-cn/articles/360016222894',
                    'https://58coin-support.zendesk.com/hc/zh-cn/articles/360036716674',
                ],
                'referral': undefined,
            },
            'api': {
                'public': {
                    'get': [
                        'product/list',
                        'ticker/price',
                        'ticker',
                        'order_book',
                        'trades',
                        'candles',
                    ],
                },
                'private': {
                    'get': [
                        'accounts',
                        'order',
                        'orders',
                        'trades',
                    ],
                    'post': [
                        'order/place',
                        'order/cancel',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.0005,
                    'taker': 0.0005,
                },
            },
            'exceptions': {
                'exact': {
                },
                'broad': {
                },
            },
            'precisionMode': TICK_SIZE,
            'options': {
            },
            'commonCurrencies': {
            },
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetProductList (params);
        //  {
        //      "code": 0,
        //      "message": null,
        //      "data": [
        //          {
        //              "name": "btc_usdt",
        //              "baseCurrencyName": "BTC",
        //              "quoteCurrencyName": "USDT",
        //              "baseMinSize": "0.001",
        //              "baseIncrement": "0.0001",
        //              "quoteIncrement": "0.01"
        //          }
        //      ]
        //  }
        const result = [];
        const markets = this.safeValue (response, 'data', []);
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            const baseId = this.safeString (market, 'baseCurrencyName');
            const quoteId = this.safeString (market, 'quoteCurrencyName');
            const id = this.safeValue (market, 'name');
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const precision = {
                'amount': this.safeFloat (market, 'baseIncrement'),
                'price': this.safeFloat (market, 'quoteIncrement'),
            };
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': true,
                'info': market,
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': this.safeFloat (market, 'baseMinSize'),
                        'max': undefined,
                    },
                    'price': {
                        'min': precision['price'],
                        'max': undefined,
                    },
                },
            });
        }
        return result;
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        const response = await this.publicGetTicker (params);
        //  {
        //      "code": 0,
        //      "message": null,
        //      "data": [
        //          {
        //              "symbol": "ltc_btc",
        //              "time": "1512744759000",
        //              "bid": "0.019983",
        //              "ask": "0.019984",
        //              "last": "0.019984",
        //              "change": "4.02",
        //              "open": "0.019223",
        //              "high": "0.020268",
        //              "low": "0.019107",
        //              "volume": "1425.391",
        //              "quote_volume": "28.046991116"
        //          }
        //      ]
        //  }
        return this.parseTickers (this.safeValue (response, 'data', []), symbols);
    }

    parseTicker (ticker, market = undefined) {
        const timestamp = this.safeInteger (ticker, 'time');
        let symbol = undefined;
        const marketId = this.safeString (ticker, 'symbol');
        if (marketId in this.markets_by_id) {
            market = this.markets_by_id[marketId];
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const last = this.safeFloat (ticker, 'last');
        const open = this.safeFloat (ticker, 'open');
        let change = undefined;
        let percentage = undefined;
        let average = undefined;
        if (last !== undefined && open !== undefined) {
            change = last - open;
            if (open > 0) {
                percentage = change / open * 100;
            }
            average = this.sum (open, last) / 2;
        }
        const baseVolume = this.safeFloat (ticker, 'volume');
        const quoteVolume = this.safeFloat (ticker, 'quote_volume');
        let vwap = undefined;
        if (quoteVolume !== undefined) {
            if (baseVolume !== undefined && baseVolume > 0) {
                vwap = quoteVolume / baseVolume;
            }
        }
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high'),
            'low': this.safeFloat (ticker, 'low'),
            'bid': this.safeFloat (ticker, 'bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'ask'),
            'askVolume': undefined,
            'vwap': vwap,
            'open': open,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': change,
            'percentage': percentage,
            'average': average,
            'baseVolume': baseVolume,
            'quoteVolume': quoteVolume,
            'info': ticker,
        };
    }

    parseTickers (rawTickers, symbols = undefined) {
        const tickers = [];
        for (let i = 0; i < rawTickers.length; i++) {
            tickers.push (this.parseTicker (rawTickers[i]));
        }
        return this.filterByArray (tickers, 'symbol', symbols);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        //  [
        //      1521119063000,  // Open time
        //      "0.00000000",  // Open
        //      "0.00000000",  // High
        //      "0.00000000",  // Low
        //      "0.00000000",  // Close
        //      "0.00000000",  // Base Volume
        //      "0.00000000",  // Quote volume
        //  ]
        return [
            this.safeInteger (ohlcv, 0),
            this.safeFloat (ohlcv, 1),
            this.safeFloat (ohlcv, 2),
            this.safeFloat (ohlcv, 3),
            this.safeFloat (ohlcv, 4),
            this.safeFloat (ohlcv, 5),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['id'],
            'period': this.timeframes[timeframe],
        };
        if (since !== undefined) {
            request['since'] = since;
        }
        if (limit !== undefined) {
            request['limit'] = limit; // default 200
        }
        const response = await this.publicGetCandles (this.extend (request, params));
        //  {
        //      "code": 0,
        //      "message": null,
        //      "data": [
        //          ...
        //      ]
        //  }
        return this.parseOHLCVs (this.safeValue (response, 'data', []), market, timeframe, since, limit);
    }

    nonce () {
        return this.milliseconds ();
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const midfixes = {
            'public': 'spot',
            'private': 'spot/my',
        };
        let url = this.urls['api'][api] + '/' + this.version + '/' + midfixes[api] + '/' + path;
        if (api === 'public') {
            url += '?' + this.urlencode (params);
        } else {
            this.checkRequiredCredentials ();
            // TODO
            // query['nonce'] = this.nonce ();
            // body = this.urlencode (query);
            // headers = {
            //     'Content-Type': 'application/x-www-form-urlencoded',
            //     'Key': this.apiKey,
            //     'Sign': this.hmac (this.encode (body), this.encode (this.secret), 'sha512'),
            // };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        // TODO
        if (response === undefined) {
            return;
        }
        // {"error":"Permission denied."}
        if ('error' in response) {
            const message = response['error'];
            const feedback = this.id + ' ' + body;
            this.throwExactlyMatchedException (this.exceptions['exact'], message, feedback);
            this.throwBroadlyMatchedException (this.exceptions['broad'], message, feedback);
            throw new ExchangeError (feedback); // unknown message
        }
    }
};
