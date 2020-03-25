'use strict';

//  ---------------------------------------------------------------------------

// const Exchange = require ('./base/Exchange');
const bitz = require ('./bitz');
const { ExchangeError, ArgumentsRequired, NotSupported } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bitzfu extends bitz {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bitzfu',
            'name': 'Bit-Z Futures',
            'has': {
                'createMarketOrder': true,
                'fetchClosedOrders': true,
                'fetchDeposits': false,
                'fetchMyTrades': true,
                'fetchOHLCV': true,
                'fetchOpenOrders': true,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchTickers': true,
                'fetchWithdrawals': false,
            },
            'timeframes': {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '4h': '4h',
                '1d': '1d',
            },
            'urls': {
                'api': {
                    'public': 'https://{hostname}',
                    'private': 'https://{hostname}',
                },
                'fees': 'https://swap.bitz.top/pub/fees',
            },
            'api': {
                'public': {
                    'get': [
                        '{}Coin',
                        '{}Kline',
                        '{}OrderBook',
                        '{}TradesHistory',
                        '{}Tickers',
                    ],
                },
                'private': {
                    'get': [
                        // '{}MyTrades', // this is should probably be POST instead
                    ],
                    'post': [
                        'add{}Trade',
                        'cancel{}Trade',
                        'get{}ActivePositions',
                        'get{}AccountInfo',
                        'get{}MyPositions',
                        'get{}OrderResult',
                        'get{}Order',
                        'get{}TradeResult',
                        'get{}MyHistoryTrade',
                        'get{}MyTrades',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': undefined,
                    'taker': undefined,
                },
            },
            'options': {
                'defaultLeverage': 1,
                'defaultIsCross': 1, // 1: cross, -1: isolated
            },
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetCoin (params);
        //
        //  {
        //      "status": 200,
        //      "msg": "",
        //      "data": [
        //          {
        //              "contractId": "101",                    // contract id
        //              "symbol": "BTC",                        // symbol
        //              "settleAnchor": "USDT",                 // settle anchor
        //              "quoteAnchor": "USDT",                  // quote anchor
        //              "contractAnchor": "BTC",                // contract anchor
        //              "contractValue": "0.00100000",          // contract face value
        //              "pair": "BTC_USDT",                     // pair
        //              "expiry": "0000-00-00 00:00:00",        // delivery day (non-perpetual contract)
        //              "maxLeverage": "100",                   // max leverage
        //              "maintanceMargin": "0.00500000",        // maintenance margin
        //              "makerFee": "-0.00030000",              // maker fee
        //              "takerFee": "0.00070000",               // taker fee
        //              "settleFee": "0.00070000",              // settlement fee
        //              "priceDec": "1",                        // floating point decimal of price
        //              "anchorDec": "2",                       // floating point decimal of quote anchor
        //              "status": "1",                          // status，1: trading, 0: pending, -1: permanent stop
        //              "isreverse": "-1",                      // 1:reverse contract，-1: forward contract
        //              "allowCross": "1",                      // Allow cross position，1:Yes，-1:No
        //              "allowLeverages": "2,5,10,15,20,50,100",// Leverage multiple allowed by the system
        //              "maxOrderNum": "50",                    // max order number
        //              "maxAmount": "5000",                    // min order amount
        //              "minAmount": "1",                       // min order amount
        //              "maxPositionAmount": "5000"             // max position amount
        //          }
        //      ],
        //      "time": 1562059174,
        //      "microtime": "0.05824800 1562059174",
        //      "source": "api"
        //  }
        //
        const markets = this.safeValue (response, 'data');
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            const id = this.safeString (market, 'contractId');
            const pairId = this.safeString (market, 'pair');
            const baseId = this.safeString (market, 'symbol');
            const quoteId = this.safeString (market, 'quoteAnchor');
            const maker = this.safeFloat (market, 'makerFee');
            const taker = this.safeFloat (market, 'takerFee');
            let base = baseId.toUpperCase ();
            let quote = quoteId.toUpperCase ();
            base = this.safeCurrencyCode (base);
            quote = this.safeCurrencyCode (quote);
            const symbol = base + '/' + quote;
            const precision = {
                'amount': this.safeInteger (market, 'anchorDec'),
                'price': this.safeInteger (market, 'priceDec'),
            };
            const active = (this.safeInteger (market, 'status') === 1);
            const isReverse = (this.safeInteger (market, 'isreverse') === 1);
            const type = isReverse ? 'swap' : 'future';
            const future = (type === 'future');
            const swap = (type === 'swap');
            result.push ({
                'info': market,
                'id': id,
                'pairId': pairId,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'spot': false,
                'future': future,
                'swap': swap,
                'prediction': false,
                'type': type,
                'taker': taker,
                'maker': maker,
                'active': active,
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': this.safeFloat (market, 'minAmount'),
                        'max': this.safeFloat (market, 'maxAmount'),
                    },
                    'price': {
                        'min': Math.pow (10, -precision['price']),
                        'max': undefined,
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
            });
        }
        return result;
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privatePostGetAccountInfo (params);
        //
        //  {
        //      "status": 200,
        //      "msg": "",
        //      "data": {
        //          "time": 1557928650,                     // time
        //          "estimate_BTC": "8.00667445",           // Total Equity(BTC)
        //          "estimate_USDT": "17000.00",            // Total Equity(USDT)
        //          "estimate_CNY": "0.00"                  // Total Equity (CNY)
        //          "balances": [
        //              {
        //                  "coin": "BTC",                  // coin
        //                  "balance": "8.00000000",        // balance
        //                  "positionMargin": "0.00635670", // position margin
        //                  "orderMargin": "0.00000000",    // order margin
        //                  "unrlzPnl": "0.00031774",       // unrealized  profits and losses
        //                  "total": "8.00667445",          // total evaluation of the coin
        //                  "estimate_BTC": "8.00667445",   // total evaluation(BTC)
        //                  "estimate_USDT": "0.00",        // total evaluation(USDT)
        //                  "estimate_CNY": "0.00"          // total evaluation (CNY)
        //              },
        //              ...
        //          ]
        //      },
        //      "time": 1533035297,
        //      "microtime": "0.41892000 1533035297",
        //      "source": "api"
        //  }
        //
        const balances = this.safeValue (response['data'], 'balances');
        const result = { 'info': response };
        for (let i = 0; i < balances.length; i++) {
            const balance = balances[i];
            const currencyId = this.safeString (balance, 'coin');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['used'] = undefined;
            account['total'] = this.safeFloat (balance, 'balance');
            account['free'] = undefined;
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    parseTicker (ticker, market = undefined) {
        //
        //  {
        //        "contractId": "101",                      // contract ID
        //        "pair": "BTC_USD",                        // pair
        //        "min": "8550.0",                          // 24H lowest price
        //        "max": "8867.5",                          // 24H highest price
        //        "latest": "8645.0",                       // latest price
        //        "change24h": "-0.0248",                   // 24H change
        //        "amount": "286231.00",                    // amount
        //        "volumn": "2502462.46",                   // volumn
        //        "baseAmount": "286.231 BTC",              // amount(BTC)
        //        "quoteVolumn": "2502462.46 USDT",         // amount(USDT)
        //        "openInterest": "10110336.00",            // open interest
        //        "baseOpenInterest": "10110.34 BTC",       // open interest(BTC)
        //        "quoteOpenInterest": "89623073.47 USDT",  // open interest(USDT)
        //        "indexPrice": "8065.25",                  // index price
        //        "fairPrice": "8060.09",                   // fair price
        //        "nextFundingRate": "-0.00075000"          // next funding rate
        //  }
        //
        const timestamp = undefined;
        let symbol = undefined;
        if (market === undefined) {
            const marketId = this.safeString (ticker, 'contactId');
            market = this.safeValue (this.markets_by_id, marketId);
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const last = this.safeFloat (ticker, 'latest');
        let percentage = this.safeFloat (ticker, 'change24h');
        let open = undefined;
        let change = undefined;
        let average = undefined;
        if ((percentage !== undefined) && (last !== undefined) && (symbol !== undefined)) {
            open = parseFloat (this.priceToPrecision (symbol, last / (1 + percentage)));
            change = parseFloat (this.priceToPrecision (symbol, last - open));
            average = this.sum(open, last) / 2;
        }
        if (percentage !== undefined) {
            percentage *= 100;
        }
        let baseVolume = undefined;
        let quoteVolume = undefined;
        const baseAmount = this.safeString (ticker, 'baseAmount');
        const quoteAmount = this.safeString (ticker, 'quoteVolumn');
        if (baseAmount !== undefined) {
            const baseVolumeLoc = baseAmount.indexOf(' ');
            if (baseVolumeLoc !== -1) {
                baseVolume = parseFloat (baseAmount.slice (0, baseVolumeLoc));
            }
        }
        if (quoteAmount !== undefined) {
            const quoteVolumeLoc = quoteAmount.indexOf(' ');
            if (quoteVolumeLoc !== -1) {
                quoteVolume = parseFloat (quoteAmount.slice (0, quoteVolumeLoc));
            }
        }
        let vwap = undefined;
        if (quoteVolume !== undefined) {
            if (baseVolume !== undefined) {
                if (baseVolume > 0) {
                    vwap = quoteVolume / baseVolume;
                }
            }
        }
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'max'),
            'low': this.safeFloat (ticker, 'min'),
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
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

    async fetchTicker (symbol, params = {}) {
        const tickers = await this.fetchTickers([ symbol ]);
        const ticker = this.safeValue (tickers, symbol);
        if (ticker === undefined) {
            throw new ExchangeError (this.id + ' - ticker ' + symbol + ' could not be fetched');
        }
        return ticker;
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {};
        if ((symbols !== undefined) && (symbols.length === 1)) {
            const id = this.marketId (symbols[0]);
            request['contractId'] = parseInt (id);
        }
        const response = await this.publicGetTickers (this.extend (request, params));
        //
        //  {
        //    "status": 200,
        //    "msg": "",
        //    "data": [{
        //        "contractId": "101",                      // contract ID
        //        "pair": "BTC_USD",                        // pair
        //        "min": "8550.0",                          // 24H lowest price
        //        "max": "8867.5",                          // 24H highest price
        //        "latest": "8645.0",                       // latest price
        //        "change24h": "-0.0248",                   // 24H change
        //        "amount": "286231.00",                    // amount
        //        "volumn": "2502462.46",                   // volumn
        //        "baseAmount": "286.231 BTC",              // amount(BTC)
        //        "quoteVolumn": "2502462.46 USDT",         // amount(USDT)
        //        "openInterest": "10110336.00",            // open interest
        //        "baseOpenInterest": "10110.34 BTC",       // open interest(BTC)
        //        "quoteOpenInterest": "89623073.47 USDT",  //open interest(USDT)
        //        "indexPrice": "8065.25",                  //index price
        //        "fairPrice": "8060.09",                   //fair price
        //        "nextFundingRate": "-0.00075000"          //next funding rate
        //      },
        //      ...
        //    ],
        //    "time": 1573813113,
        //    "microtime": "0.23065700 1573813113",
        //    "source": "api"
        //  }
        //
        const tickers = this.safeValue (response, 'data');
        const timestamp = this.parseMicrotime (this.safeString (response, 'microtime'));
        const result = {};
        for (let i = 0; i < tickers.length; i++) {
            let ticker = tickers[i];
            const id = this.safeString (ticker, 'contractId');
            const pairId = this.safeString (ticker, 'pair');
            let market = undefined;
            if (id in this.markets_by_id) {
                market = this.markets_by_id[id];
            }
            ticker = this.parseTicker (ticker, market);
            let symbol = ticker['symbol'];
            if (symbol === undefined) {
                if (market !== undefined) {
                    symbol = market['symbol'];
                } else {
                    const [ baseId, quoteId ] = pairId.split ('_');
                    const base = this.safeCurrencyCode (baseId);
                    const quote = this.safeCurrencyCode (quoteId);
                    symbol = base + '/' + quote;
                }
            }
            if ((symbol !== undefined) && ((symbols === undefined) || this.inArray (symbol, symbols))) {
                result[symbol] = this.extend (ticker, {
                    'timestamp': timestamp,
                    'datetime': this.iso8601 (timestamp),
                });
            }
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        //  Parameter 	    Required    Type 	Comment
        //  contractId 	    Yes 	    int 	Contract ID
        //  depth 	        no 	        string 	Depth type 5, 10, 15, 20, 30, 100,,default10
        const request = {
            'contractId': parseInt (this.marketId (symbol)),
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.publicGetOrderBook (this.extend (request, params));
        //  {
        //      "status":200,
        //      "msg":"",
        //      "data":{
        //            "bids":[
        //              {
        //                 "price": "8201.32",
        //                 "amount": "2820"
        //              },
        //              ...
        //          ],
        //          "asks":[
        //              {
        //                  "price": "8202.14",
        //                  "amount": "4863"
        //              },
        //              ...
        //          ]
        //      }
        //      "time": 1532671288,
        //      "microtime": "0.23065700 1532671288",
        //      "source": "api"
        //  }
        const orderbook = this.safeValue (response, 'data');
        const timestamp = this.parseMicrotime (this.safeString (response, 'microtime'));
        return this.parseOrderBook (orderbook, timestamp, 'bids', 'asks', 'price', 'amount');
    }

    parseTrade (trade, market = undefined) {
        //
        // fetchTrades (public)
        //
        //      {
        //          "time": 1558432920,                 // timestamp
        //          "price": "7926.41",                 // price
        //          "num": 7137,                        // number
        //          "type": "buy"                       // type : "buy" / "sell"
        //      }
        //
        // fetchMyTrades (private)
        //
        //      {
        //          "tradeId": "6534702673362395142",   // Deal ID
        //          "contractId": "1",                  // Contract ID
        //          "pair": "BTC_USD",                  // Contract Market
        //          "price": "8000.00",                 // Transaction Price
        //          "num": "500",                       // Number of transactions
        //          "type": "buy",                      // Type of transaction
        //          "tradeFee": "0.00001250",           // Transaction charges
        //          "leverage": "10",                   // Gearing
        //          "isCross": "-1",                    // Whether the warehouse is full or not，1:Yes,-1:No
        //          "time": 1557994526                  // Dealing time
        //      }
        //
        const id = this.safeString (trade, 'tradeId');
        let timestamp = this.safeTimestamp (trade, 'time');
        const contractId = this.safeString (trade, 'contractId');
        const pairId = this.safeString (trade, 'pair');
        let symbol = undefined;
        if ((market === undefined) && (contractId !== undefined)) {
            market = this.safeValue (this.markets_by_id, contractId);
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        } else if ((symbol === undefined) && (pairId !== undefined)) {
            const [ baseId, quoteId ] = pairId.split ('_');
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            symbol = base + '/' + quote;
        }
        const side = this.safeString (trade, 'type');
        const price = this.safeFloat (trade, 'price');
        const amount = this.safeFloat (trade, 'num');
        const cost = amount;
        let fee = undefined;
        if (market !== undefined) {
            const tradeFee = this.safeFloat (trade, 'tradeFee');
            if (tradeFee !== undefined) {
                const [ base, quote ] = symbol.split ('_');
                const currency = market['swap'] ? base : quote;
                fee = {
                    'amount': tradeFee,
                    'currency': currency,
                };
            }
        }
        return {
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'id': id,
            'order': undefined,
            'type': 'limit',
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
            'info': trade,
        };
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        //  Parameter 	    Required 	Type 	Comment
        //  contractId 	    Yes 	    int 	Contract ID
        //  pageSize 	    No 	        int 	Get data volume range:10-300 default 10
        const request = {
            'contractId': parseInt (market['id']),
        };
        if (limit !== undefined) {
            request['pageSize'] = Math.min (Math.max (limit, 10), 300);
        }
        const response = await this.publicGetTradesHistory (this.extend (request, params));
        //  {
        //      "status": 200,
        //      "msg": "",
        //      "data": {
        //            "lists": [
        //              {
        //                  "time": 1558432920,     //timestamp
        //                  "price": "7926.41",     //price
        //                  "num": 7137,            // number
        //                  "type": "buy"           // type
        //              }
        //          ]
        //      }
        //      "time": 1532671288,
        //      "microtime": "0.23065700 1532671288",
        //      "source": "api"
        //  }
        const lists = this.safeValue (response['data'], 'lists');
        if (lists === undefined) {
            return [];
        }
        return this.parseTrades (lists, market, since, limit);
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        //  [
        //      "1558433100000",        // time
        //      "7921.69000000",        // opening price
        //      "7921.96000000",        // highest price
        //      "7882.31000000",        // lowest price
        //      "7882.31000000",        // closing price
        //      "1793940.00000000",     // volume
        //      "14183930623.27000000"  // turnover
        //  ]
        return [
            parseInt (ohlcv[0]),
            parseFloat (ohlcv[1]),
            parseFloat (ohlcv[2]),
            parseFloat (ohlcv[3]),
            parseFloat (ohlcv[4]),
            parseFloat (ohlcv[5]),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        //
        //  Parameter 	Required 	Type 	    Comment
        //  contractId 	Yes 	    int 	    Contract ID
        //  type 	    Yes 	    string 	    K line type 1m, 5m, 15m, 30m, 1h, 4h, 1d，default5m
        //  size 	    No 	        int 	    Get data volume 1-300, default 300
        //
        const request = {
            'contractId': parseInt (market['id']),
            'type': this.timeframes[timeframe],
        };
        if (limit !== undefined) {
            request['size'] = Math.min (limit, 300); // 1-300
        }
        const response = await this.publicGetKline (this.extend (request, params));
        //  {
        //      "status": 200,
        //      "msg": "",
        //      "data": {
        //            "lists": [
        //              [
        //                  "1558433100000",        //time
        //                  "7921.69000000",        //opening price
        //                  "7921.96000000",        //highest price
        //                  "7882.31000000",        //lowest price
        //                  "7882.31000000",        //closing price
        //                  "1793940.00000000",     //volume
        //                  "14183930623.27000000"  //turnover
        //              ]
        //          ]
        //      }
        //      "time": 1532671288,
        //      "microtime": "0.23065700 1532671288",
        //      "source": "api"
        //  }
        const lists = this.safeValue (response['data'], 'lists', undefined);
        if (lists === undefined) {
            return [];
        }
        return this.parseOHLCVs (lists, market, timeframe, since, limit);
    }

    parseOrderStatus (status) {
        const statuses = {
            '-1': 'canceled',
            '0': 'open',
            '1': 'closed',
        };
        return this.safeString (statuses, status, status);
    }

    parseOrder (order, market = undefined) {
        //
        // fetchOrders
        //
        //      {
        //          "orderId": "734709",    // orderID
        //          "contractId": "101",    // contract ID
        //          "amount": "500",        // amount
        //          "price": "7500.00",     // price
        //          "type": "limit",        // type，limit: limit order，market: market order
        //          "leverage": "10",       // leverage
        //          "direction": "1",       // direction，1:long，-1:short
        //          "orderStatus": "0",     // status，0:unfinished，1:finished，-1:cancelled
        //          "isCross": "-1",        // Is Cross，1:Yes,-1:No
        //          "available": "500",     // available order 
        //          "time": 1557994750,     // time
        //          "pair": "BTC_USD"       // pair
        //      }
        //
        const id = this.safeString (order, 'orderId');
        let symbol = undefined;
        if (market === undefined) {
            const marketId = this.safeString (order, 'contractId');
            const market = this.safeValue (this.markets_by_id, marketId);
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const type = this.safeString (order, 'type');
        let side = this.safeInt (order, 'direction');
        if (side !== undefined) {
            side = (side === 1) ? 'buy' : 'sell';
        }
        const price = this.safeFloat (order, 'price');
        const amount = this.safeFloat (order, 'amount');
        const remaining = this.safeFloat (order, 'available');
        let filled = undefined;
        if ((amount !== undefined) && (remaining !== undefined)) {
            filled = Math.max (0, amount - remaining);
        }
        let timestamp = this.safeInteger (order, 'time');
        if (timestamp !== undefined) {
            timestamp *= 1000;
        }
        let cost = undefined;
        if ((price !== undefined) && (filled !== undefined) && (market !== undefined)) {
            if (market['swap']) {
                cost = filled;
            } else {
                cost = filled * price;
            }
        }
        const status = this.parseOrderStatus (this.safeString (order, 'orderStatus'));
        return {
            'id': id,
            'datetime': this.iso8601 (timestamp),
            'timestamp': timestamp,
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'cost': cost,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'trades': undefined,
            'fee': undefined,
            'info': order,
        };
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        //
        //  Parameter 	Required    Type 	Comment
        //  contractId 	Yes 	    int 	Contract ID
        //  price 	    No 	        float 	Price，if type is market，delivery of Price is not required.
        //  amount 	    Yes 	    int 	Amount
        //  leverage 	Yes 	    float 	Leverage
        //  direction 	Yes 	    int 	Direction 1: long；-1: short
        //  type 	    Yes 	    string 	Tpye limit: limited order; market: market price order, require lowercase string
        //  isCross 	    Yes 	    int 	Cross Margin or not 1: Cross Margin，-1：Isolated Margin
        //
        const market = this.market (symbol);
        const ordDirection = (side === 'buy') ? 1 : -1;
        const request = {
            'contractId': parseInt (market['id']),
            'amount': this.amountToPrecision (symbol, amount),
            'leverage': this.options['defaultLeverage'],
            'direction': ordDirection,
            'type': type,
            'isCross': this.options['defaultIsCross'],
        };
        if (price !== undefined) {
            request['price'] = price;
        }
        const response = await this.privatePostAddTrade (this.extend (request, params));
        //
        //  {
        //      "status": 200,
        //      "msg": "",
        //      "data":{
        //           "orderId": 710370
        //      },
        //      "time": 1533035297,
        //      "microtime": "0.41892000 1533035297",
        //      "source": "api"
        //  }
        //
        const timestamp = this.parseMicrotime (this.safeString (response, 'microtime'));
        const order = {
            'symbol': symbol,
            'timestamp': timestamp,
            'id': this.safeInteger (response['data'], 'orderId'),
        };
        return this.parseOrder (order, market);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'entrustSheetId': this.safeInteger (id),
        };
        const response = await this.privatePostCancelTrade (this.extend (request, params));
        //
        //  {
        //      "status": 200,
        //      "msg": "",
        //      "data": {
        //
        //      },
        //      "time": 1533035297,
        //      "microtime": "0.41892000 1533035297",
        //      "source": "api"
        //  }
        //
        return response;
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'entrustSheetIds': id,
        };
        const response = await this.privatePostGetOrderResult (this.extend (request, params));
        // {
        //      "status":200,
        //      "msg":"",
        //      "data":{
        //          [
        //              "orderId": "734709",             // order ID
        //              "contractId": "101",             // contract ID
        //              "pair": "BTC_USD",               // pair
        //              "amount": "500",                 // amount
        //              "price": "7500.00",              // price
        //              "type": "limit",                 // type，limit: limit order，market: market order
        //              "leverage": "10",                // leverage
        //              "direction": "1",                // direction，1:long，-1:short
        //              "orderStatus": "-1",             // status，0:unfinished，1:finished，-1:cancelled
        //              "available": "500",              // available order
        //              "time": 1557994750               // time
        //          ]
        //      },
        //      "time": 1533035297,
        //      "microtime": "0.41892000 1533035297",
        //      "source": "api"
        //  }
        const orders = this.safeValue (response, 'data');
        if ((orders === undefined) || (orders.length === 0)) {
            throw new ExchangeError (this.id + ' - order ' + id + ' could not be fetched');
        }
        return this.parseOrder (orders[0]);
    }

    async fetchOrdersWithMethod (method, symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOpenOrders requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'contractId': parseInt (market['id']),
        };
        if (method === 'privatePostGetMyHistoryTrade') {
            request['page'] = 1; // required integer, 1-10
            if (limit !== undefined) {
                request['pageSize'] = limit;
            } else {
                request['pageSize'] = 50; // required integer, max 50
            }
        }
        const response = await this[method] (this.extend (request, params));
        //
        //  {
        //      "status": 200,
        //      "msg": "",
        //      "data": [
        //           {
        //             "orderId": "734709",             // orderID
        //              "contractId": "101",            // contract ID
        //              "amount": "500",                // amount
        //              "price": "7500.00",             // price
        //              "type": "limit",                // type，limit: limit order，market: market order
        //              "leverage": "10",               // leverage
        //              "direction": "1",               // direction，1:long，-1:short
        //              "orderStatus": "0",             // status，0:unfinished，1:finished，-1:cancelled
        //              "isCross": "-1",                // Is Cross，1:Yes,-1:No
        //              "available": "500",             // available order 
        //              "time": 1557994750,             // time
        //              "pair": "BTC_USD"               // pair
        //          }
        //      ],
        //      "time": 1533035297,
        //      "microtime": "0.41892000 1533035297",
        //      "source": "api"
        //  }
        //
        const orders = this.safeValue (response['data'], 'data', []);
        return this.parseOrders (orders, undefined, since, limit);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchOrdersWithMethod ('privatePostGetMyHistoryTrade', symbol, since, limit, params);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        return await this.fetchOrdersWithMethod ('privatePostGetOrder', symbol, since, limit, params);
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const allOrders = await this.fetchOrdersWithMethod ('privatePostGetMyHistoryTrade', symbol, since, limit, params);
        const orders = [];
        for (let i = 0; i < allOrders.length; i++) {
            const order = allOrders[i];
            if (order['status'] !== 'open') {
                orders.push (order);
            }
        }
        return orders;
    }
    
    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' - fetchMyTrades requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        //
        //  Parameter 	    Required 	Type 	Comment
        //  contractId 	    Yes 	    int 	Contract ID
        //  page 	        No 	        int 	Default 1 rang:1-10
        //  pageSize 	    No 	        int 	Default 50 rang:1-50
        //  createDate 	    No 	        int 	Date(Day), Default 7, currently only 7 or 30 are supported.
        //
        const request = {
            'contractId': parseInt (market['id']),
            'page': 1,
        };
        if (limit !== undefined) {
            request['pageSize'] = limit;
        }
        response = await this.privatePostGetMyTrades (this.extend (request, params));
        //
        //  {
        //      "status":200,
        //      "msg":"",
        //      "data": [
        //          {
        //              "tradeId": "6534702673362395142",   // Deal ID
        //              "contractId": "1",                  // Contract ID
        //              "pair": "BTC_USD",                  // Contract Market
        //              "price": "8000.00",                 // Transaction Price
        //              "num": "500",                       // Number of transactions
        //              "type": "buy",                      // Type of transaction
        //              "tradeFee": "0.00001250",           // Transaction charges
        //              "leverage": "10",                   // Gearing
        //              "isCross": "-1",                    // Whether the warehouse is full or not，1:Yes,-1:No
        //              "time": 1557994526                  // Dealing time
        //          }
        //      ],
        //      "time":1533035297,
        //      "microtime":"0.41892000 1533035297",
        //      "source":"api"
        //  }
        //
        const trades = this.safeValue (response, 'data');
        if (trades === undefined) {
            return [];
        }
        return this.parseTrades (trades, market, since, limit, params);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const baseUrl = this.implodeParams (this.urls['api'][api], { 'hostname': this.hostname });
        const prefix = (api === 'public') ? 'Market' : 'Contract';
        let suffix = this.implodeParams(path, {'': 'Contract'});
        if (method === 'GET') {
            suffix = 'get' + suffix;
        }
        let url = baseUrl + '/' + prefix + '/' + suffix;
        let query = undefined;
        if (api === 'public') {
            query = this.urlencode (params);
            if (query.length) {
                url += '?' + query;
            }
        } else {
            this.checkRequiredCredentials ();
            body = this.rawencode (this.keysort (this.extend ({
                'apiKey': this.apiKey,
                'timeStamp': this.seconds (),
                'nonce': this.nonce (),
            }, params)));
            body += '&sign=' + this.hash (this.encode (body + this.secret));
            headers = { 'Content-type': 'application/x-www-form-urlencoded' };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
