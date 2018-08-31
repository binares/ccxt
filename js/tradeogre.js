'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const AuthenticationError = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class tradeogre extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'tradeogre',
            'name': 'Trade Ogre',
            'has': {
                'loadMarkets': true,
                'fetchMarkets': true,
                'fetchCurrencies': true,
                'fetchTicker': true,
                'fetchTickers': false,
                'fetchOrderBook': false,
                'fetchL2OrderBook': false,
                'fetchOHLCV': false,
                'fetchTrades': false,
                'fetchBalance': true,
                'createOrder': false,
                'cancelOrder': false,
                'fetchOrder': false,
                'fetchOrders': false,
                'fetchOpenOrders': false,
                'fetchClosedOrders': false,
                'fetchMyTrades': false,
                'deposit': false,
                'withdraw': false,
            },
            'urls': {
                'logo': 'https://tradeogre.com/img/logo.png',
                'api': {
                    'web': 'https://tradeogre.com',
                    'public': 'https://tradeogre.com/api/v1',
                    'private': 'https://tradeogre.com/api/v1',
                },
                'www': 'https://tradeogre.com',
                'doc': 'https://tradeogre.com/help/api',
                'fees': [
                    'https://tradeogre.com/help/fees',
                ],
            },
            'api': {
                'public': {
                    'get': [
                        'markets',
                        'orders',
                        'ticker',
                        'history',
                    ],
                },
                'private': {
                    'get': [
                        'account/order',
                        'account/balances',
                    ],
                    'post': [
                        'order/buy',
                        'order/sell',
                        'order/cancel',
                        'account/orders',
                        'account/balance',
                    ],
                },
            },
        });
    }

    async fetchMarkets () {
        let response = await this.publicGetMarkets ();
        let result = [];
        for (let i = 0; i < response.length; i++) {
            let market = response[i];
            let keys = Object.keys (market);
            let id = keys[0];
            let baseId = id.split ('-')[0];
            let quoteId = id.split ('-')[1];
            let base = this.commonCurrencyCode (baseId);
            let quote = this.commonCurrencyCode (quoteId);
            let symbol = base + '/' + quote;
            let entry = {
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': true,
                'precision': {
                    'price': 8,
                    'amount': undefined,
                    'cost': undefined,
                },
                'limits': {
                    'amount': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'price': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
                'info': market,
            };
            result.push (entry);
        }
        return result;
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        let response = await this.privateGetAccountBalances (params);
        if (!response['success'] && response['error'] === 'Must be authorized') {
            throw new AuthenticationError ('fetchBalance could not be authorized');
        }
        let result = { 'info': response };
        let balances = response['balances'];
        let currencies = Object.keys (balances);
        for (let i = 0; i < currencies.length; i++) {
            let currency = currencies[i];
            let balance = balances[currency];
            if (currency in this.currencies_by_id)
                currency = this.currencies_by_id[currency]['code'];
            let account = {
                'free': undefined,
                'used': undefined,
                'total': balance,
            };
            result[currency] = account;
        }
        return this.parseBalance (result);
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        let market = this.market (symbol);
        let response = await this.publicGetTicker (this.extend ({
            'symbol': market['id'],
        }, params));
        response['symbol'] = symbol;
        return this.parseTicker (response, market);
    }

    parseTicker (ticker, market = undefined) {
        return {
            'symbol': ticker['symbol'],
            'timestamp': undefined,
            'datetime': undefined,
            'high': this.safeFloat (ticker, 'high'),
            'low': this.safeFloat (ticker, 'low'),
            'bid': this.safeFloat (ticker, 'bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'ask'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': undefined,
            'last': undefined,
            'previousClose': this.safeFloat (ticker, 'initialprice'),
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeFloat (ticker, 'volume'),
            'quoteVolume': undefined,
            'info': ticker,
        };
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        if (!headers) {
            headers = {};
        }
        if (!body) {
            body = {};
        }
        let url = this.urls['api'][api];
        if (api === 'private') {
            this.checkRequiredCredentials ();
            let auth = this.encode (this.apiKey + ':' + this.secret);
            auth = this.stringToBase64 (auth);
            headers = { 'Authorization': 'Basic ' + this.decode (auth) };
        }
        url += '/' + path;
        if (path === 'ticker' && method === 'GET') {
            url += '/' + params['symbol'];
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
