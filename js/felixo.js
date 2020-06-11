'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { BadSymbol, ExchangeError, ExchangeNotAvailable, AuthenticationError, InvalidOrder, InsufficientFunds, OrderNotFound, DDoSProtection, PermissionDenied, AddressPending, OnMaintenance } = require ('./base/errors');
// const { TICK_SIZE } = require ('./base/functions/number');

//  ---------------------------------------------------------------------------

module.exports = class felixo extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'felixo',
            'name': 'Felixo',
            'countries': [ 'TR' ],
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
                'fetchMarkets': 'emulated',
                // 'fetchMyTrades': true,
                'fetchOHLCV': false,
                // 'fetchOpenOrders': true,
                // 'fetchOrder': true,
                'fetchOrderBook': false,
                // 'fetchOrders': true,
                // 'fetchOrderTrades': false,
                'fetchTicker': false,
                'fetchTickers': true,
                'fetchTrades': false,
            },
            'urls': {
                'logo': undefined,
                'api': {
                    'public': 'https://api.felixo.com',
                    'private': 'https://api.felixo.com',
                },
                'www': 'https://www.felixo.com',
                'doc': 'https://www.felixo.com/static/docs/api/index.html',
                'fees': [
                    'https://www.felixo.com/en/fees-comission-chart',
                    'https://www.felixo.com/en/limits',
                ],
                'referral': undefined,
            },
            'api': {
                'public': {
                    'get': [
                        'time',
                        'ticker',
                        'orderbook',
                    ],
                },
                'private': {
                    'get': [
                        'account/balances',
                        'openorders',
                    ],
                    'post': [
                        'order',
                    ],
                    'delete': [
                        'order',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': true,
                    'percentage': true,
                    'maker': 0.002,
                    'taker': 0.002,
                },
            },
            'exceptions': {
                'exact': {
                },
                'broad': {
                },
            },
            'options': {
                'symbol': {
                    'quoteIds': [ 'USDT', 'USDC', 'TRY', 'BTC' ],
                    'reversed': false,
                },
            },
            'commonCurrencies': {
            },
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetTicker (params);
        //  [
        //      {
        //          "pair": "BTCTRY",
        //          ...
        //      }
        //  ]
        const result = [];
        for (let i = 0; i < response.length; i++) {
            const market = response[i];
            const id = this.safeString (market, 'pair');
            const parsed = this.parseSymbolIdJoined (id);
            const baseId = parsed['baseId'];
            const quoteId = parsed['quoteId'];
            const base = parsed['base'];
            const quote = parsed['quote'];
            const symbol = base + '/' + quote;
            const precision = {
                'amount': undefined,
                'price': undefined,
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
                        'min': undefined,
                        'max': undefined,
                    },
                    'price': {
                        'min': undefined,
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
        //  [
        //      {
        //          "pair": "BTCTRY",
        //          ...
        //      }
        //  ]
        return this.parseTickers (response, symbols);
    }

    parseTicker (ticker, market = undefined) {
        //  {
        //      "pair": "BTCTRY",
        //      "lastPrice": "43140.00000000",
        //      "openPrice": "43140.00000000",
        //      "highPrice": "43140.00000000",
        //      "lowPrice": "43140.00000000",
        //      "volume": "0.00000000",
        //      "bid": "43140.00000000",
        //      "ask": "43176.00000000",
        //      "timestamp": 1587377957316
        //  }
        const timestamp = this.safeInteger (ticker, 'timestamp');
        let symbol = undefined;
        const marketId = this.safeString (ticker, 'pair');
        if (marketId in this.markets_by_id) {
            market = this.markets_by_id[marketId];
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const last = this.safeFloat (ticker, 'lastPrice');
        const open = this.safeFloat (ticker, 'openPrice');
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
        const quoteVolume = undefined;
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
            'high': this.safeFloat (ticker, 'lowPrice'),
            'low': this.safeFloat (ticker, 'lowPrice'),
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

    parseSymbolIdJoined (symbolId) {
        // Convert by detecting and converting currencies in symbol
        const symbolIdLower = symbolId.toLowerCase ();
        const quoteIds = this.options['symbol']['quoteIds'];
        const reversed = this.options['symbol']['reversed'];
        const method = reversed ? 'startsWith' : 'endsWith';
        let quoteId = undefined;
        let baseId = undefined;
        for (let i = 0; i < quoteIds.length; i++) {
            if (this[method] (symbolIdLower, quoteIds[i].toLowerCase ())) {
                quoteId = quoteIds[i];
                break;
            }
        }
        if (quoteId === undefined) {
            throw new BadSymbol (this.id + ' symbolId could not be parsed: ' + symbolId);
        }
        if (!reversed) {
            const baseIdLength = symbolId.length - quoteId.length;
            baseId = this.sliceString (symbolId, 0, baseIdLength);
            quoteId = this.sliceString (symbolId, baseIdLength);
        } else {
            quoteId = this.sliceString (symbolId, 0, quoteId.length);
            baseId = this.sliceString (symbolId, quoteId.length);
        }
        return {
            'baseId': baseId,
            'quoteId': quoteId,
            'base': this.safeCurrencyCode (baseId),
            'quote': this.safeCurrencyCode (quoteId),
        };
    }

    startsWith (string, x) {
        return this.sliceString (string, 0, x.length) === x;
    }

    endsWith (string, x) {
        const start = Math.max (0, string.length - x.length);
        return this.sliceString (string, start) === x;
    }

    sliceString (string, start = undefined, end = undefined) {
        if (start === undefined) {
            start = 0;
        }
        if (end === undefined) {
            end = string.length;
        }
        return string.slice (start, end);
    }

    nonce () {
        return this.milliseconds ();
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/' + this.version + '/' + path;
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
