'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { DECIMAL_PLACES } = require ('./base/functions/number');
const { ExchangeError, InvalidOrder, BadRequest, InsufficientFunds, OrderNotFound, ArgumentsRequired } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bitclude extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bitclude',
            'name': 'Bitclude',
            'countries': ['PL'],
            'rateLimit': 2000,
            'certified': false,
            'pro': false,
            'urls': {
                'api': {
                    'public': 'https://api.bitclude.com/',
                    'private': 'https://api.bitclude.com/',
                },
                'www': 'https://bitclude.com',
                'doc': 'https://docs.bitclude.com',
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': false,
                'uid': true,
            },
            'has': {
                'fetchMarkets': 'emulated',
                'fetchCurrencies': false,
                'cancelAllOrders': false,
                'fetchClosedOrders': false,
                'createDepositAddress': true,
                'fetchDepositAddress': 'emulated',
                'fetchDeposits': true,
                'fetchFundingFees': false,
                'fetchMyTrades': false,
                'fetchOHLCV': false,
                'fetchOpenOrders': true,
                'fetchOrder': false,
                'fetchOrderBook': true,
                'fetchOrders': false,
                'fetchTickers': true,
                'fetchTrades': true,
                'fetchTradingFees': false,
                'fetchWithdrawals': false,
                'withdraw': false,
            },
            'api': {
                'public': {
                    'get': [
                        'stats/ticker.json',
                        'stats/orderbook_{base}{quote}.json',
                        'stats/history_{base}{quote}.json',
                    ],
                },
                'private': {
                    'get': [
                        '',
                    ],
                },
            },
            'exceptions': {
                // stolen, todo rewrite
                'exact': {
                    'Not enough balances': InsufficientFunds, // {"error":"Not enough balances","success":false}
                    'InvalidPrice': InvalidOrder, // {"error":"Invalid price","success":false}
                    'Size too small': InvalidOrder, // {"error":"Size too small","success":false}
                    'Missing parameter price': InvalidOrder, // {"error":"Missing parameter price","success":false}
                    'Order not found': OrderNotFound, // {"error":"Order not found","success":false}
                },
                'broad': {
                    'Invalid parameter': BadRequest, // {"error":"Invalid parameter start_time","success":false}
                    'The requested URL was not found on the server': BadRequest,
                    'No such coin': BadRequest,
                    'No such market': BadRequest,
                    'An unexpected error occurred': ExchangeError, // {"error":"An unexpected error occurred, please try again later (58BC21C795).","success":false}
                },
            },
            'precisionMode': DECIMAL_PLACES, // todo
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetStatsTickerJson (params);
        const result = [];
        const ids = Object.keys (response);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const [ baseId, quoteId ] = id.split ('_');
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = (base + '/' + quote);
            const precision = {
                'price': undefined,
                'amount': undefined,
            };
            const info = {};
            info[id] = this.safeValue (response, id);
            const entry = {
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': true,
                'precision': precision, // todo
                'limits': undefined, // this exchange have user-specific limits
                'info': info,
            };
            result.push (entry);
        }
        return result;
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        symbols = (symbols === undefined) ? this.symbols : symbols;
        const tickers = await this.publicGetStatsTickerJson (params);
        const marketIds = Object.keys (this.marketsById);
        const result = {};
        for (let i = 0; i < marketIds.length; i++) {
            const marketId = marketIds[i];
            const market = this.marketsById[marketId];
            const symbol = market['symbol'];
            const ticker = this.safeValue (tickers, marketId);
            if (this.inArray (symbol, symbols)) {
                result[symbol] = this.parseTicker (ticker, market);
            }
        }
        return result;
    }

    async fetchTicker (symbol, params = {}) {
        const ticker = await this.fetchTickers ([symbol]);
        return this.safeValue (ticker, symbol);
    }

    parseTicker (ticker, market) {
        const timestamp = this.milliseconds ();
        const symbol = market['symbol'];
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'max24H'),
            'low': this.safeFloat (ticker, 'min24H'),
            'bid': this.safeFloat (ticker, 'bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'ask'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': this.safeFloat (ticker, 'last'),
            'last': this.safeFloat (ticker, 'last'),
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': undefined,
            'quoteVolume': undefined,
            'info': ticker,
        };
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        // todo idk what do with limit
        await this.loadMarkets ();
        const market = this.market (symbol);
        const [ baseId, quoteId ] = market['id'].split ('_');
        const request = {
            'base': baseId,
            'quote': quoteId,
        };
        const response = await this.publicGetStatsOrderbookBaseQuoteJson (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        const timestamp = this.safeTimestamp (data, 'timestamp');
        return this.parseOrderBook (response, timestamp, 'bids', 'asks', 1, 0); // todo check if correct
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'base': market['baseId'],
            'quote': market['quoteId'],
        };
        const response = await this.publicGetStatsHistoryBaseQuoteJson (this.extend (request, params));
        const trades = this.safeValue (response, 'history');
        return this.parseTrades (trades, market, since, limit);
    }

    parseTrade (trade, market) {
        const id = this.safeString (trade, 'nr');
        const timestamp = this.safeTimestamp (trade, 'time');
        const type = undefined;
        let side = this.safeString (trade, 'type');
        if (side === 'a') {
            // todo ensure
            side = 'sell';
        } else if (side === 'b') {
            side = 'buy';
        }
        const price = this.safeFloat (trade, 'price');
        const amount = this.safeFloat (trade, 'amount');
        let cost = undefined;
        if (price !== undefined) {
            if (amount !== undefined) {
                cost = price * amount;
            }
        }
        const fee = undefined;
        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': market['symbol'],
            'type': type,
            'order': undefined,
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
        const request = {
            'method': 'account',
            'action': 'info',
        };
        const response = await this.privateGet (this.extend (request, params));
        const result = {
            'info': response,
        };
        const balances = this.safeValue (response, 'balances', []);
        const currencies = Object.keys (balances);
        for (let i = 0; i < currencies.length; i++) {
            const balance = this.safeValue (balances, currencies[i]);
            const currencyCode = this.safeCurrencyCode (currencies[i]);
            const account = this.account ();
            account['free'] = this.safeFloat (balance, 'active');
            account['used'] = this.safeFloat (balance, 'inactive');
            result[currencyCode] = account;
        }
        return this.parseBalance (result);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        if (type === 'limit') {
            const request = {
                'method': 'transactions',
                'action': side, // "buy" or "sell"
                'market1': market['baseId'],
                'market2': market['quoteId'],
                'amount': this.numberToString (amount), // amount in base currency todo check
                'rate': this.numberToString (price), // todo check
            };
            const response = await this.privateGet (this.extend (request, params));
            const order = this.safeValue (response, 'actions');
            const orderId = this.safeString (order, 'order');
            const timestamp = this.milliseconds ();
            return {
                'id': orderId,
                'clientOrderId': undefined,
                'timestamp': timestamp,
                'datetime': this.iso8601 (timestamp),
                'lastTradeTimestamp': undefined,
                'status': undefined, // todo idk maybe open
                'symbol': market['symbol'],
                'type': type,
                'side': side,
                'price': price,
                'amount': amount,
                'filled': undefined,
                'remaining': undefined,
                'cost': undefined,
                'fee': undefined,
                'trades': undefined,
                'info': response,
            };
        }
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'method': 'account',
            'action': 'activeoffers',
        };
        const response = await this.privateGet (this.extend (request, params));
        const result = this.safeValue (response, 'offers', []);
        let orders = this.parseOrders (result, undefined, since, limit);
        if (symbol !== undefined) {
            orders = this.filterBy (orders, 'symbol', symbol);
        }
        return orders;
    }

    parseOrder (order, market = undefined) {
        const status = 'open'; // hardcoded shit
        let side = this.safeString (order, 'offertype');
        if (side === 'ask') {
            // todo ensure
            side = 'sell';
        } else if (side === 'bid') {
            side = 'buy';
        }
        let symbol = undefined;
        if (market === undefined) {
            const baseId = this.safeString (order, 'currency1');
            const quoteId = this.safeString (order, 'currency2');
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            symbol = (base + '/' + quote);
        } else {
            symbol = market['symbol'];
        }
        const timestamp = this.safeTimestamp (order, 'timeopen');
        return {
            'info': order,
            'id': this.safeString (order, 'nr'),
            'clientOrderId': undefined,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': undefined, // todo: limit I guess
            'side': side,
            'price': this.safeFloat (order, 'price'),
            'amount': this.safeFloat (order, 'amount'),
            'remaining': undefined,
            'filled': undefined,
            'status': status,
            'fee': undefined,
            'cost': undefined,
            'trades': undefined,
        };
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        const side_in_params = ('side' in params);
        if (!side_in_params) {
            throw new ArgumentsRequired (this.id + ' cancelOrder requires a `side` parameter (sell or buy)');
        }
        const side = (params['side'] === 'buy') ? 'bid' : 'ask';
        params = this.omit (params, [ 'side', 'currency' ]);
        const request = {
            'method': 'transactions',
            'action': 'cancel',
            'order': parseInt (id),
            'typ': side,
        };
        return await this.privateGet (this.extend (request, params));
    }

    cancelUnifiedOrder (order, params = {}) {
        // https://github.com/ccxt/ccxt/issues/6838
        const request = {
            'side': order['side'],
        };
        return this.cancelOrder (order['id'], undefined, this.extend (request, params));
    }

    async createDepositAddress (code, params = {}) {
        // not yet documented exchange api method
        await this.loadMarkets ();
        const currencyId = this.currencyId (code);
        const request = {
            'method': 'account',
            'action': 'newaddress',
            'currency': currencyId,
        };
        const response = await this.privateGet (this.extend (request, params));
        const address = this.safeString (response, 'address');
        // waiting for documentation
        // const tag = this.safeString
        this.checkAddress (address);
        return {
            'currency': code,
            'address': address,
            'info': response,
        };
    }

    async fetchDepositAddress (code, params = {}) {
        await this.loadMarkets ();
        let currencyId = this.currencyId (code);
        currencyId = currencyId.toUpperCase ();
        const request = {
            'method': 'account',
            'action': 'info',
        };
        const response = await this.privateGet (this.extend (request, params));
        const deposits = this.safeValue (response, 'deposit');
        const deposit = this.safeValue (deposits, currencyId);
        const address = this.safeString (deposit, 'deposit');
        this.checkAddress (address);
        return {
            'currency': code,
            'address': address,
            'info': response,
        };
    }

    async fetchDeposits (code = undefined, since = undefined, limit = undefined, params = {}) {
        if (code === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchDeposits requires a currency code argument');
        }
        await this.loadMarkets ();
        const currency = this.currency (code);
        const currencyId = currency['id'];
        const request = {
            'method': 'account',
            'action': 'deposits',
            'currency': currencyId,
        };
        const response = await this.privateGet (this.extend (request, params));
        const transactions = this.safeValue (response, 'history', []);
        return this.parseTransactions (transactions, currency);
    }

    async fetchWithdrawals (code = undefined, since = undefined, limit = undefined, params = {}) {
        if (code === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchDeposits requires a currency code argument');
        }
        await this.loadMarkets ();
        const currency = this.currency (code);
        const currencyId = currency['id'];
        const request = {
            'method': 'account',
            'action': 'withdrawals',
            'currency': currencyId,
        };
        const response = await this.privateGet (this.extend (request, params));
        const transactions = this.safeValue (response, 'history', []);
        return this.parseTransactions (transactions, currency);
    }

    parseTransaction (transaction, currency = undefined) {
        //
        // fetchDeposits
        //
        //     {
        //       "time": "1530883428",
        //       "amount": "0.13750000",
        //       "type": "b787400027b4eae298bad72150384540a23342daaa3eec1c8d17459c103c6bbc",
        //       "state": "1"
        //     }
        //
        // fetchWithdrawals
        //
        //     {
        //         "time": "1528715035",
        //         "amount": "1.00000000",
        //         "tx": "01b8ae6437843879574b69daf95542aff43a4aefaa90e8f70ebf572eccf01cad",
        //         "address": "2N8hwP1WmJrFF5QWABn38y63uYLhnJYJYTF",
        //         "state": "0"
        //     },
        //
        const timestamp = this.safeInteger (transaction, 'time');
        const currencyCode = this.safeString (currency, 'code');
        const amount = this.safeFloat (transaction, 'amount');
        const address = this.safeString (transaction, 'address');
        const status = this.safeString (transaction, 'state'); // todo
        const txid = this.safeString2 (transaction, 'type', 'tx');
        return {
            'info': transaction,
            'id': undefined,
            'currency': currencyCode,
            'amount': amount,
            'address': address,
            'tag': undefined,
            'status': status,
            'type': undefined,
            'updated': undefined,
            'txid': txid,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'fee': undefined,
        };
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const request = '/' + this.implodeParams (path, params);
        let url = this.urls['api'][api] + request;
        if (api === 'private') {
            this.checkRequiredCredentials ();
            params['id'] = this.uid;
            params['key'] = this.apiKey;
        }
        if (Object.keys (params).length) {
            url += '?' + this.urlencode (params);
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
