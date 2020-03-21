'use strict';

// ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { TICK_SIZE } = require ('./base/functions/number');
const { AuthenticationError, ExchangeError, ArgumentsRequired, InvalidAddress, OrderNotFound, NotSupported, DDoSProtection, InsufficientFunds, InvalidOrder } = require ('./base/errors');

// ---------------------------------------------------------------------------

module.exports = class gateiofu extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'gateiofu',
            'name': 'Gate.io Futures',
            'countries': [ 'CN' ],
            'rateLimit': 1000,
            'version': 'v4',
            'has': {
                'CORS': false,
                'createMarketOrder': false,
                'fetchTicker': false,
                'fetchTickers': false,
                'withdraw': false,
                'fetchDeposits': false,
                'fetchWithdrawals': false,
                'fetchTransactions': false,
                'createDepositAddress': false,
                'fetchDepositAddress': false,
                'fetchClosedOrders': false,
                'fetchTrades': false,
                'fetchOHLCV': true,
                'fetchOpenOrders': false,
                'fetchOrderTrades': false,
                'fetchOrders': false,
                'fetchOrder': false,
                'fetchMyTrades': false,
            },
            'timeframes': {
                '10s': '10s',
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '4h': '4h',
                '8h' : '8h',
                '1d': '1d',
                '1w': '7d',
            },
            'urls': {
                'test': {
                    'public': 'https://fx-api-testnet.gateio.ws/api',
                    'private': 'https://fx-api-testnet.gateio.ws/api',
                },
                'logo': 'https://user-images.githubusercontent.com/1294454/31784029-0313c702-b509-11e7-9ccc-bc0da6a0e435.jpg',
                'api': {
                    'public': 'https://fx-api.gateio.ws/api',
                    'private': 'https://fx-api.gateio.ws/api',
                },
                'www': 'https://gate.io/',
                'doc': 'https://www.gate.io/docs/futures/api/index.html#gate-api-v4',
                'fees': [
                    'https://gate.io/fee',
                    'https://support.gate.io/hc/en-us/articles/115003577673',
                ],
                'referral': 'https://www.gate.io/signup/2436035',
            },
            'api': {
                'public': {
                    'get': [
                        'contracts',
                        'contracts/{contract}',
                        'order_book',
                        'trades',
                        'candlesticks',
                        'tickers',
                        'funding_rate',
                        'insurance',
                    ],
                },
                'private': {
                    'get': [
                        'accounts',
                        'account_book',
                        'positions',
                        'positions/{contract}',
                        'orders',
                        'orders/{order_id}',
                        'my_trades',
                        'position_close',
                        'liquidates',
                        'price_orders',
                        'price_orders/{order_id}',
                    ],
                    'post': [
                        'positions/{contract}/margin',
                        'positions/{contract}/leverage',
                        'positions/{contract}/risk_limit',
                        'orders',
                        'price_orders',
                    ],
                    'delete': [
                        'orders',
                        'orders/{order_id}',
                        'price_orders',
                        'price_orders/{order_id}',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': true,
                    'percentage': true,
                    'maker': -0.00025,
                    'taker': 0.00075,
                },
            },
            'exceptions': {
                'exact': {
                    '4': DDoSProtection,
                    '5': AuthenticationError, // { result: "false", code:  5, message: "Error: invalid key or sign, please re-generate it from your account" }
                    '6': AuthenticationError, // { result: 'false', code: 6, message: 'Error: invalid data  ' }
                    '7': NotSupported,
                    '8': NotSupported,
                    '9': NotSupported,
                    '15': DDoSProtection,
                    '16': OrderNotFound,
                    '17': OrderNotFound,
                    '20': InvalidOrder,
                    '21': InsufficientFunds,
                },
                // https://gate.io/api2#errCode
                'errorCodeNames': {
                    '1': 'Invalid request',
                    '2': 'Invalid version',
                    '3': 'Invalid request',
                    '4': 'Too many attempts',
                    '5': 'Invalid sign',
                    '6': 'Invalid sign',
                    '7': 'Currency is not supported',
                    '8': 'Currency is not supported',
                    '9': 'Currency is not supported',
                    '10': 'Verified failed',
                    '11': 'Obtaining address failed',
                    '12': 'Empty params',
                    '13': 'Internal error, please report to administrator',
                    '14': 'Invalid user',
                    '15': 'Cancel order too fast, please wait 1 min and try again',
                    '16': 'Invalid order id or order is already closed',
                    '17': 'Invalid orderid',
                    '18': 'Invalid amount',
                    '19': 'Not permitted or trade is disabled',
                    '20': 'Your order size is too small',
                    '21': 'You don\'t have enough fund',
                },
            },
            'precisionMode': TICK_SIZE,
            'options': {
                'settleCurrencyIds': [
                    'btc',
                    'usdt',
                ],
                //'limits': {
                //   'cost': {
                //        'min': {
                //           'BTC': 0.0001,
                //            'ETH': 0.001,
                //            'USDT': 1,
                //        },
                //    },
                //},
            },
        });
    }

    async fetchMarkets (params = {}) {
        const settleCurrencyIds = this.options['settleCurrencyIds'];
        const settleCurrencyIdsByMarketId = {};
        var markets = [];
        for (let i = 0; i < settleCurrencyIds.length; i++) {
            const settleCurrencyId = settleCurrencyIds[i];
            const query = this.omit (params, 'type');
            query['settle'] = settleCurrencyId;
            const response = await this.publicGetContracts (query);
            if (! (Array.isArray (response))) {
                throw new ExchangeError (this.id + ' fetchMarkets got an unrecognized response');
            }
            for (let j = 0; j < response.length; j++) {
                const market = response[j];
                settleCurrencyIdsByMarketId[market['name']] = settleCurrencyId;
            }
            var markets = this.arrayConcat (markets, response);
        }
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            const id = market['name'];
            const settleCurrencyId = settleCurrencyIdsByMarketId[id];
            const settleCurrency = this.safeCurrencyCode(settleCurrencyId.toUpperCase ());
            // all of their symbols are separated with an underscore
            // but not boe_eth_eth (BOE_ETH/ETH) which has two underscores
            // https://github.com/ccxt/ccxt/issues/4894
            const parts = id.split ('_');
            const numParts = parts.length;
            let baseId = parts[0];
            let quoteId = parts[1];
            if (numParts > 2) {
                baseId = parts[0] + '_' + parts[1];
                quoteId = parts[2];
            }
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const type = (market['type'] === 'inverse') ? 'swap' : 'future';
            const spot = false;
            const swap = (type === 'swap');
            const future = (type === 'future');
            const maker = this.safeFloat(market, 'maker_fee_rate');
            const taker = this.safeFloat(market, 'taker_fee_rate');
            const precision = {
                'amount': market['order_size_min'],
                'price': this.safeFloat(market, 'order_price_round'),
            };
            const amountLimits = {
                'min': market['order_size_min'],
                'max': market['order_size_max'],
            };
            const priceLimits = {
                'min': precision['price'],
                'max': undefined,
            };
            const defaultCost = amountLimits['min'] * priceLimits['min'];
            const minCost = defaultCost;
            //const minCost = this.safeFloat (this.options['limits']['cost']['min'], quote, defaultCost);
            const costLimits = {
                'min': minCost,
                'max': undefined,
            };
            const limits = {
                'amount': amountLimits,
                'price': priceLimits,
                'cost': costLimits,
            };
            const active = true;
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': active,
                'maker': maker,
                'taker': taker,
                'precision': precision,
                'limits': limits,
                'type': type,
                'spot': spot,
                'future': future,
                'swap': swap,
                'settleCurrency': settleCurrency,
                'settleCurrencyId': settleCurrencyId,
                'info': market,
            });
        }
        return result;
    }
    
    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'settle': market['settleCurrencyId'],
            'contract': market['id'],
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.publicGetOrderBook (this.extend (request, params));
        //  {
        //    "asks": [
        //      {
        //        "p": "1.52",
        //        "s": 100
        //      },
        //      {
        //        "p": "1.53",
        //        "s": 40
        //      }
        //    ],
        //    "bids": [
        //      {
        //        "p": "1.17",
        //        "s": 150
        //      },
        //      {
        //        "p": "1.16",
        //        "s": 203
        //      }
        //    ]
        //  }
        return this.parseOrderBook (response, undefined, 'bids', 'asks', 'p', 's');
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            ohlcv['t'] * 1000,
            parseFloat (ohlcv['o']),
            parseFloat (ohlcv['h']),
            parseFloat (ohlcv['l']),
            parseFloat (ohlcv['c']),
            parseFloat (ohlcv['v']),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        // Return specified contract candlesticks. 
        // If prefix contract with mark_, the contract's mark price candlesticks are returned;
        // if prefix with index_, index price candlesticks will be returned.
        const request = {
            'settle': market['settleCurrencyId'],
            'contract': market['id'],
            'interval': this.timeframes[timeframe],
        };
        // Maximum of 2000 points are returned in one query.
        var limit = (limit !== undefined) ? Math.min (limit, 2000) : limit;
        if (since !== undefined) {
            request['from'] = this.truncate (since / 1000);
            if (limit !== undefined) {
                const periodDurationInSeconds = this.parseTimeframe (timeframe);
                // The period must not exceed 2000 points
                const limitFinal = (limit !== 2000) ? limit : (limit - 1);
                request['to'] = request['from'] + (limitFinal *  periodDurationInSeconds);
            }
        } else if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.publicGetCandlesticks (this.extend (request, params));
        //
        //  [
        //      {
        //          "t": 1539852480,
        //          "v": 97151,
        //          "c": "1.032",
        //          "h": "1.032",
        //          "l": "1.032",
        //          "o": "1.032"
        //      }
        //  ]
        //
        return this.parseOHLCVs (response, market, timeframe, since, limit);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const extendedPath = 'futures/{settle}/' + path;
        let url = this.urls['api'][api] + '/' + this.version + '/' +  this.implodeParams (extendedPath, params);
        const query = this.omit (params, this.extractParams (extendedPath));
        if (api === 'public') {
            if (Object.keys (query).length) {
                url += '?' + this.urlencode (query);
            }
        } else {
            this.checkRequiredCredentials ();
            const nonce = this.nonce ();
            const request = { 'nonce': nonce };
            body = this.urlencode (this.extend (request, query));
            const signature = this.hmac (this.encode (body), this.encode (this.secret), 'sha512');
            headers = {
                'Key': this.apiKey,
                'Sign': signature,
                'Content-Type': 'application/x-www-form-urlencoded',
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (response === undefined) {
            return;
        }
        const resultString = this.safeString (response, 'result', '');
        if (resultString !== 'false') {
            return;
        }
        const errorCode = this.safeString (response, 'code');
        const message = this.safeString (response, 'message', body);
        if (errorCode !== undefined) {
            const feedback = this.safeString (this.exceptions['errorCodeNames'], errorCode, message);
            this.throwExactlyMatchedException (this.exceptions['exact'], errorCode, feedback);
        }
    }
};
