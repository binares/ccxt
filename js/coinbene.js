'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { AuthenticationError, ExchangeError, NotSupported, PermissionDenied, ArgumentsRequired, InvalidNonce, OrderNotFound, InsufficientFunds, InvalidOrder, RateLimitExceeded, ExchangeNotAvailable } = require ('./base/errors');
const SIGNIFICANT_DIGITS = require ('./base/functions/number');

//  ---------------------------------------------------------------------------

module.exports = class coinbene extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'coinbene',
            'name': 'CoinBene',
            'countries': [ 'CN', 'US' ],
            'version': 'v2',
            'rateLimit': 1500,
            'certified': true,
            // new metainfo interface
            'has': {
                'cancelOrder': false,
                'createLimitOrder': false,
                'createMarketOrder': false,
                'createOrder': false,
                'editOrder': false,
                'fetchBalance': false,
                'fetchOHLCV': false,
                'fetchTicker': false,
                'fetchTickers': true,
                'fetchTrades': false,
                'privateAPI': false,
            },
            'timeframes': {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '3h': '3h',
                '6h': '6h',
                '12h': '12h',
                '1d': '1D',
                '1w': '7D',
                '2w': '14D',
                '1M': '1M',
            },
            'urls': {
                'logo': 'https://res.coinbene.mobi/coinbene-article/9f524eb71731f51e.png',
                'api': 'https://openapi-exchange.coinbene.com',
                'www': 'http://www.coinbene.com',
                'prefixPath': '/api/exchange/v2/',
                'referral': 'http://www.coinbene.com',
                'doc': [
                    'https://github.com/Coinbene/API-SPOT-v2-Documents',
                ],
            },
            'api': {
                'public': {
                    'get': [
                        'market/tradePair/list',
                        'market/tradePair/one',
                        'market/ticker/list',
                        'market/ticker/one',
                        'market/orderBook',
                        'market/trades',
                        'market/instruments/candles',
                        'market/rate/list',
                    ],
                },
                'private': {
                    'get': [
                        'account/list',
                        'account/one',
                        'order/info',
                        'order/openOrders',
                        'order/closedOrders',
                        'order/trade/fills',
                    ],
                    'post': [
                        'order/place',
                        'order/cancel',
                        'order/batchCancel',
                        'order/batchPlaceOrder',
                    ],
                },
            },
            'options': {
                'currencyNames': undefined,
                'orderTypes': {
                    'limit': '1',
                    'market': '2',
                },
                'direction': {
                    'buy': '1',
                    'sell': '2',
                },
            },
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetMarketTradePairList (params);
        const result = [];
        for (let i = 0; i < response['data'].length; i++) {
            const market = response['data'][i];
            let id = this.safeString (market, 'symbol').toUpperCase ();
            let base = undefined;
            let quote = undefined;
            let baseId = undefined;
            let quoteId = undefined;
            if (id.indexOf ('/') >= 0) {
                const parts = id.split('/')
                base = parts[0];
                baseId = base.toLowerCase ();
                quote = parts[1];
                quoteId = quote.toLowerCase ();
            }
            const symbol = base + '/' + quote;
            id = baseId + quoteId;
            const precision = {
                'price': market['pricePrecision'],
                'amount': market['amountPrecision'],
            };
            const priceFluctuation = this.safeFloat (market, 'priceFluctuation');
            const limits = {
                'amount': {
                    'min': this.safeFloat (market, 'minAmount'),
                    'max': undefined,
                },
                'price': {
                    'min': 1 - priceFluctuation,
                    'max': 1 + priceFluctuation,
                },
            };
            limits['cost'] = {
                'min': limits['amount']['min'] * limits['price']['min'],
                'max': undefined,
            };
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': true,
                'precision': precision,
                'limits': limits,
                'info': market,
            });
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        if (limit === undefined) {
            limit = 10; // 5, 10, 50, 100. Default value 10
        }
        const request = {
            'symbol': symbol,
            'depth': limit,
        };
        const response = await this.publicGetMarketOrderBook ( this.extend (request, params));
        const code = response['code'];
        const message = response['message'];
        if (code !== 200) {
            throw new ExchangeError (this.id + ' message = ' + message);
        }
        const orderBook = response['data'];
        const timestamp = this.parse8601 (this.safeString (orderBook, 'timestamp'));
        return this.parseOrderBook (orderBook, timestamp);
        return orderBook;
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        const response = await this.publicGetMarketTickerList (params);
        return this.parseTickers (response['data'], symbols);
    }
    
    parseTicker (ticker, market = undefined) {
        const symbol = this.safeString (ticker, 'symbol');
        const last = this.safeFloat (ticker, 'latestPrice');
        return {
            'symbol': symbol,
            'info': ticker,
            'timestamp': undefined,
            'datetime': undefined,
            'high': this.safeFloat (ticker, 'high24h'),
            'low': this.safeFloat (ticker, 'low24h'),
            'bid': this.safeFloat (ticker, 'bestBid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'bestAsk'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeFloat (ticker, 'volume24h'),
            'quoteVolume': undefined,
        };
    }
    
    parseTickers (rawTickers, symbols = undefined) {
        const tickers = [];
        for (let i = 0; i < rawTickers.length; i++) {
            tickers.push (this.parseTicker (rawTickers[i]));
        }
        return this.filterByArray (tickers, 'symbol', symbols);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        path = this.urls['prefixPath'] + path;
        const isArray = Array.isArray (params);
        // const request = '/api/' + api + '/' + this.version + '/';
        const request = isArray ? path : this.implodeParams (path, params);
        const query = isArray ? params : this.omit (params, this.extractParams (path));
        let url = this.urls['api'] + request;
        if (api === 'public') {
            if (query) {
                url += '?' + this.urlencode (query);
            }
        }
        if (api === 'private') {
            this.checkRequiredCredentials ();
            const timestamp = this.iso8601 (this.milliseconds ());
            headers = {
                'ACCESS-KEY': this.apiKey,
                'ACCESS-TIMESTAMP': timestamp,
            };
            const auth = timestamp + method + request;
            if (method === 'GET') {
                if (query) { 
                    urlencodedQuery = '?' + this.urlencode (query);
                    url += urlencodedQuery;
                    auth += urlencodedQuery;
                }
            } else {
                if (isArray || query) {
                    body = this.json (query);
                    auth += body;
                }
                headers['Content-Type'] = 'application/json';
            }
            const signature = this.hmac (this.encode (auth), this.encode (this.secret)); // , hashlib.sha256, 'hex');
            headers['ACCESS-SIGN'] = signature;
        }
        return {'url': url, 'method': method, 'body': body, 'headers': headers};
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (response === undefined) {
            return;
        }
        if (code >= 400) {
            if (body[0] === '{') {
                const feedback = this.id + ' ' + body;
                const message = this.safeString2 (response, 'message', 'error');
                this.throw_exactly_matched_exception (this.exceptions['exact'], message, feedback);
                this.throw_broadly_matched_exception (this.exceptions['broad'], message, feedback);
                throw new ExchangeError (feedback); // unknown message
            }
        }
    }
};
