"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Author: Nathan Rajlich
 * https://github.com/TooTallNate
 *
 * Author: Ben West
 * https://github.com/bewest
 *
 * Advisor: Scott Hanselman
 * http://www.hanselman.com/blog/BridgingDexcomShareCGMReceiversAndNightscout.aspx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @description: Logs in to Dexcom Share servers and reads blood glucose values.
 */
const ms_1 = __importDefault(require("ms"));
const querystring_1 = __importDefault(require("querystring"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const async_retry_1 = __importDefault(require("async-retry"));
const pluralize_1 = __importDefault(require("pluralize"));
const debug_1 = __importDefault(require("debug"));
const MS_PER_MINUTE = ms_1.default('1m');
const debug = debug_1.default('dexcom-share');
const sleep = (n) => new Promise((r) => setTimeout(r, n));
const parseDate = (d) => {
    const m = /Date\((.*)\)/.exec(d);
    return m ? parseInt(m[1], 10) : 0;
};
// Defaults
const Defaults = {
    applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db',
    agent: 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
    login: 'https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName',
    accept: 'application/json',
    'content-type': 'application/json',
    LatestGlucose: 'https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues',
};
class AuthorizeError extends Error {
    constructor(data) {
        let message = data;
        let name = 'AuthorizeError';
        const matches = data.match(/\S+='(.*?)'/g);
        if (matches) {
            const content = matches.find((m) => m.startsWith('Content='));
            if (content) {
                const parsed = JSON.parse(content.substring(9, content.length - 1));
                message = parsed.errors
                    .join(' ')
                    .replace(/([a-z])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`);
                if (!message.endsWith('.')) {
                    message += '.';
                }
            }
            const key = matches.find((m) => m.startsWith('Key='));
            if (key) {
                name = key.substring(5, key.length - 1).replace('SSO_', '');
            }
        }
        super(message);
        this.name = name;
    }
}
// Login to Dexcom's server.
function authorize(opts) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const url = Defaults.login;
        const payload = {
            password: opts.password,
            applicationId: opts.applicationId || Defaults.applicationId,
            accountName: opts.username || opts.accountName,
        };
        const headers = {
            'User-Agent': Defaults.agent,
            'Content-Type': Defaults['content-type'],
            Accept: Defaults.accept,
        };
        debug('POST %s', url);
        const res = yield node_fetch_1.default(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        const body = yield res.json();
        if (!res.ok || body === '00000000-0000-0000-0000-000000000000') {
            throw new AuthorizeError((_a = body.Message) !== null && _a !== void 0 ? _a : 'Invalid username or password');
        }
        debug('Session ID: %o', body);
        return body;
    });
}
exports.authorize = authorize;
function getLatestReadings(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const q = {
            sessionID: opts.sessionID,
            minutes: opts.minutes || 1440,
            maxCount: opts.maxCount || 1,
        };
        const url = `${Defaults.LatestGlucose}?${querystring_1.default.stringify(q)}`;
        const headers = {
            'User-Agent': Defaults.agent,
            Accept: Defaults.accept,
        };
        debug('POST %s', url);
        const res = yield node_fetch_1.default(url, {
            method: 'POST',
            headers,
        });
        if (!res.ok) {
            throw new Error(`${res.status} HTTP code`);
        }
        const readings = yield res.json();
        for (const reading of readings) {
            reading.Date = parseDate(reading.WT);
        }
        return readings;
    });
}
function login(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        return async_retry_1.default((bail) => __awaiter(this, void 0, void 0, function* () {
            debug('Fetching new token');
            try {
                return yield authorize(opts);
            }
            catch (err) {
                if (err instanceof AuthorizeError) {
                    bail(err);
                    return '';
                }
                throw err;
            }
        }), {
            retries: 10,
            onRetry(err) {
                debug('Error refreshing token %o', err);
            },
        });
    });
}
function _read(state, _opts = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!state.sessionId) {
            state.sessionId = login(state.config);
        }
        const opts = Object.assign({ maxCount: 1000, minutes: 1440, sessionID: yield state.sessionId }, _opts);
        const latestReadingDate = state.latestReading
            ? state.latestReading.Date
            : 0;
        try {
            const readings = (yield getLatestReadings(opts))
                .filter((reading) => reading.Date > latestReadingDate)
                .sort((a, b) => a.Date - b.Date);
            return readings;
        }
        catch (err) {
            debug('Read error: %o', err);
            state.sessionId = null;
            throw err;
        }
    });
}
function _wait({ latestReading, config: { waitTime }, }) {
    return __awaiter(this, void 0, void 0, function* () {
        let diff = 0;
        if (latestReading) {
            diff = latestReading.Date + waitTime - Date.now();
            if (diff > 0) {
                debug('Waiting for %o', ms_1.default(diff));
                yield sleep(diff);
            }
            else {
                debug('No wait because last reading was %o ago', ms_1.default(-diff + waitTime));
            }
        }
        return diff;
    });
}
/**
 * Async iterator interface. Waits until the next estimated time that a Dexcom
 * reading will be uploaded, then reads the latest value from the Dexcom servers
 * repeatedly until one with a newer timestamp than the latest is returned.
 */
function _createDexcomShareIterator(state) {
    return __asyncGenerator(this, arguments, function* _createDexcomShareIterator_1() {
        while (true) {
            yield __await(_wait(state));
            const readings = yield __await(async_retry_1.default(() => __awaiter(this, void 0, void 0, function* () {
                const opts = {};
                if (state.latestReading) {
                    const msSinceLastReading = Date.now() - state.latestReading.Date;
                    opts.minutes = Math.ceil(msSinceLastReading / MS_PER_MINUTE);
                }
                else {
                    opts.maxCount = 1;
                }
                const r = yield _read(state, opts);
                if (r.length === 0) {
                    throw new Error('No new readings yet');
                }
                return r;
            }), {
                retries: 1000,
                minTimeout: state.config.minTimeout,
                maxTimeout: state.config.maxTimeout,
                onRetry(err) {
                    debug('Retrying from error', err);
                },
            }));
            debug('Got %o new %s', readings.length, pluralize_1.default('reading', readings.length));
            for (const reading of readings) {
                const latestReadingDate = state.latestReading
                    ? state.latestReading.Date
                    : 0;
                if (reading.Date > latestReadingDate) {
                    state.latestReading = reading;
                    yield yield __await(reading);
                }
                else {
                    debug('Skipping %o because the latest reading is %o', reading.Date, latestReadingDate);
                }
            }
        }
    });
}
function createDexcomShareIterator(config) {
    const state = {
        config: Object.assign({
            minTimeout: ms_1.default('5s'),
            maxTimeout: ms_1.default('5m'),
            waitTime: ms_1.default('5m') + ms_1.default('10s'),
        }, config),
        latestReading: null,
        sessionId: null,
    };
    const iterator = _createDexcomShareIterator(state);
    /**
     * Reads `count` blood glucose entries from Dexcom's servers, without any
     * waiting. Advances the iterator such that the next call to `next()` will
     * wait until after the newest entry from this `read()` call.
     */
    iterator.read = function read(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const readings = yield _read(state, opts);
            if (readings && readings.length > 0) {
                debug('Read %o %s', readings.length, pluralize_1.default('reading', readings.length));
                state.latestReading = readings[readings.length - 1];
            }
            return readings;
        });
    };
    /**
     * Waits until 5 minutes (Dexcom records every 5 minutes), plus 10 seconds
     * (to allow some time for the new reading to be uploaded) since the latest
     * reading on this iterator.
     */
    iterator.wait = function wait() {
        return _wait(state);
    };
    /**
     * Resets the iterator.
     */
    iterator.reset = function reset() {
        state.latestReading = null;
    };
    return iterator;
}
(function (createDexcomShareIterator) {
    let Trend;
    (function (Trend) {
        Trend[Trend["None"] = 0] = "None";
        Trend[Trend["DoubleUp"] = 1] = "DoubleUp";
        Trend[Trend["SingleUp"] = 2] = "SingleUp";
        Trend[Trend["FortyFiveUp"] = 3] = "FortyFiveUp";
        Trend[Trend["Flat"] = 4] = "Flat";
        Trend[Trend["FortyFiveDown"] = 5] = "FortyFiveDown";
        Trend[Trend["SingleDown"] = 6] = "SingleDown";
        Trend[Trend["DoubleDown"] = 7] = "DoubleDown";
        Trend[Trend["NotComputable"] = 8] = "NotComputable";
        Trend[Trend["OutOfRange"] = 9] = "OutOfRange";
    })(Trend = createDexcomShareIterator.Trend || (createDexcomShareIterator.Trend = {}));
})(createDexcomShareIterator || (createDexcomShareIterator = {}));
exports.default = createDexcomShareIterator;
//# sourceMappingURL=index.js.map