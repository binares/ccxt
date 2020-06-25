'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, ArgumentsRequired, ExchangeNotAvailable, InsufficientFunds, OrderNotFound, InvalidOrder, DDoSProtection, InvalidNonce, AuthenticationError, PermissionDenied } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class coinsuper extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'coinsuper',
            'name': 'CoinSuper',
            'countries': [ 'CN' ],
            'rateLimit': 200,
            'version': 'v1',
            'has': {
                'CORS': false,
                'fetchTrades': true,
                'fetchTickers': false,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchOpenOrders': true,
                'fetchClosedOrders': false,
                'fetchOHLCV': true,
                'fetchBalance': true,
                'cancelOrder': true,
                'cancelOrders': true,
            },
            'timeframes': {
                '5m': '5min',
                '15m': '15min',
                '30m': '30min',
                '1h': '1hour',
                '6h': '6hour',
                '12h': '12hour',
                '1d': '1day',
            },
            'urls': {
                'logo': 'https://www.coinsuper' + '.com/api/docs/v1/images/logo.png',
                'api': {
                    'public': 'https://api.coinsuper' + '.com',
                    'private': 'https://api.coinsuper' + '.com/api',
                },
                'www': 'https://coinsuper' + '.com',
                'doc': 'https://www.coinsuper' + '.com/api/docs/v1/api_en.html',
                'fees': 'https://support.coinsuper' + '.info/hc/en-gb/articles/360020538154-Fees-Schedule',
            },
            'api': {
                'public': {
                    'get': [
                    ],
                },
                'private': {
                    'post': [
                        'market/orderBook',
                        'market/kline',
                        'market/tickers',
                        'market/symbolList',
                        'order/buy',
                        'order/sell',
                        'order/cancel',
                        'order/batchCancel',
                        'asset/userAssetInfo',
                        'order/list',
                        'order/details',
                        'order/clList',
                        'order/openList',
                        'order/history',
                        'order/tradeHistory',
                    ],
                },
                'options': {
                    // 'defaultTimeInForce': 'FOK',
                },
            },
            'exceptions': {
                '2000': ExchangeNotAvailable, // 'system upgrading',
                '2001': 'system internal error',
                '2002': 'interface is unavailability',
                '2003': DDoSProtection, // request is too frequently,
                '2004': PermissionDenied, // fail to check sign
                '2005': ArgumentsRequired, // parameter is invalid,
                '2006': 'request failure',
                '2007': PermissionDenied, // 'accesskey has been forbidden',
                '2008': 'user not exist',
                '3001': InsufficientFunds, // 'account balance is not enough',
                '3002': OrderNotFound, // 'orderNo is not exist',
                '3003': 'price is invalid',
                '3004': 'symbol is invalid',
                '3005': 'quantity is invalid',
                '3006': 'ordertype is invalid',
                '3007': 'action is invalid',
                '3008': 'state is invalid',
                '3009': InvalidNonce, // 'num is invalid',
                '3010': 'amount is invalid',
                '3011': 'cancel order failure',
                '3012': 'create order failure',
                '3013': 'orderList is invalid',
                '3014': 'symbol not trading',
                '3015': 'order amount or quantity less than min setting',
                '3016': 'price greater than max setting',
                '3017': AuthenticationError, // 'user account forbidden',
                '3018': 'order has execute',
                '3019': 'orderNo num is more than the max setting',
                '3020': 'price out of range',
                '3021': 'order has canceled',
                '3027': 'this symbols API trading channel is not available',
                '3028': 'duplicate clientOrderId',
                '3029': 'Market price deviation is too large, market order is not recommended',
                '3030': 'Market price deviation is too large, market order is not recommended',
                '3031': 'batch create order more or less than limit',
                '3032': 'batch create order symbol not unique',
                '3033': 'batch create order action not unique',
                '3034': 'clientOrderIdList and orderNoList should and only pass one',
                '3035': 'order cancel param error',
                '3036': 'not usual ip',
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': true,
            },
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.privatePostMarketSymbolList (params);
        const markets = this.safeValue (response['data'], 'result');
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            const id = this.safeString (market, 'symbol');
            const [baseId, quoteId] = id.split ('/');
            let base = baseId.toUpperCase ();
            let quote = quoteId.toUpperCase ();
            base = this.safeCurrencyCode (base);
            quote = this.safeCurrencyCode (quote);
            const symbol = base + '/' + quote;
            const precision = {
                'amount': this.safeInteger (market, 'quantityScale'),
                'price': this.safeInteger (market, 'priceScale'),
                'totalPrice': this.safeInteger (market, 'amountScale')
            };
            const amountLimits = {
                'min': this.safeFloat (market, 'quantityMin'),
                'max': this.safeFloat (market, 'quantityMax')
            };
            const marketTotalLimits = {
                'min': this.safeFloat (market, 'priceMin'),
                'max': this.safeFloat (market, 'priceMax')
            };
            const deviationRatio = {
                'deviation': this.safeFloat (market, 'deviationRatio')
            };
            const limits = {
                'amount': amountLimits,
                'price': marketTotalLimits,
                'cost': {
                    'min': undefined,
                    'max': undefined
                },
                'deviationRatio': deviationRatio
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
                'info': market
            });
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOrderBook requires a `symbol` argument');
        }
        const market = this.market (symbol);
        await this.loadMarkets ();
        if (limit === undefined || limit > 50) {
            limit = 50;
        }
        let request = {
            'symbol': market['id'],
            'num': limit
        };
        const response = await this.privatePostMarketOrderBook (this.extend (request, params));
        const orderbook = this.safeValue (response['data'], 'result', {});
        const timeStamp = this.safeValue (response['data'], 'timestamp', {});
        return this.parseOrderBook (orderbook, timeStamp, 'bids', 'asks', 'limitPrice', 'quantity');
    }

    async fetchOHLCV (symbol, timeframe = '5m', since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOHLCV requires a `symbol` argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        if (limit === undefined || limit > 300) {
            limit = 300;
        }
        const request = {
            'symbol': market['id'],
            'range': this.timeframes[timeframe],
            'num': limit
        };
        const response = await this.privatePostMarketKline (this.extend (request, params));
        const data = this.safeValue (response['data'], 'result', {});
        return this.parseOHLCVs (data, market, timeframe, since, limit);
    }

    parseOHLCV (ohlcv, market = undefined) {
        return [
            this.safeInteger (ohlcv, 'timestamp'),
            this.safeFloat (ohlcv, 'open'),
            this.safeFloat (ohlcv, 'high'),
            this.safeFloat (ohlcv, 'low'),
            this.safeFloat (ohlcv, 'close'),
            this.safeFloat (ohlcv, 'volume'),
        ];
    }

    async fetchTrades (symbol, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchMyTrades requires a `symbol` argument');
        }
        const market = this.market (symbol);
        await this.loadMarkets ();
        const request = {
            'symbol': market['id']
        };
        const response = await this.privatePostMarketTickers (this.extend (request, params));
        const data = this.safeValue (response['data'], 'result', {});
        return this.parseTrades (data, market);
    }

    parseTrade (trade, market = undefined) {
        let timestamp = this.safeInteger (trade, 'timestamp');
        let side = this.safeStringLower (trade, 'tradeType');
        const price = this.safeFloat2 (trade, 'rate', 'price');
        const id = this.safeString2 (trade, 'trade_id', 'tid');
        const order = this.safeString (trade, 'order_id');
        if ('pair' in trade) {
            const marketId = this.safeString (trade, 'pair');
            market = this.safeValue (this.markets_by_id, marketId, market);
        }
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const amount = this.safeFloat (trade, 'volume');
        const type = 'limit'; // all trades are still limit trades
        let takerOrMaker = undefined;
        let fee = undefined;
        const feeCost = this.safeFloat (trade, 'commission');
        if (feeCost !== undefined) {
            const feeCurrencyId = this.safeString (trade, 'commissionCurrency');
            const feeCurrencyCode = this.safeCurrencyCode (feeCurrencyId);
            fee = {
                'cost': feeCost,
                'currency': feeCurrencyCode
            };
        }
        const isYourOrder = this.safeValue (trade, 'is_your_order');
        if (isYourOrder !== undefined) {
            takerOrMaker = 'taker';
            if (isYourOrder) {
                takerOrMaker = 'maker';
            }
            if (fee === undefined) {
                fee = this.calculateFee (symbol, type, side, amount, price, takerOrMaker);
            }
        }
        let cost = undefined;
        if (amount !== undefined) {
            if (price !== undefined) {
                cost = amount * price;
            }
        }
        return {
            'id': id,
            'order': order,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'type': type,
            'side': side,
            'takerOrMaker': takerOrMaker,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
            'info': trade
        };
    }

    nonce () {
        return this.milliseconds ();
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/' + this.version + '/' + path;
        if (api === 'public') {
            url += '?' + this.urlencode (params);
            headers = { 'Content-Type': 'application/json' };
        } else {
            this.checkRequiredCredentials ();
            const nonce = this.nonce ();
            const sigParams = this.extend ({
                'timestamp': nonce,
                'accesskey': this.apiKey,
                'secretkey': this.secret
            }, params);
            // param alphabetical order is necessary, but urlencode doesn't preserve order (even if it is OrderedDict)
            // let signature = this.rawencode (this.keysort (sigParams));
            // let signature = this.urlencode (this.keysort (sigParams));
            let signature = '';
            const keys = Object.keys (this.keysort (sigParams));
            for (let i = 0; i < keys.length; i++) {
                signature += (i > 0) ? '&' : '';
                signature += keys[i] + '=' + sigParams[keys[i]].toString ();
            }
            signature = this.hash (this.encode (signature), 'md5');
            body = this.extend ({
                'common': {
                    'accesskey': this.apiKey,
                    'sign': signature,
                    'timestamp': nonce
                },
                'data': params
            });
            headers = { 'Content-Type': 'application/json' };
            if (body !== undefined) {
                body = this.json (body, { 'convertArraysToObjects': true });
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (response === undefined) {
            return;
        }
        if ('code' in response) {
            if (response['code'] != '1000') {
                const code = this.safeString (response, 'code');
                const feedback = this.id + ' ' + body;
                const exceptions = this.exceptions;
                if (code in exceptions) {
                    throw new exceptions[code] (feedback);
                } else {
                    throw new ExchangeError (feedback);
                }
            }
        }
        if (!('result' in response['data'])) {
            throw new ExchangeError (this.id + ' ' + body);
        }
    }
    //handleRestResponse(response, url, method = 'GET', requestHeaders = undefined, requestBody = undefined) {
    //    return response.text().then((responseBody) => {
    //        let toBigNum = responseBody.replace(/:(\d{19,})/g, `:"$1"`);
    //        const json = this.parseJson(toBigNum);
    //        const responseHeaders = this.getResponseHeaders(response);
    //        if (this.enableLastResponseHeaders) {
    //            this.last_response_headers = responseHeaders;
    //        }
    //        if (this.enableLastHttpResponse) {
    //            this.last_http_response = responseBody; // FIXME: for those classes that haven't switched to handleErrors yet
    //        }
    //        if (this.enableLastJsonResponse) {
    //            this.last_json_response = json;         // FIXME: for those classes that haven't switched to handleErrors yet
    //        }
    //        if (this.verbose) {
    //            console.log("handleRestResponse:\n", this.id, method, url, response.status, response.statusText, "\nResponse:\n", responseHeaders, "\n", responseBody, "\n");
    //        }
    //        this.handleErrors(response.status, response.statusText, url, method, responseHeaders, responseBody, json, requestHeaders, requestBody);
    //        this.defaultErrorHandler(response.status, response.statusText, url, method, responseHeaders, responseBody, json);
    //        return (json || responseBody);
    //    });
    //}
};
