'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { AuthenticationError, BadRequest, DDoSProtection, ExchangeError, ExchangeNotAvailable, InsufficientFunds, InvalidOrder, OrderNotFound, PermissionDenied } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class primexbt extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'primexbt',
            'name': 'Prime XBT',
            'countries': [ 'SC' ], // Seychelles
            'version': 'v1',
            'userAgent': undefined,
            // 'rateLimit': 2000,
            'has': {
                'CORS': false,
                'createMarketOrder': false,
                'fetchTicker': false,
                'fetchTickers': false,
                'fetchOrderBook': true,
                'withdraw': false,
                'fetchDeposits': false,
                'fetchWithdrawals': false,
                'fetchTransactions': false,
                'createDepositAddress': false,
                'fetchDepositAddress': false,
                'fetchClosedOrders': false,
                'fetchTrades': false,
                'fetchOHLCV': false,
                'fetchOpenOrders': false,
                'fetchOrderTrades': false,
                'fetchOrders': false,
                'fetchOrder': false,
                'fetchMyTrades': false,
            },
            'timeframes': {},
            'urls': {
                'test': undefined,
                'logo': undefined,
                'api': {
                    'public': 'https://api.primexbt.com',
                    'private': 'https://api.primexbt.com',
                },
                'www': 'https://primexbt.com/',
                'doc': undefined,
                'fees': 'https://primexbt.com/fees',
                'referral': undefined,
                'websocket': [ 'wss://api.primexbt.com/v1/pws' ],
            },
            'api': {
                'public': {
                    'get': [
                        'markets',
                        'dom',
                    ],
                },
                'private': {
                    'get': [],
                    'post': [],
                    'put': [],
                    'delete': [],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.0005,
                    'taker': 0.0005,
                },
                'funding': {
                    'tierBased': false,
                    'percentage': false,
                    'deposit': {},
                    'withdraw': {
                        'BTC': 0.0005,
                    },
                },
            },
            'exceptions': {
                'exact': {},
                'broad': {},
            },
            'options': {},
        });
    }

    async fetchMarkets (params = {}) {
        const query = this.extend ({
            'category': 'crypto',
        }, params);
        const response = await this.publicGetMarkets (query);
        // { 
        //   "data": [
        //     {
        //        "name":              "BTC/USD",
        //        "base":              "BTC",
        //        "quote":             "USD",
        //        "last":              9274.1,
        //        "change":            -0.22,
        //        "price_scale":       1,
        //        "description":       "Bitcoin",
        //        "qty_scale":         2,
        //        "open":              9294.6,
        //        "turnover":          11979.695,
        //        "turnover_usd":      1.1033671229E8,
        //        "open_interest":     1705.34,
        //        "open_interest_btc": 1705.34,
        //        "price":             9274.1,
        //        "change24h":         -0.22,
        //        "priceScale":        1
        //     }
        //   ]
        // }
        const data = response['data'];
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const market = data[i];
            const active = true;
            const id = market['name'];
            const baseId = market['base'];
            const quoteId = market['quote'];
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const precision = {
                'amount': market['qty_scale'],
                'price': market['price_scale'],
            };
            const limits = {
                'amount': {
                    'min': Math.pow (10, -precision['amount']),
                    'max': undefined,
                },
                'price': {
                    'min': Math.pow (10, -precision['price']),
                    'max': undefined,
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
                'type': 'future',
                'spot': false,
                'swap': false,
                'future': true,
                'prediction': false,
                'info': market,
            });
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['id'],
        };
        if (limit !== undefined) {
            request['depth'] = limit;
        }
        const response = await this.publicGetDom (this.extend (request, params));
        // {
        //   "symbol": "BTC/USD",
        //   "sells":  [[9271, 178.90452476549999], ...],
        //   "bids":   [[9270.9, 282.15991329099995], ...],
        // }
        const keys = ['bids','sells'];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            // Each price has two entries with identical volumes; drop the duplicates
            response[key] = this.toArray (this.indexBy (response[key], 0));
        }
        return this.parseOrderBook (response, undefined, 'bids', 'sells');
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/' + this.version + '/' + path;
        if (method === 'GET') {
            if (Object.keys (params).length) {
                url += '?' + this.urlencode (params);
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
