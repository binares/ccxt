'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, InvalidOrder, NotSupported } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class coinbene extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'coinbene',
            'name': 'CoinBene',
            'countries': [ 'CN', 'US' ],
            'version': 'v2',
            'rateLimit': 1500,
            'has': {
                'cancelOrders': true,
                'fetchClosedOrders': true,
                'fetchMyTrades': false,
                'fetchOHLCV': true,
                'fetchOpenOrders': true,
                'fetchOrder': true,
                'fetchTickers': true,
            },
            'timeframes': {
                '1m': '1',
                '3m': '3',
                '5m': '5',
                '15m': '15',
                '30m': '30',
                '1h': '60',
                '2h': '120',
                '4h': '240',
                '6h': '360',
                '12h': '720',
                '1d': 'D',
                '1w': 'W',
                '1M': 'M',
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
            'fees': {
                'trading': {
                    'tierBased': true,
                    'percentage': true,
                    'taker': 0.001,
                    'maker': 0.001,
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
            const slashedId = this.safeString (market, 'symbol').toUpperCase ();
            let base = undefined;
            let quote = undefined;
            let baseId = undefined;
            let quoteId = undefined;
            if (slashedId.indexOf ('/') >= 0) {
                const parts = slashedId.split('/');
                base = this.safeCurrencyCode (parts[0]);
                baseId = parts[0].toLowerCase ();
                quote = this.safeCurrencyCode (parts[1]);
                quoteId = parts[1].toLowerCase ();
            }
            const symbol = base + '/' + quote;
            const id = (baseId + quoteId).toUpperCase ();
            const precision = {
                'price': this.safeInteger (market, 'pricePrecision'),
                'amount': this.safeInteger (market, 'amountPrecision'),
            };
            const priceFluctuation = this.safeFloat (market, 'priceFluctuation');
            const limits = {
                'amount': {
                    'min': this.safeFloat (market, 'minAmount'),
                    'max': undefined,
                },
                'price': {
                    'min': undefined, // 1 - priceFluctuation,
                    'max': undefined, // 1 + priceFluctuation,
                },
            };
            limits['cost'] = {
                'min': undefined, // limits['amount']['min'] * limits['price']['min'],
                'max': undefined,
            };
            result.push ({
                'id': id,                // BTCUSDT
                'slashedId': slashedId,  // BTC/USDT
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

    parseSlashedId (slashedId) {
        // convert slashedId to id
        if (slashedId === undefined) {
            return undefined;
        } else if (slashedId.indexOf ('/') < 0) {
            return slashedId.toUpperCase ();
        } else {
            const split = slashedId.split ('/');
            return (split[0] + split[1]).toUpperCase ();
        }
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        if (limit === undefined) {
            limit = 10; // 5, 10, 50, 100. Default value 10
        }
        const request = {
            'symbol': market['slashedId'],
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

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['slashedId'],
        };
        const response = await this.publicGetMarketTickerOne (this.extend (request, params));
        return this.parseTicker (response['data'], market);
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        const response = await this.publicGetMarketTickerList (params);
        return this.parseTickers (response['data'], symbols);
    }

    parseTicker (ticker, market = undefined) {
        if (market === undefined) {
            const marketId = this.parseSlashedId (this.safeString (ticker, 'symbol'));
            market = this.safeValue (this.markets_by_id, marketId);
        }
        const last = this.safeFloat (ticker, 'latestPrice');
        let percentage = undefined;
        let open = undefined;
        let average = undefined;
        let change = undefined;
        const chg24h = this.safeString (ticker, 'chg24h');
        if (chg24h !== undefined && chg24h.indexOf ('%') >= 0) {
            const loc = chg24h.indexOf ('%');
            percentage = parseFloat (chg24h.slice (0, loc)) / 100;
            if (last !== undefined) {
                open = last / (1 + percentage);
                average = (open + last) / 2;
                change = last - open;
            }
        }
        return {
            'symbol': this.safeString (market, 'symbol'),
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
            'open': open,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': average,
            'percentage': percentage,
            'average': average,
            'baseVolume': undefined,
            'quoteVolume': this.safeFloat (ticker, 'volume24h'),
        };
    }

    parseTickers (rawTickers, symbols = undefined) {
        const tickers = [];
        for (let i = 0; i < rawTickers.length; i++) {
            tickers.push (this.parseTicker (rawTickers[i]));
        }
        return this.filterByArray (tickers, 'symbol', symbols);
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['slashedId'],
            'period': this.timeframes[timeframe],
        };
        if (since !== undefined) {
            request['start'] = parseInt (since / 1000);
        }
        const response = await this.publicGetMarketInstrumentsCandles (this.extend (request, params));
        return this.parseOHLCVs (response['data'], market, timeframe, since, limit);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            this.parse8601 (this.safeString (ohlcv, 0)),
            this.safeFloat (ohlcv, 1),
            this.safeFloat (ohlcv, 2),
            this.safeFloat (ohlcv, 3),
            this.safeFloat (ohlcv, 4),
            this.safeFloat (ohlcv, 5),
        ];
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': market['slashedId'],
        };
        const response = await this.publicGetMarketTrades (this.extend (request, params));
        return this.parseTrades (response['data'], market, since, limit);
    }

    parseTrade (trade, market = undefined) {
        let symbol = undefined;
        if (market === undefined) {
            const marketId = this.safeString (trade, 0);
            market = this.safeValue (this.markets_by_id, marketId);
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const price = this.safeFloat2 (trade, 1, 'price');
        // quantity = fill['quantity'];
        const amount = this.safeFloat2 (trade, 2, 'amount');
        const side = this.safeString2 (trade, 3, 'direction');
        const timestamp = this.parse8601 (this.safeString2 (trade, 4, 'tradeTime'));
        let cost = undefined;
        if (price !== undefined && amount !== undefined) {
            cost = price * amount;
        }
        let fee = undefined;
        const feeAmount = this.safeFloat (trade, 'fee');
        // feeByConi = fill['feeByConi'];
        if (feeAmount !== undefined) {
            fee = {
                'cost': feeAmount,
                'currency': this.safeString (market, 'quote'),
                'rate': undefined,
            };
        }
        return {
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'id': undefined,
            'order': undefined,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
        };
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privateGetAccountList (params);
        code = response['code'];
        if (code !== 200) {
            return response;
        }
        const result = { 'info': response };
        for (let i = 0; i < response['data'].length; i++) {
            const balance = response['data'][i];
            const currencyId = this.safeString (balance, 'asset');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['free'] = this.safeFloat (balance, 'available');
            account['used'] = this.safeFloat (balance, 'frozenBalance');
            account['total'] = this.safeFloat (balance, 'totalBalance');
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        if (!(type in this.options['orderTypes'])) {
            throw new InvalidOrder (this.id + ' - invalid order type');
        }
        const request = {
            'symbol': market['slashedId'],
            'direction': this.options['direction'][side],
            'price': price,
            'quantity': amount,
            'orderType': this.options['orderTypes'][type],
            'notional': undefined,
        };
        const response = await this.privatePostOrderPlace (this.extend (request, params));
        const code = response['code'];
        if (code !== 200) {
            return response;
        }
        const result = {};
        result['id'] = response['data']['orderId'];
        result['info'] = response['data'];
        return result;
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'orderId': id,
        };
        const response = await this.privateGetOrderInfo (this.extend (request, params));
        return this.parseOrder (response['data']);
    }

    async cancelOrder (id, params = {}) {
        await this.loadMarkets ();
        const request = {
            'orderId': id,
        };
        const response = await this.privatePostOrderCancel (this.extend (request, params));
        const code = response['code'];
        if (code !== 200) {
            return response;
        }
        return {
            'id' : id,
            'result': true,
        };
    }

    async cancelOrders (ids, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'orderIds': ids,
        };
        const response = await this.privatePostOrderBatchCancel (this.extend (request, params));
        //  {
        //      "code":200,
        //      "data":[
        //          {
        //              "orderId":"1980983481458700288",
        //              "code":"200",
        //              "message":""
        //          },
        //          {
        //              "orderId":"1980983581337661440",
        //              "code":"200",
        //              "message":""
        //          },
        //          {
        //              "orderId":"1924511943331438592",
        //              "code":"3004",
        //              "message":"The order does not exist, the cancellation of failure"
        //          }
        //      ]
        //  }
        return response;

    parseOrderStatus (status) {
        const statuses = {
            'Open': 'open',
            'Filled': 'closed',
            'Cancelled': 'canceled',
            'Partially cancelled': 'canceled', // partially filled and canceled
        };
        return this.safeString (statuses, status, status);
    }

    parseOrder (order, market = undefined) {
        const id = this.safeString (order, 'orderId');
        let symbol = undefined;
        const base = this.safeCurrencyCode (this.safeString (order, 'baseAsset'));
        const quote = this.safeCurrencyCode (this.safeString (order, 'quoteAsset'));
        const marketId = this.safeString (order, 'symbol');
        if (base !== undefined && quote !== undefined) {
            symbol = base + '/' + quote;
            if (symbol in this.markets) {
                market = this.markets[symbol];
            }
        }
        if (marketId in this.markets_by_id) {
            market = this.markets_by_id[marketId];
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const type = this.safeString (order, 'orderType');
        const side = this.safeString (order, 'orderDirection');
        const filled = this.safeFloat (order, 'filledQuantity');
        let amount = this.safeFloat (order, 'quantity');            // '0' for market order
        if (type === 'market' && amount === 0) {
            amount = filled;
        }
        let remaining = undefined;
        let cost = this.safeFloat (order, 'filledAmount');
        const takerFee = this.safeFloat (order, 'takerFeeRate');
        const makerFee = this.safeFloat (order, 'makerFeeRate');
        const average = this.safeFloat (order, 'avgPrice');         // '' always?
        let price = this.safeFloat (order, 'orderPrice');           // '0' for market order
        if (!price) {
           price = undefined;
        }
        if (filled !== undefined) {
            if (cost !== undefined && average === undefined && filled > 0) {
                average = cost / filled;
            }
            if (cost === undefined) {
                if (average !== undefined) {
                    cost = average * filled;
                } else if (price !== undefined) {
                    cost = price * filled;
                }
            }
            if (amount !== undefined) {
                remaining = amount - filled;
            }
        }
        const status = this.parseOrderStatus (this.safeString (order, 'orderStatus'));
        const timestamp = this.parse8601 (this.safeString (order, 'orderTime'));
        let fee = undefined;
        const feeAmount = this.safeFloat2 (order, 'fee', 'totalFee');
        if (feeAmount !== undefined) {
            fee = {
                'cost': feeAmount,
                'currency': this.safeString (market, 'quote'),
                'rate': undefined,
            };
        }
        return {
            'info': order,
            'id': id,
            'clientOrderId': undefined,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'amount': amount,
            'cost': cost,
            'average': average,
            'filled': filled,
            'remaining': remaining,
            'status': status,
            'fee': fee,
            'trades': undefined,
        };
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['symbol'] = market['slashedId'];
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.privateGetOrderOpenorders (this.extend (request, params));
        const orders = this.safeValue (response, 'data');
        if (orders === undefined) {
            return [];
        }
        return this.parseOrders (orders, market, since, limit);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['symbol'] = market['slashedId'];
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.privateGetOrderClosedorders (this.extend (request, params));
        const orders = this.safeValue (response, 'data');
        if (orders === undefined) {
            return [];
        }
        return this.parseOrders (orders, market, since, limit);
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        throw new NotSupported (this.id + ' - fetchMyTrades is not supported yet');
        // params required: 'orderId'
        // await this.loadMarkets ();
        // const response = await this.privateGetOrderTradeFills (params);
        // const code = response['code'];
        // if (code !== 200) {
        //     return response;
        // }
        // const trades = this.safeValue (response, 'data');
        // if (trades === undefined) {
        //     return [];
        // }
       //  return this.parseTrades (trades, market, since, limit);
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
                    const urlencodedQuery = '?' + this.urlencode (query);
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
            const signature = this.hmac (this.encode (auth), this.encode (this.secret));
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
                this.throwExactlyMatchedException (this.exceptions['exact'], message, feedback);
                this.throwBroadlyMatchedException (this.exceptions['broad'], message, feedback);
                throw new ExchangeError (feedback); // unknown message
            }
        }
    }
};
