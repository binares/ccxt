'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { TICK_SIZE } = require ('./base/functions/number');
const { ExchangeError, AuthenticationError, OrderNotFound, InsufficientFunds, DDoSProtection } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bitforexfu extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bitforexfu',
            'name': 'Bitforex Futures',
            'countries': [ 'CN' ],
            // 'version': 'v1',
            'has': {
                'CORS': false,
                'createMarketOrder': false,
                'fetchTicker': false,
                'fetchTickers': false,
                'fetchOrderBook': false,
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
                '1m': '1min',
                '5m': '5min',
                '15m': '15min',
                '30m': '30min',
                '1h': '1hour',
                '2h': '2hour',
                '4h': '4hour',
                '12h': '12hour',
                '1d': '1day',
                '1w': '1week',
                '1M': '1month',
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/44310033-69e9e600-a3d8-11e8-873d-54d74d1bc4e4.jpg',
                'api': {
                    'public': 'https://www.bitforex.com/contract',
                    'private': 'https://www.bitforex.com/contract',
                },
                'www': 'https://www.bitforex.com',
                'doc': 'https://github.com/githubdev2020/API_Doc_en/wiki',
                'fees': 'https://help.bitforex.com/en_us/?cat=13',
                'referral': 'https://www.bitforex.com/en/invitationRegister?inviterId=1867438',
            },
            'api': {
                'public': {
                    'get': [
                        'swap/contract/listAll',
                        'mkapi/depth',
                        'mkapi/kline',
                    ],
                },
                'private': {
                    'post': [
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'maker': 0.1 / 100,
                    'taker': 0.1 / 100,
                },
                'funding': {
                    'tierBased': false,
                    'percentage': true,
                    'deposit': {},
                    'withdraw': {
                        'BTC': 0.0005,
                        'ETH': 0.01,
                        'BCH': 0.0001,
                        'LTC': 0.001,
                        'ETC': 0.005,
                        'USDT': 5,
                        'CMCT': 30,
                        'AION': 3,
                        'LVT': 0,
                        'DATA': 40,
                        'RHP': 50,
                        'NEO': 0,
                        'AIDOC': 10,
                        'BQT': 2,
                        'R': 2,
                        'DPY': 0.8,
                        'GTC': 40,
                        'AGI': 30,
                        'DENT': 100,
                        'SAN': 1,
                        'SPANK': 8,
                        'AID': 5,
                        'OMG': 0.1,
                        'BFT': 5,
                        'SHOW': 150,
                        'TRX': 20,
                        'ABYSS': 10,
                        'THM': 25,
                        'ZIL': 20,
                        'PPT': 0.2,
                        'WTC': 0.4,
                        'LRC': 7,
                        'BNT': 1,
                        'CTXC': 1,
                        'MITH': 20,
                        'TRUE': 4,
                        'LYM': 10,
                        'VEE': 100,
                        'AUTO': 200,
                        'REN': 50,
                        'TIO': 2.5,
                        'NGC': 1.5,
                        'PST': 10,
                        'CRE': 200,
                        'IPC': 5,
                        'PTT': 1000,
                        'XMCT': 20,
                        'ATMI': 40,
                        'TERN': 40,
                        'XLM': 0.01,
                        'ODE': 15,
                        'FTM': 100,
                        'RTE': 100,
                        'DCC': 100,
                        'IMT': 500,
                        'GOT': 3,
                        'EGT': 500,
                        'DACC': 1000,
                        'UBEX': 500,
                        'ABL': 100,
                        'OLT': 100,
                        'DAV': 40,
                        'THRT': 10,
                        'RMESH': 3,
                        'UPP': 20,
                        'SDT': 0,
                        'SHR': 10,
                        'MTV': 3,
                        'ESS': 100,
                        'MET': 3,
                        'TTC': 20,
                        'LXT': 10,
                        'XCLP': 100,
                        'LUK': 100,
                        'UBC': 100,
                        'DTX': 10,
                        'BEAT': 20,
                        'DEED': 2,
                        'BGX': 3000,
                        'PRL': 20,
                        'ELY': 50,
                        'CARD': 300,
                        'SQR': 15,
                        'VRA': 400,
                        'BWX': 3500,
                        'MAS': 75,
                        'FLP': 0.6,
                        'UNC': 300,
                        'CRNC': 15,
                        'MFG': 70,
                        'ZXC': 70,
                        'TRT': 30,
                        'ZIX': 35,
                        'XRA': 10,
                        'AMO': 1600,
                        'IPG': 3,
                        'uDoo': 50,
                        'URB': 30,
                        'ARCONA': 3,
                        'CRAD': 5,
                        'NOBS': 1000,
                        'ADF': 2,
                        'ELF': 5,
                        'LX': 20,
                        'PATH': 15,
                        'SILK': 120,
                        'SKYFT': 50,
                        'EDN': 50,
                        'ADE': 50,
                        'EDR': 10,
                        'TIME': 0.25,
                        'SPRK': 20,
                        'QTUM': 0.01,
                        'BF': 5,
                        'ZPR': 100,
                        'HYB': 10,
                        'CAN': 30,
                        'CEL': 10,
                        'ATS': 50,
                        'KCASH': 1,
                        'ACT': 0.01,
                        'MT': 300,
                        'DXT': 30,
                        'WAB': 4000,
                        'HYDRO': 400,
                        'LQD': 5,
                        'OPTC': 200,
                        'EQUAD': 80,
                        'LATX': 50,
                        'LEDU': 100,
                        'RIT': 70,
                        'ACDC': 500,
                        'FSN': 2,
                    },
                },
            },
            'exceptions': {
                '4004': OrderNotFound,
                '1013': AuthenticationError,
                '1016': AuthenticationError,
                '3002': InsufficientFunds,
                '10204': DDoSProtection,
            },
            'precisionMode': TICK_SIZE,
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetSwapContractListAll (params);
        //  {
        //    "data": [
        //      {
        //          id  10002
        //          symbol  "swap-usd-btc"
        //          baseSymbol  "BTC"
        //          quoteSymbol "USD"
        //          initMargins 0.01
        //          maintenanceMargins  0.005
        //          fundPreminumSymbol  "BTC"
        //          unitQuantity    1
        //          beginTime   1560648043415
        //          leverageLevel   100
        //          minOrderPrice   1e-8
        //          maxOrderPrice   1000000
        //          minOrderVolume  1
        //          maxOrderVolume  2000000
        //          maxUserVolume   5500000
        //          pricePrecision  2
        //          basePrecision   8
        //          openBuyLimitRate    0.01
        //          openSellLimitRate   0.01
        //          openBuyLimitRateMax 0.02
        //          openSellLimitRateMax    1000
        //          openBuyLimitRateMin 1
        //          openSellLimitRateMin    0.02
        //          feeRateMaker    0.0004
        //          feeRateTaker    0.0006
        //          fundPeriod  8
        //          isAutoReduce    true
        //          contractType    1
        //          dealNum 3
        //          deepJoinNum "2"
        //          minChangePrice  0.5
        //          alias   "BTC/USD"
        //          limitQuota  200000
        //          increaseLimitQuota  null
        //          status  "0"
        //          ctime   1560561643416
        //          mtime   1568855964408
        //          depthConfig "1,2,5,10,20"
        //          priceOrderPrecision 1
        //          baseShowPrecision   8
        //          depthOffset 10
        //          floatY  0.005
        //          riskRate    1
        //          outStatus   "0"
        //          inStatus    "0"
        //          currentPricePrecision   2
        //      }
        //    ]
        //  }
        const data = response['data'];
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const market = data[i];
            const id = this.safeString (market, 'symbol');
            const symbolParts = id.split ('-');
            const baseId = symbolParts[2];
            const quoteId = symbolParts[1];
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const active = true;
            const maker = this.safeFloat (market, 'feeRateMaker');
            const taker = this.safeFloat (market, 'feeRateTaker');
            const pricePrecision = this.safeInteger (market, 'priceOrderPrecision');
            const precision = {
                'amount': this.safeInteger (market, 'unitQuantity'),
                'price': Math.pow (10, -pricePrecision), // TICK_SIZE
            };
            const limits = {
                'amount': {
                    'min': this.safeFloat (market, 'minOrderVolume'),
                    'max': this.safeFloat (market, 'maxOrderVolume'),
                },
                'price': {
                    'min': this.safeFloat( market, 'minOrderPrice'),
                    'max': this.safeFloat( market, 'maxOrderPrice'),
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
                'maker': maker,
                'taker': taker,
                'type': 'swap',
                'spot': false,
                'swap': true,
                'future': false,
                'info': market,
            });
        }
        return result;
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        return [
            this.safeInteger (ohlcv, 'time'),
            this.safeFloat (ohlcv, 'open'),
            this.safeFloat (ohlcv, 'high'),
            this.safeFloat (ohlcv, 'low'),
            this.safeFloat (ohlcv, 'close'),
            this.safeFloat (ohlcv, 'vol'),
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'businessType': market['id'],
            'kType': this.timeframes[timeframe],
        };
        if (limit !== undefined) {
            request['size'] = limit; // default 1, max 600
        }
        const response = await this.publicGetMkapiKline (this.extend (request, params));
        const ohlcvs = this.safeValue (response, 'data', []);
        return this.parseOHLCVs (ohlcvs, market, timeframe, since, limit);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/' + this.implodeParams (path, params);
        const query = this.omit (params, this.extractParams (path));
        if (api === 'public') {
            if (Object.keys (query).length) {
                url += '?' + this.urlencode (query);
            }
        } else {
            this.checkRequiredCredentials ();
            let payload = this.urlencode ({ 'accessKey': this.apiKey });
            query['nonce'] = this.milliseconds ();
            if (Object.keys (query).length) {
                payload += '&' + this.urlencode (this.keysort (query));
            }
            // let message = '/' + 'api/' + this.version + '/' + path + '?' + payload;
            const message = '/' + path + '?' + payload;
            const signature = this.hmac (this.encode (message), this.encode (this.secret));
            body = payload + '&signData=' + signature;
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (typeof body !== 'string') {
            return; // fallback to default error handler
        }
        if ((body[0] === '{') || (body[0] === '[')) {
            const feedback = this.id + ' ' + body;
            const success = this.safeValue (response, 'success');
            if (success !== undefined) {
                if (!success) {
                    const code = this.safeString (response, 'code');
                    this.throwExactlyMatchedException (this.exceptions, code, feedback);
                    throw new ExchangeError (feedback);
                }
            }
        }
    }
};
