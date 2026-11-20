var SAVE_V18_PLATFORM_KEYS = {
    ios: '3598gjjdtekelaw9',
    android: '3598gjjdtekelad9',
    pre_ios: '3598gjjdbeceead3',
    pre_android: '3598gjjdbeceead3',
    older: '3598gjjdchdidqz2',
    test: 'aaaabbbbccccdddd',
    oversea: '3598gjjdaecjjyc4',
    korea: '3598gjjdd3tczm6d',
    japan: '3598gjjdtekelad9',
    windows: 'windows0'
};
var SAVE_V183_DEVICE_MARKER_PATTERN = /@([A-Za-z0-9]{8})@/g;
var SAVE_V183_TRANSPORT_PREFIX = 'kjie00o0';
var SAVE_V183_INNER_KEY = 'hjo0e3q9po06ewkx';
var SAVE_V19_FILE_PATTERN = /^yanyu-@([A-Za-z0-9]{16})@-(\d{8})-(\d{6})-dat-v1\.9\.db$/;
var SAVE_V19_TRANSPORT_PREFIX = 'js9qf8me';
var SAVE_V19_INNER_KEY = 'jkds85wepo06ewkx';
var SAVE_NESTED_MARKER_MAP = Object.freeze({
    'kjie00o0': { knownVersions: ['00072280'] },
    'js9qf8me': { knownVersions: ['00072288'] },
    'nfidfug8': { knownVersions: ['00072294', '00073288'] },
    'tsidfug8': { knownVersions: ['00073288'] },
    // The exporter supplies the final getTest-derived outer key in the file name.
    // This marker does not imply that the server-issued inner version key is known.
    'cdexdmk5': { knownVersions: ['00073302'] },
    'dnkemiea': { knownVersions: ['00073314', '00073420'] }
});
var SAVE_NESTED_INNER_KEY_MAP = Object.freeze({
    '00072280': 'hjo0e3q9po06ewkx',
    '00072288': 'jkds85wepo06ewkx',
    '00072294': 'juhycd8epo06ewkx',
    '00073288': '90qabeonpo06ewkx',
    // Server m_tKeys[73302], validated against the real 20260908-161433 export.
    '00073302': 'njglp5lvpo06ewkx',
    // Server m_tKeys[73314], strictly validated against the real 20260915-133941 export.
    '00073314': 'jkimeiccpo06ewkx',
    // Server m_tKeys[73420], strictly validated against the real 20260928-110949 export.
    '00073420': 'n0b06b00po06ewkx'
});
var SAVE_V20_CHANNEL_INNER_KEYS = { '先行服': 'jkds85wecgkmi4cq' };
var SAVE_V20_CHANNELS = ['官服', '华为', '小米', '魅族', '九游', '4399', 'OPPO', '荣耀', 'Bilibili', '抖音', '国际服', '葫芦侠', '先行服', 'vivo', '应用宝'];
var SAVE_V20_FILE_PATTERN = /^yanyu-@([A-Za-z0-9]{16})@-@(官服|华为|小米|魅族|九游|4399|OPPO|荣耀|Bilibili|抖音|国际服|葫芦侠|先行服|vivo|应用宝)@-(\d{8})-(\d{6})-v2\.0\.db$/;
var SAVE_V20_FILE_SHAPE_PATTERN = /^yanyu-@([^@]*)@-@([^@]+)@-(\d{8})-(\d{6})-v2\.0\.db$/;
var SAVE_V21_FILE_PATTERN = /^yanyu-@([A-Za-z0-9]{16})@-@(官服|华为|小米|魅族|九游|4399|OPPO|荣耀|Bilibili|抖音|国际服|葫芦侠|先行服|vivo|应用宝)@-(\d{8})-(\d{6})-v2\.1(?:\.0)?\.yanyu$/;
var SAVE_V21_FILE_SHAPE_PATTERN = /^yanyu-@([^@]*)@-@([^@]+)@-(\d{8})-(\d{6})-v2\.1(?:\.0)?\.yanyu$/;
var SAVE_EXPORTER_RELEASES = Object.freeze(['2.1.4', '2.1.6', '2.1.7', '3.0.6']);
var SAVE_AUTH_CONTAINER_MAGIC = 'YANYU201';
var SAVE_AUTH_KDF_CONTEXT = 'yanyu-export-v2.0.1';
var SAVE_AUTH_KDF_ITERATIONS = 120000;
var SAVE_AUTH_SALT_BYTES = 16;
var SAVE_AUTH_NONCE_BYTES = 12;

// ---- v3.0 容器（观星 3.0.0+ / 导出器 v3.0.6）----
// 文件名：yanyu-<渠道>-<YYYYMMDD>-<HHMMSS>-<fileId 前 8 位>-v3.0.yanyu
// 内容：'YANYU301' + fileId(36 ASCII) + webToken(32 raw) + channelLen(1) + channel
//       + nonce(12) + AES-GCM( gzip(JSON) )，AAD = 头部全部字节
// contentKey 由官方授权服务下发；本工具只做解析，不伪造授权。
var SAVE_V30_CHANNELS = ['官服', '华为', '小米', '魅族', '九游', '4399', 'OPPO', '荣耀', 'Bilibili', '抖音', '国际服', '葫芦侠', '先行服', 'vivo', '应用宝'];
var SAVE_V30_FILE_PATTERN = /^yanyu-(官服|华为|小米|魅族|九游|4399|OPPO|荣耀|Bilibili|抖音|国际服|葫芦侠|先行服|vivo|应用宝)-(\d{8})-(\d{6})-([0-9a-f]{8})-v3\.0\.yanyu$/i;
var SAVE_V30_FILE_SHAPE_PATTERN = /^yanyu-([^-]+)-(\d{8})-(\d{6})-([0-9a-f]{0,8})-v3\.0\.yanyu$/i;
var SAVE_V30_CONTAINER_MAGIC = 'YANYU301';
var SAVE_V30_FILE_ID_BYTES = 36;
var SAVE_V30_WEB_TOKEN_BYTES = 32;
var SAVE_V30_NONCE_BYTES = 12;

// ---- 第三方「烟雨观星 4.0」明文导出容器（.yanyu，magic = YANYUPL1）----
// 结构：'YANYUPL1'(8) + version(1) + flags(1) + salt(16) + nonce(12)
//       + [codeTag(8)，仅 version=2] + AES-256-GCM( gzip(存档 JSON) )
// 密钥：PBKDF2-SHA256(SECRET[+ '\0' + 授权码], salt, 120000, 32)
// version=1 只有固定口令；version=2 需要导出时用的授权码。
var SAVE_PLAIN_YANYU_MAGIC = 'YANYUPL1';
var SAVE_PLAIN_YANYU_SECRET = 'yanyu-plain-export-v1|7f3c1d9a4e6b2085';
var SAVE_PLAIN_YANYU_ITERATIONS = 120000;

async function decryptPlainYanyuContainer(bytes, code) {
    if (!(typeof crypto !== 'undefined' && crypto.subtle)) {
        throw new Error('当前环境不支持 WebCrypto，无法解密 YANYUPL1 存档');
    }
    if (bytes.length < 8 + 2 + 16 + 12 + 16) throw new Error('YANYUPL1 存档长度异常');
    const version = bytes[8];
    const flags = bytes[9];
    if (version !== 1 && version !== 2) throw new Error('不支持的 YANYUPL1 版本：' + version);
    code = code ? String(code).trim() : '';
    if (version === 2 && !code) {
        throw new Error('这张 .yanyu 是带授权码的导出（YANYUPL1 v2），需要输入导出时的授权码才能解密');
    }
    const saltStart = 10;
    const nonceStart = saltStart + 16;
    const bodyStart = nonceStart + 12 + (version === 2 ? 8 : 0);
    if (bodyStart + 16 > bytes.length) throw new Error('YANYUPL1 存档头部损坏');
    const salt = bytes.slice(saltStart, nonceStart);
    const nonce = bytes.slice(nonceStart, nonceStart + 12);
    const body = bytes.slice(bodyStart);
    const material = new TextEncoder().encode(SAVE_PLAIN_YANYU_SECRET + (code ? '\u0000' + code : ''));
    const baseKey = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: SAVE_PLAIN_YANYU_ITERATIONS, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
    );
    let plain;
    try {
        plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body);
    } catch (error) {
        throw new Error(version === 2
            ? 'YANYUPL1 解密失败：授权码不对，或文件已损坏'
            : 'YANYUPL1 解密失败：文件已损坏或被改动过');
    }
    let out = new Uint8Array(plain);
    if (flags & 1) out = await _inflateGzip(out);
    let data;
    try {
        data = JSON.parse(new TextDecoder('utf-8').decode(out));
    } catch (error) {
        throw new Error('YANYUPL1 解密后不是有效 JSON：' + (error && error.message ? error.message : error));
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('YANYUPL1 解密结果不是存档对象');
    }
    return data;
}

// ---- 新服原始 dat.db（如 26 服「示例」00073460）----
// 结构：content = base64( 8位服务器ID + 平台密钥 XXTEA( zlib(JSON) ) )
// 与 v1.8 同族：外层多一层 base64、标记是纯数字服务器 ID、没有嵌套 base64 信封。
// 平台密钥即 SAVE_V18_PLATFORM_KEYS；服务器 ID 兼作存档版本号（73460）。
var SAVE_SERVERID_DB_PATTERN = /-解密存档-(\d{8})\.db$/;

function parseServerIdDbFileName(fileName) {
    const name = String(fileName || '');
    if (!/\.db$/i.test(name)) return null;
    const match = name.match(SAVE_SERVERID_DB_PATTERN);
    if (!match) return null;
    return { serverId: match[1], formatVersion: 'serverid' };
}

async function decryptServerIdSaveContent(contentText) {
    let layer1;
    try {
        layer1 = _b64ToBytesLocal(String(contentText || ''));
    } catch (e) {
        return null;
    }
    const marker = _bytesToAscii(layer1.slice(0, 8));
    if (!/^\d{8}$/.test(marker)) return null;
    const envelope = layer1.slice(8);
    for (const platform of ['android', 'ios', 'pre_android', 'pre_ios', 'oversea', 'korea', 'japan', 'older', 'test', 'windows']) {
        const compressed = decryptXXTEA(envelope, SAVE_V18_PLATFORM_KEYS[platform]);
        if (!compressed) continue;
        try {
            const decompressed = await _inflateZlib(compressed);
            const data = JSON.parse(new TextDecoder().decode(decompressed));
            if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
            return {
                data, platform, version: marker,
                formatVersion: '2.0', channel: null,
                transportMarker: marker,
                outerKeySource: 'platform-key'
            };
        } catch (e) { /* 换下一个平台密钥 */ }
    }
    return null;
}

function parseV19SaveFileName(fileName) {
    const match = String(fileName || '').match(SAVE_V19_FILE_PATTERN);
    if (!match) return null;
    return { outerKey: match[1], date: match[2], time: match[3], formatVersion: '1.9' };
}

function parseV20SaveFileName(fileName) {
    const match = String(fileName || '').match(SAVE_V20_FILE_PATTERN);
    if (!match) return null;
    return {
        outerKey: match[1], channel: match[2], date: match[3], time: match[4],
        formatVersion: '2.0'
    };
}

function parseV21SaveFileName(fileName) {
    const match = String(fileName || '').match(SAVE_V21_FILE_PATTERN);
    if (!match) return null;
    return {
        outerKey: match[1], channel: match[2], date: match[3], time: match[4],
        formatVersion: '2.1', container: 'yanyu201'
    };
}

function parseV30SaveFileName(fileName) {
    const match = String(fileName || '').match(SAVE_V30_FILE_PATTERN);
    if (!match) return null;
    return {
        channel: match[1], date: match[2], time: match[3],
        fileIdPrefix: String(match[4]).toLowerCase(),
        formatVersion: '3.0', container: 'yanyu301'
    };
}

function getV30SaveFileNameError(fileName) {
    const match = String(fileName || '').match(SAVE_V30_FILE_SHAPE_PATTERN);
    if (!match) return null;
    if (!SAVE_V30_CHANNELS.includes(match[1])) {
        return '未识别到渠道服。当前支持：' + SAVE_V30_CHANNELS.join('、');
    }
    if (!/^[0-9a-f]{8}$/i.test(match[4])) {
        return 'v3.0 文件名中的授权标识不是 8 位十六进制，请重新导出且不要修改文件名';
    }
    return null;
}

/* 解析 v3.0 容器头。返回各段偏移；header 不合法直接抛错。 */
function parseV30ContainerHeader(bytes, fileInfo) {
    const fixedLength = SAVE_V30_CONTAINER_MAGIC.length + SAVE_V30_FILE_ID_BYTES
        + SAVE_V30_WEB_TOKEN_BYTES + 1;
    if (!bytes || bytes.length < fixedLength + SAVE_V30_NONCE_BYTES + 16) {
        throw new Error('v3.0 加密存档不完整，请重新导出');
    }
    if (_bytesToAscii(bytes.slice(0, SAVE_V30_CONTAINER_MAGIC.length)) !== SAVE_V30_CONTAINER_MAGIC) {
        throw new Error('不是有效的 v3.0 加密存档');
    }
    const fileIdStart = SAVE_V30_CONTAINER_MAGIC.length;
    const fileIdEnd = fileIdStart + SAVE_V30_FILE_ID_BYTES;
    const fileId = _bytesToAscii(bytes.slice(fileIdStart, fileIdEnd)).toLowerCase();
    const webTokenStart = fileIdEnd;
    const webTokenEnd = webTokenStart + SAVE_V30_WEB_TOKEN_BYTES;
    const webToken = bytes.slice(webTokenStart, webTokenEnd);
    const channelLength = bytes[webTokenEnd];
    const channelStart = webTokenEnd + 1;
    const nonceStart = channelStart + channelLength;
    const cipherStart = nonceStart + SAVE_V30_NONCE_BYTES;
    if (channelLength < 1 || bytes.length < cipherStart + 16) throw new Error('v3.0 存档头无效');
    let channel;
    try {
        channel = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(channelStart, nonceStart));
    } catch (e) {
        throw new Error('v3.0 存档渠道信息无效');
    }
    if (!SAVE_V30_CHANNELS.includes(channel)
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(fileId)
        || !fileInfo || fileId.slice(0, 8) !== fileInfo.fileIdPrefix
        || channel !== fileInfo.channel) {
        throw new Error('v3.0 存档文件名与文件内容不匹配，请勿修改文件名');
    }
    return { fileId: fileId, webToken: webToken, channel: channel, nonceStart: nonceStart, cipherStart: cipherStart };
}

/* 读出 v3.0 文件里的授权凭证（fileId + webToken），供有官方授权服务时换取 contentKey。 */
async function readV30FileIdentity(file) {
    const fileInfo = parseV30SaveFileName(file && file.name);
    if (!fileInfo) return null;
    const prefix = new Uint8Array(await file.slice(0, 256).arrayBuffer());
    const header = parseV30ContainerHeader(prefix, fileInfo);
    return {
        fileId: header.fileId,
        webToken: _bytesToBase64(header.webToken),
        channel: header.channel,
        formatVersion: '3.0'
    };
}

async function decryptV30Container(bytes, fileInfo, contentKeyBase64) {
    const header = parseV30ContainerHeader(bytes, fileInfo);
    const keyBytes = _b64ToBytesLocal(contentKeyBase64 || '');
    if (keyBytes.length !== 32) {
        throw new Error('这是 v3.0 存档（YANYU301），它的密钥由观星官网在导入时联网签发，本工具不伪造授权、无法解密。'
            + '请让导出方改用 v2.1 格式导出，或直接把该文件拿到观星官网网页导入。');
    }
    const subtle = typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;
    if (!subtle) throw new Error('当前浏览器不支持本地安全解密，请使用最新版 Chrome 或 Edge');
    try {
        const key = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
        keyBytes.fill(0);
        const plain = await subtle.decrypt({
            name: 'AES-GCM',
            iv: bytes.slice(header.nonceStart, header.cipherStart),
            additionalData: bytes.slice(0, header.cipherStart),
            tagLength: 128
        }, key, bytes.slice(header.cipherStart));
        const decompressed = await _inflateGzip(new Uint8Array(plain));
        const jsonText = new TextDecoder('utf-8', { fatal: true }).decode(decompressed);
        const data = JSON.parse(jsonText);
        if (!data || typeof data !== 'object' || !data.MainRole
            || jsonText.indexOf('"BornTalent"') < 0 || !data.globalVariable) {
            throw new Error('invalid_save_json');
        }
        return {
            data: data, version: '3.0',
            platform: header.channel === '国际服' ? 'oversea' : 'android',
            channel: header.channel, formatVersion: '3.0', format: 'yanyu301'
        };
    } catch (error) {
        keyBytes.fill(0);
        throw new Error('v3.0 存档认证失败：授权无效、文件已损坏或文件名被修改');
    }
}

function parseV183SaveFileName(fileName) {
    const name = String(fileName || '');
    if (!/\.db$/i.test(name)) return null;
    if (/-v\d+(?:\.\d+)*\.(?:db|yanyu)$/i.test(name)) return null;
    const matches = Array.from(name.matchAll(SAVE_V183_DEVICE_MARKER_PATTERN));
    if (matches.length !== 1) return null;
    return { deviceCode: matches[0][1], formatVersion: '1.8.3' };
}

function getV20SaveFileNameError(fileName) {
    const match = String(fileName || '').match(SAVE_V20_FILE_SHAPE_PATTERN);
    if (!match) return null;
    if (!SAVE_V20_CHANNELS.includes(match[2])) {
        return '未识别到渠道服。当前支持：' + SAVE_V20_CHANNELS.join('、');
    }
    if (!/^[A-Za-z0-9]{16}$/.test(match[1])) {
        return '存档密钥不对。文件名中的解析码必须是 16 位字母或数字，请重新导出且不要修改文件名';
    }
    return null;
}

function getV21SaveFileNameError(fileName) {
    const match = String(fileName || '').match(SAVE_V21_FILE_SHAPE_PATTERN);
    if (!match) return null;
    if (!SAVE_V20_CHANNELS.includes(match[2])) {
        return '未识别到渠道服。当前支持：' + SAVE_V20_CHANNELS.join('、');
    }
    if (!/^[A-Za-z0-9]{16}$/.test(match[1])) {
        return '存档密钥不对。文件名中的解析码必须是 16 位字母或数字，请重新导出且不要修改文件名';
    }
    return null;
}

function detectSaveFileVersion(fileName) {
    if (parseV30SaveFileName(fileName)) return '3.0';
    if (parseV21SaveFileName(fileName)) return '2.1';
    if (parseV20SaveFileName(fileName)) return '2.0';
    if (parseV19SaveFileName(fileName)) return '1.9';
    if (parseV183SaveFileName(fileName)) return '1.8.3';
    if (parseServerIdDbFileName(fileName)) return '1.8';
    if (/\.db$/i.test(String(fileName || ''))) return '1.8';
    return null;
}

async function decryptAuthenticatedContainer(bytes, fileInfo, fileName) {
    const displayVersion = fileInfo && fileInfo.formatVersion ? fileInfo.formatVersion : '加密版';
    const headerLength = SAVE_AUTH_CONTAINER_MAGIC.length
        + SAVE_AUTH_SALT_BYTES + SAVE_AUTH_NONCE_BYTES;
    if (!bytes || bytes.length < headerLength + 16) {
        throw new Error(displayVersion + ' 加密存档不完整，请重新导出');
    }
    const magic = _bytesToAscii(bytes.slice(0, SAVE_AUTH_CONTAINER_MAGIC.length));
    if (magic !== SAVE_AUTH_CONTAINER_MAGIC) {
        throw new Error('不是有效的 ' + displayVersion + ' 加密存档，请勿修改文件内容或扩展名');
    }
    const subtle = typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null;
    if (!subtle) {
        throw new Error('当前浏览器不支持本地安全解密，请使用最新版 Chrome 或 Edge');
    }
    const saltStart = SAVE_AUTH_CONTAINER_MAGIC.length;
    const nonceStart = saltStart + SAVE_AUTH_SALT_BYTES;
    const cipherStart = nonceStart + SAVE_AUTH_NONCE_BYTES;
    const salt = bytes.slice(saltStart, nonceStart);
    const nonce = bytes.slice(nonceStart, cipherStart);
    const encrypted = bytes.slice(cipherStart);
    const password = new TextEncoder().encode(
        fileInfo.outerKey + '\0' + SAVE_AUTH_KDF_CONTEXT);
    try {
        const keyMaterial = await subtle.importKey(
            'raw', password, { name: 'PBKDF2' }, false, ['deriveKey']);
        const key = await subtle.deriveKey({
            name: 'PBKDF2', salt, iterations: SAVE_AUTH_KDF_ITERATIONS, hash: 'SHA-256'
        }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        password.fill(0);
        const plain = await subtle.decrypt({
            name: 'AES-GCM', iv: nonce,
            additionalData: new TextEncoder().encode(String(fileName || '')),
            tagLength: 128
        }, key, encrypted);
        return new Uint8Array(plain);
    } catch (error) {
        throw new Error(displayVersion + ' 存档认证失败：文件已被修改、文件名不匹配或存档密钥不正确');
    }
}


/* base64 -> Uint8Array
 * 优先用宿主 atob（快），但**校验返回长度**：某些环境（emscripten 初始化后、
 * 部分安卓 WebView）会把 atob 换成别的实现并静默返回错误数据。长度不符时
 * 走纯 JS 解码，保证存档解析不被环境污染断掉。 */
var _B64_LOOKUP = (function () {
    var table = new Int16Array(256).fill(-1);
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (var i = 0; i < chars.length; i++) table[chars.charCodeAt(i)] = i;
    return table;
})();

function _b64ToBytesLocal(b64) {
    b64 = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var expected = Math.floor(b64.length / 4) * 3;
    if (b64.slice(-2) === '==') expected -= 2;
    else if (b64.slice(-1) === '=') expected -= 1;

    if (typeof atob === 'function') {
        try {
            var bin = atob(b64);
            if (typeof bin === 'string' && bin.length === expected) {
                var bytes = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return bytes;
            }
        } catch (e) { /* 落到纯 JS 解码 */ }
    }

    var out = new Uint8Array(expected > 0 ? expected : 0);
    var bits = 0, acc = 0, o = 0;
    for (var j = 0; j < b64.length; j++) {
        var c = b64.charCodeAt(j);
        if (c === 61) break;                        // '='
        var v = c < 256 ? _B64_LOOKUP[c] : -1;
        if (v < 0) continue;
        acc = ((acc << 6) | v) & 0xffffff;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            if (o < out.length) out[o++] = (acc >> bits) & 0xff;
        }
    }
    return o === out.length ? out : out.slice(0, o);
}

function _bytesToAscii(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
}

function _bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    if (typeof btoa === 'function') return btoa(binary);
    return Buffer.from(bytes).toString('base64');
}

function _readSaveVersion(bytes) {
    if (!bytes || bytes.length < 8) return null;
    const version = _bytesToAscii(bytes.slice(0, 8));
    return /^\d{8}$/.test(version) ? version : null;
}


function _bytesToUint32LE(bytes) {
    const len = bytes.length;
    const copy = new Uint8Array(Math.ceil(len / 4) * 4);
    copy.set(bytes);
    const v = new Uint32Array(Math.ceil(len / 4));
    const view = new DataView(copy.buffer);
    for (let i = 0; i < v.length; i++) v[i] = view.getUint32(i * 4, true);
    return v;
}

function _uint32ToBytesLE(v) {
    const result = new Uint8Array(v.length * 4);
    const view = new DataView(result.buffer);
    for (let i = 0; i < v.length; i++) view.setUint32(i * 4, v[i], true);
    return result;
}

function _keyToUint32LE(key) {
    const keyBytes = new Uint8Array(16);
    const encoded = new TextEncoder().encode(key);
    for (let i = 0; i < Math.min(encoded.length, 16); i++) keyBytes[i] = encoded[i];
    return _bytesToUint32LE(keyBytes);
}

function decryptXXTEA(data, key) {
    try {
        if (!data || data.length === 0) return null;
        const v = _bytesToUint32LE(data);
        const k = _keyToUint32LE(key);
        const n = v.length;
        if (n < 2) return null;

        const rounds = 6 + Math.floor(52 / n);
        const delta = 0x9E3779B9;
        let sum = (rounds * delta) >>> 0;
        let y = v[0];
        let z, p, e;

        for (let i = 0; i < rounds; i++) {
            e = (sum >>> 2) & 3;
            for (p = n - 1; p > 0; p--) {
                z = v[p - 1];
                const mx = ((((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) >>> 0)
                    ^ ((((sum ^ y) + (k[(p & 3) ^ e] ^ z)) >>> 0));
                v[p] = (v[p] - mx) >>> 0;
                y = v[p];
            }
            z = v[n - 1];
            const mx = ((((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) >>> 0)
                ^ ((((sum ^ y) + (k[e] ^ z)) >>> 0));
            v[0] = (v[0] - mx) >>> 0;
            y = v[0];
            sum = (sum - delta) >>> 0;
        }

        const resultBytes = _uint32ToBytesLE(v);
        const origLen = new DataView(resultBytes.buffer, (n - 1) * 4, 4).getUint32(0, true);
        const maxLen = (n - 1) * 4;
        if (origLen > maxLen) return null;
        return resultBytes.slice(0, origLen);
    } catch (e) {
        return null;
    }
}


async function _inflateZlib(data) {
    /* pako 优先：部分 WebView/内核里 DecompressionStream 会静默失败或返回异常结果 */
    if (typeof pako !== 'undefined' && pako.inflate) {
        try {
            const out = pako.inflate(data);
            if (out && out.length) return out;
        } catch (e) { }
    }
    if (typeof DecompressionStream !== 'undefined') {
        try {
            const ds = new DecompressionStream('deflate');
            const stream = new Blob([data]).stream().pipeThrough(ds);
            const buf = await new Response(stream).arrayBuffer();
            return new Uint8Array(buf);
        } catch (e) { }
    }
    throw new Error('当前环境不支持 zlib 解压（需 DecompressionStream 或 pako）');
}

async function _inflateGzip(data) {
    if (typeof DecompressionStream !== 'undefined') {
        try {
            const ds = new DecompressionStream('gzip');
            const stream = new Blob([data]).stream().pipeThrough(ds);
            const buf = await new Response(stream).arrayBuffer();
            return new Uint8Array(buf);
        } catch (e) { }
    }
    if (typeof pako !== 'undefined' && pako.ungzip) return pako.ungzip(data);
    throw new Error('当前环境不支持 gzip 解压（需 DecompressionStream 或 pako）');
}


async function decryptSaveContent(contentText, outerKey, formatVersion, channel) {
    const content = String(contentText || '');
    const marker = content.slice(0, 8);
    if (!/^[A-Za-z0-9]{16}$/.test(String(outerKey || ''))
        || !Object.prototype.hasOwnProperty.call(SAVE_NESTED_MARKER_MAP, marker)) {
        return null;
    }

    let outerCipher;
    try {
        outerCipher = _b64ToBytesLocal(content.slice(marker.length));
    } catch (e) {
        if (marker === 'cdexdmk5' || marker === 'dnkemiea') throw _newSaveOuterKeyError(marker);
        return null;
    }
    const outerPlain = decryptXXTEA(outerCipher, outerKey);
    if (!outerPlain) {
        if (marker === 'cdexdmk5' || marker === 'dnkemiea') throw _newSaveOuterKeyError(marker);
        return null;
    }

    const nestedBase64 = _bytesToAscii(outerPlain);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nestedBase64)) {
        if (marker === 'cdexdmk5' || marker === 'dnkemiea') throw _newSaveOuterKeyError(marker);
        return null;
    }

    let innerEnvelope;
    try {
        innerEnvelope = _b64ToBytesLocal(nestedBase64);
    } catch (e) {
        if (marker === 'cdexdmk5' || marker === 'dnkemiea') throw _newSaveOuterKeyError(marker);
        return null;
    }
    const version = _readSaveVersion(innerEnvelope);
    if ((marker === 'cdexdmk5' || marker === 'dnkemiea')
        && (innerEnvelope.length < 16 || (innerEnvelope.length - 8) % 4 !== 0)) {
        throw _newSaveOuterKeyError(marker);
    }
    if (!version) {
        if (marker === 'cdexdmk5' || marker === 'dnkemiea') throw _newSaveOuterKeyError(marker);
        return null;
    }

    const knownInnerKey = (formatVersion === '2.0' || formatVersion === '2.1')
        && SAVE_V20_CHANNEL_INNER_KEYS[channel]
        ? SAVE_V20_CHANNEL_INNER_KEYS[channel]
        : SAVE_NESTED_INNER_KEY_MAP[version];
    // Preserve the historical fallback, but distinguish an unknown inner
    // version from a bad filename/exporter key once the outer layer is decoded.
    const innerKey = knownInnerKey || SAVE_V19_INNER_KEY;
    const compressed = decryptXXTEA(innerEnvelope.slice(8), innerKey);
    if (!compressed) {
        if (!knownInnerKey) throw _unsupportedSaveInnerVersionError(version, marker);
        return null;
    }

    try {
        const decompressed = await _inflateZlib(compressed);
        const data = JSON.parse(new TextDecoder().decode(decompressed));
        if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
        return {
            data, platform: 'android', version,
            formatVersion: formatVersion || '1.9', channel: channel || null,
            transportMarker: marker,
            outerKeySource: 'file-name'
        };
    } catch (e) {
        if (!knownInnerKey) throw _unsupportedSaveInnerVersionError(version, marker);
        return null;
    }
}

function _newSaveOuterKeyError(marker) {
    const error = new Error('新版存档外层解密失败：导出工具生成的解析码与存档不匹配，或文件已损坏。'
        + (marker === 'dnkemiea' ? '请使用 2.1.7 或后续兼容版本导出工具重新导出，不要手动修改文件名'
            : '请使用支持新版存档格式的导出工具重新导出，不要手动修改文件名'));
    error.code = 'SAVE_OUTER_KEY_MISMATCH';
    error.stage = 'outer';
    error.transportMarker = marker || 'cdexdmk5';
    return error;
}

function _unsupportedSaveInnerVersionError(version, marker) {
    const error = new Error('存档外层已解密成功，但当前模拟器尚未收录游戏存档版本 '
        + version + ' 的内层解密参数。请提供该版本的新导出存档用于适配，无需反复重命名或重新导出');
    error.code = 'SAVE_INNER_VERSION_UNSUPPORTED';
    error.stage = 'inner';
    error.version = version;
    error.transportMarker = marker;
    return error;
}

function _getV18PlatformOrder(version) {
    const versionNum = parseInt(version, 10) || 0;
    if (versionNum > 40318) {
        return ['ios', 'android', 'pre_ios', 'pre_android', 'test', 'oversea', 'korea', 'japan', 'older', 'windows'];
    }
    if (versionNum > 40098) return ['oversea', 'ios', 'android', 'older', 'windows'];
    if (versionNum > 5503) return ['older', 'ios', 'android', 'windows'];
    if (versionNum === 0) return ['windows'];
    return ['ios', 'android', 'pre_ios', 'pre_android', 'test', 'oversea', 'korea', 'japan', 'older', 'windows'];
}

async function _parseLegacyCompressedJson(compressed) {
    try {
        const decompressed = await _inflateZlib(compressed);
        const data = JSON.parse(new TextDecoder().decode(decompressed));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (e) {
        return null;
    }
}

async function decryptV18SaveContent(contentText) {
    let envelope;
    try {
        envelope = _b64ToBytesLocal(String(contentText || ''));
    } catch (e) {
        return null;
    }
    const version = _readSaveVersion(envelope);
    if (!version) return null;
    const cipher = envelope.slice(8);
    for (const platform of _getV18PlatformOrder(version)) {
        const compressed = decryptXXTEA(cipher, SAVE_V18_PLATFORM_KEYS[platform]);
        if (!compressed) continue;
        const data = await _parseLegacyCompressedJson(compressed);
        if (data) return { data, platform, version, formatVersion: '1.8' };
    }
    return null;
}

function buildV183OuterKeys(deviceCode, saveRow) {
    const device = String(deviceCode || '');
    const rowId = saveRow && saveRow.id != null ? String(saveRow.id).trim() : '';
    if (!/^[A-Za-z0-9]{8}$/.test(device) || rowId.length < 8) return [];

    const accountParts = [];
    const addAccount = value => {
        if (/^[A-Za-z0-9]{8}$/.test(value) && !accountParts.includes(value)) {
            accountParts.push(value);
        }
    };
    addAccount(rowId.slice(-8));
    addAccount(rowId.slice(0, 8));

    const keys = [];
    const addKey = value => {
        if (value.length === 16 && !keys.includes(value)) keys.push(value);
    };
    if (accountParts[0]) addKey(device + accountParts[0]);
    for (const account of accountParts) {
        addKey(account + device);
        addKey(device + account);
    }
    return keys;
}

async function _decryptV183InnerEnvelope(innerEnvelope) {
    const version = _readSaveVersion(innerEnvelope);
    if (!version) return null;
    const compressed = decryptXXTEA(innerEnvelope.slice(8), SAVE_V183_INNER_KEY);
    if (!compressed) return null;
    const data = await _parseLegacyCompressedJson(compressed);
    return data ? { data, platform: 'android', version, formatVersion: '1.8.3' } : null;
}

async function decryptV183SaveContent(contentText, outerKeys) {
    let content = String(contentText || '');
    if (content.startsWith(SAVE_V183_TRANSPORT_PREFIX)) {
        content = content.slice(SAVE_V183_TRANSPORT_PREFIX.length);
    }
    let outerCipher;
    try {
        outerCipher = _b64ToBytesLocal(content);
    } catch (e) {
        return null;
    }
    for (const outerKey of Array.isArray(outerKeys) ? outerKeys : []) {
        const outerPlain = decryptXXTEA(outerCipher, outerKey);
        if (!outerPlain) continue;
        const nestedBase64 = _bytesToAscii(outerPlain);
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nestedBase64)) continue;
        let innerEnvelope;
        try {
            innerEnvelope = _b64ToBytesLocal(nestedBase64);
        } catch (e) {
            continue;
        }
        const result = await _decryptV183InnerEnvelope(innerEnvelope);
        if (result) return result;
    }
    return null;
}


function _detectSaveFormat(bytes) {
    if (bytes.length >= 16
        && bytes[0] === 0x53 && bytes[1] === 0x51 && bytes[2] === 0x4C) {
        return 'sqlite';
    }
    if (bytes[0] === 0x7B || bytes[0] === 0xEF) {
        return 'json';
    }
    return 'unknown';
}

let _sqlWasmLoading = null;
function _loadSqlWasm() {
    if (typeof initSqlJsEmbed === 'function') return Promise.resolve();
    if (_sqlWasmLoading) return _sqlWasmLoading;
    const tag = Array.from(document.scripts).find(s => /shared\/save_decrypt\.js/.test(s.src));
    const base = tag ? tag.src.replace(/save_decrypt\.js.*$/, '') : '../shared/';
    const query = tag && tag.src.indexOf('?') >= 0 ? tag.src.slice(tag.src.indexOf('?')) : '';
    const load = src => new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.async = false;
        el.onload = () => resolve();
        el.onerror = () => reject(new Error('SQLite 模块加载失败：' + src));
        document.head.appendChild(el);
    });
    _sqlWasmLoading = load(base + 'sql-wasm.js' + query).then(() => load(base + 'sql-wasm-embed.js' + query));
    return _sqlWasmLoading;
}

async function _extractContentFromSqlite(bytes) {
    await _loadSqlWasm();
    if (typeof initSqlJsEmbed !== 'function') {
        throw new Error('SQLite 解析模块未加载（请确认网络可访问 sql-wasm.js 和 sql-wasm-embed.js）');
    }
    const SQL = await initSqlJsEmbed();
    const db = new SQL.Database(bytes);
    try {
        let stmt = db.prepare("SELECT content FROM save LIMIT 1");
        let row = stmt.step() ? stmt.getAsObject() : null;
        stmt.free();
        if (!row || !row.content) {
            const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            if (tables && tables[0]) {
                const names = tables[0].values.map(v => v[0]).filter(n => !/^sqlite_/i.test(n));
                for (const tname of names) {
                    try {
                        stmt = db.prepare("SELECT content FROM \"" + tname + "\" LIMIT 1");
                        if (stmt.step()) {
                            const r = stmt.getAsObject();
                            if (r.content) { row = r; row.__table = tname; break; }
                        }
                    } catch (e) { }
                    finally { stmt.free(); }
                }
            }
        }
        if (!row || !row.content) {
            throw new Error('SQLite 数据库里没找到 content 字段（save 表为空或不存在）');
        }
        let columns = null;
        let fullRow = null;
        try {
            const info = db.exec("PRAGMA table_info(\"" + (row.__table || 'save') + "\")");
            if (info && info[0]) columns = info[0].values.map(v => v[1]);
            const sel = db.exec("SELECT * FROM \"" + (row.__table || 'save') + "\" LIMIT 1");
            if (sel && sel[0]) {
                fullRow = {};
                const c = sel[0].columns;
                const v = sel[0].values[0];
                for (let i = 0; i < c.length; i++) fullRow[c[i].toLowerCase()] = v[i];
            }
        } catch (e) { }
        return { content: row.content, columns, row: fullRow };
    } finally {
        db.close();
    }
}

async function decryptSaveFile(file, requestedFormatVersion, authorization) {
    if (!file || typeof file.arrayBuffer !== 'function') {
        throw new Error('需要传入浏览器 File 对象');
    }
    const earlyBuf = new Uint8Array(await file.arrayBuffer());
    /* 第三方「烟雨观星 4.0」导出的 .yanyu（YANYUPL1）：本地解密后就是存档 JSON */
    if (_bytesToAscii(earlyBuf.slice(0, 8)) === SAVE_PLAIN_YANYU_MAGIC) {
        const plain = await decryptPlainYanyuContainer(
            earlyBuf,
            authorization && (authorization.plainCode || authorization.code),
        );
        const plainVersion = String(
            plain.DBVersion || plain.dbVersion || plain.Version || plain.SaveVersion || '',
        ).trim();
        return {
            data: plain,
            version: plainVersion || '3.3',
            platform: '',
            channel: '',
            format: 'yanyu-pl1',
        };
    }
    /* 先按魔数识别第三方 .gx 容器，避免被文件名规则误拦 */
    if (_bytesToAscii(earlyBuf.slice(0, 8)) === 'GXARCH33') {
        if (earlyBuf.length < 13) throw new Error('GXARCH33 存档长度异常，无法读取');
        const headerLength = ((earlyBuf[8] << 24) | (earlyBuf[9] << 16) | (earlyBuf[10] << 8) | earlyBuf[11]) >>> 0;
        const bodyStart = 12 + headerLength;
        if (!headerLength || bodyStart >= earlyBuf.length) {
            throw new Error('GXARCH33 存档头部损坏，无法定位正文');
        }
        let gxData;
        try {
            gxData = JSON.parse(new TextDecoder('utf-8').decode(earlyBuf.slice(bodyStart)));
        } catch (error) {
            throw new Error('GXARCH33 存档正文不是有效 JSON：' + (error && error.message ? error.message : error));
        }
        /* 存档正文里带 DBVersion（例：73460），它是序列规则的分水岭依据 */
        const gxVersion = String(gxData.DBVersion || gxData.dbVersion || gxData.Version || gxData.SaveVersion || '').trim();
        return { data: gxData, version: gxVersion || '3.3', platform: '', channel: '', format: 'gx' };
    }
    const modernFileInfo = parseV30SaveFileName(file.name) || parseV21SaveFileName(file.name)
        || parseV20SaveFileName(file.name) || parseV19SaveFileName(file.name)
        || parseServerIdDbFileName(file.name);
    const selectedVersion = requestedFormatVersion == null
        ? (getSelectedSaveFormatVersion() || 'auto') : String(requestedFormatVersion);
    let fileInfo = modernFileInfo;
    if (!fileInfo) {
        const v30FileNameError = getV30SaveFileNameError(file.name);
        if (v30FileNameError) throw new Error(v30FileNameError);
        const v21FileNameError = getV21SaveFileNameError(file.name);
        if (v21FileNameError) throw new Error(v21FileNameError);
        const v20FileNameError = getV20SaveFileNameError(file.name);
        if (v20FileNameError) throw new Error(v20FileNameError);
        if (selectedVersion === 'auto') {
            // 页面已取消「解析版本」下拉：这里按文件名自动判定。
            // 带 @设备码@ 的走 1.8.3；其余 .db 一律按 iOS / 旧版 dat.db 解析（1.8）。
            fileInfo = parseV183SaveFileName(file.name);
            if (!fileInfo) {
                if (!/\.db$/i.test(String(file.name || ''))) {
                    throw new Error('无法识别这个存档文件：请导入 dat.db、.db 或 .yanyu 文件');
                }
                fileInfo = { formatVersion: '1.8' };
            }
        } else if (selectedVersion === '1.8.3') {
            fileInfo = parseV183SaveFileName(file.name);
            if (!fileInfo) {
                throw new Error('1.8.3 存档文件名必须包含一对 8 位 @设备码@，并以 .db 结尾');
            }
        } else if (selectedVersion === '1.8') {
            if (!/\.db$/i.test(String(file.name || ''))) {
                throw new Error('1.8 仅支持直接导入 dat.db 或其他 .db SQLite 存档');
            }
            fileInfo = { formatVersion: '1.8' };
        } else {
            throw new Error('无法识别存档版本或文件名。请选择解析版本 v3.0 / v2.1 的 .yanyu 文件，或未改名的 v2.0 / v1.9 .db 文件；旧 dat.db 请先选择 1.8 或 1.8.3');
        }
    }
    let buf = earlyBuf;
    if (fileInfo.formatVersion === '3.0') {
        return decryptV30Container(buf, fileInfo, authorization && authorization.contentKey);
    }
    if (fileInfo.formatVersion === '2.1') {
        buf = await decryptAuthenticatedContainer(buf, fileInfo, file.name);
    }
    const fmt = _detectSaveFormat(buf);

    if (fmt !== 'sqlite') {
        throw new Error(fileInfo.formatVersion === '2.1'
            ? fileInfo.formatVersion + ' 容器解密后不是有效 SQLite 存档'
            : '仅支持导出工具生成的 SQLite 存档');
    }

    let content = null;
    let extra = {};
    const ext = await _extractContentFromSqlite(buf);
    content = ext.content;
    if (['cdexdmk5', 'dnkemiea'].includes(String(content).slice(0, 8))
        && (fileInfo.formatVersion === '1.8' || fileInfo.formatVersion === '1.8.3')) {
        throw new Error('这是新版加密原始存档，不能按 1.8 / 1.8.3 读取。'
            + '请使用支持新版存档格式的导出工具生成 .yanyu 文件，再选择 v2.1 导入');
    }
    extra.format = fileInfo.formatVersion === '2.1'
        ? 'yanyu201' : 'sqlite';
    extra.columns = ext.columns;
    // 只带轻量字段。`ext.row.content` 是整份存档正文（通常 1MB+），
    // 而它已经由 `r.data` 提供了；原样塞进 meta 会被写进
    // localStorage / window.name，把共享存储直接撑爆 —— 表现就是
    // "导入成功但切页后新页面看不到存档"。真正需要 row 的地方
    // （buildV183OuterKeys）只用到 row.id。
    extra.row = ext.row ? { id: ext.row.id, player: ext.row.player } : null;

    let r;
    if (fileInfo.formatVersion === 'serverid') {
        r = await decryptServerIdSaveContent(content);
        if (!r) {
            throw new Error('原始 dat.db 解析失败：内容已损坏或平台密钥不匹配');
        }
    } else if (fileInfo.formatVersion === '1.8') {
        r = await decryptV18SaveContent(content);
    } else if (fileInfo.formatVersion === '1.8.3') {
        const outerKeys = buildV183OuterKeys(fileInfo.deviceCode, ext.row || null);
        if (!outerKeys.length) {
            throw new Error('1.8.3 存档缺少有效的 save.id，无法与文件名设备码组合解析');
        }
        r = await decryptV183SaveContent(content, outerKeys);
    } else {
        r = await decryptSaveContent(
            content, fileInfo.outerKey, fileInfo.formatVersion, fileInfo.channel || null);
    }
    if (!r) {
        if (fileInfo.formatVersion === '1.8') {
            throw new Error('1.8 存档解析失败：版本头、历史平台密钥、压缩数据或 JSON 不匹配');
        }
        if (fileInfo.formatVersion === '1.8.3') {
            throw new Error('1.8.3 存档解析失败：文件名设备码与当前 dat.db 不匹配，或存档内容已损坏');
        }
        if (fileInfo.formatVersion === '2.0' || fileInfo.formatVersion === '2.1') {
            throw new Error('存档密钥不对。请重新使用当前渠道的 '
                + fileInfo.formatVersion + ' 导出工具导出，且不要修改文件名');
        }
        throw new Error('存档解密失败：文件名中的 16 位解析码或版本与存档不匹配');
    }
    return Object.assign(r, extra);
}


function compareVersionParts(left, right) {
    const a = String(left).split('.').map(Number);
    const b = String(right).split('.').map(Number);
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index++) {
        const difference = (a[index] || 0) - (b[index] || 0);
        if (difference) return difference;
    }
    return 0;
}

function getLatestExporterVersion(parseVersion) {
    const selected = String(parseVersion || '');
    const releases = SAVE_EXPORTER_RELEASES.filter(version =>
        version === selected || version.startsWith(selected + '.'));
    releases.sort(compareVersionParts);
    return releases.length ? releases[releases.length - 1] : null;
}

function setSaveFormatVersion(version) {
    const requested = String(version);
    const normalized = requested === '2.1.0' ? '2.1' : requested;
    const allowed = ['1.8', '1.8.3', '1.9', '2.0', '2.1', '3.0'];
    const selected = allowed.includes(normalized) ? normalized : '3.0';
    const isLegacy = selected === '1.8' || selected === '1.8.3';
    const exporterVersion = getLatestExporterVersion(selected);
    const selector = document.getElementById('saveFormatVersion');
    const download = document.getElementById('saveExporterDownload');
    const exporter = document.getElementById('saveExporterVersion');
    const hint = document.getElementById('saveVersionHint');
    if (selector) selector.value = selected;
    if (download) {
        download.hidden = isLegacy || !exporterVersion;
        if (exporterVersion) {
            download.href = 'downloads/yanyu-save-exporter-v' + exporterVersion + '.zip';
        } else if (typeof download.removeAttribute === 'function') {
            download.removeAttribute('href');
        } else {
            download.href = '';
        }
    }
    if (exporter) exporter.textContent = exporterVersion ? 'v' + exporterVersion : '无（仅解析）';
    if (hint) {
        hint.textContent = selected === '3.0'
            ? 'v3.0 协议（YANYU301）：官方导出器 v3.0.6 产出，需授权密钥；本工具可直接解析已授权文件'
            : (selected === '1.8'
                ? '仅解析：直接选择旧版 dat.db（含 iOS 备份里的存档），不需要文件名设备码'
                : (selected === '1.8.3'
                    ? '仅解析：文件名须包含一对 8 位 @设备码@'
                    : (selected === '2.1'
                        ? '支持解析版本 v2.1 的只读加密 .yanyu 文件（YANYU201 容器，密钥在文件名里）'
                        : (selected === '2.0'
                            ? '兼容 v2.0 工具导出的渠道命名 .db 文件'
                            : '兼容 v1.9 工具导出的 -dat-v1.9.db 文件'))));
    }
}

function getSelectedSaveFormatVersion() {
    if (typeof document === 'undefined') return '';
    const selector = document.getElementById('saveFormatVersion');
    return selector ? String(selector.value || '') : '';
}

function initializeSaveVersionSelector() {
    const selector = document.getElementById('saveFormatVersion');
    const input = document.getElementById('saveFileInput');
    if (selector) selector.addEventListener('change', function () {
        setSaveFormatVersion(selector.value);
    });
    if (input) input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        const detected = file ? detectSaveFileVersion(file.name) : null;
        if (detected) setSaveFormatVersion(detected);
    });
    setSaveFormatVersion('3.0');
}

if (typeof document !== 'undefined') initializeSaveVersionSelector();


var SAVE_SHARE_KEY = 'yyjh_share_save_v1';
var SAVE_SHARE_META_KEY = 'yyjh_share_save_meta_v1';
// window.name：同一个标签页内跨页面导航会保留，是 file:// 下
// Web Storage 被浏览器拒掉时的最后一道兵。
var SAVE_SHARE_WN_MAGIC = '__YYJH_SHARE_V1__';
var SAVE_SHARE_WN_MAX = 6 * 1024 * 1024;

function _webStores() {
    const out = [];
    try { if (window.localStorage) out.push(window.localStorage); } catch (e) { }
    try { if (window.sessionStorage) out.push(window.sessionStorage); } catch (e) { }
    return out;
}

// A session fallback must win over an older, unwritable localStorage value.
// Keep the selector in the same tab storage so navigation retains this choice.
var STORE_OVERRIDE_PREFIX = '__sbj_store_override__';
function _overrideStore() { try { return window.sessionStorage; } catch (_) { return null; } }
function _storeGet(key) {
    const fallback = _overrideStore();
    try {
        const marker = fallback && fallback.getItem(STORE_OVERRIDE_PREFIX + key);
        if (marker === '0') return null;
        if (marker === '1') {
            const value = fallback.getItem(key);
            if (value != null) return value;
        }
    } catch (_) {}
    for (const store of _webStores()) {
        try { const value = store.getItem(key); if (value != null) return value; } catch (_) {}
    }
    return null;
}

// Commit related keys together in each backend, rolling back only keys actually
// written. A quota error must not pair a new role body with the old role metadata.
function _storeWriteValues(values) {
    const stores = _webStores(), committed = [];
    function restore(store, previous, written) {
        written.forEach(function (key) { try { store.removeItem(key); } catch (_) {} });
        written.forEach(function (key) { try {
            if (previous[key] !== null) store.setItem(key, previous[key]);
        } catch (_) {} });
    }
    for (const store of stores) {
        const previous = Object.create(null), written = [];
        try {
            values.forEach(function (entry) { previous[entry[0]] = store.getItem(entry[0]); });
            values.forEach(function (entry) {
                if (entry[1] === null) store.removeItem(entry[0]);
                else store.setItem(entry[0], entry[1]);
                written.push(entry[0]);
            });
            committed.push({store:store, previous:previous, written:written});
        } catch (_) {
            restore(store, previous, written);
            if(store===stores[0]&&values.some(function(entry){return entry[0]==='yyjh_save_library_v1';}))return false;
        }
    }
    if (!committed.length) return false;
    const fallback = _overrideStore(), preferred = stores[0];
    const primaryCommitted = committed.some(function(item){return item.store===preferred;});
    // Library entries are advertised as saved locally. A readable but full
    // primary store must not be hidden behind a tab-only index and report success.
    if(!primaryCommitted&&values.some(function(entry){return entry[0]==='yyjh_save_library_v1';})){
        committed.forEach(function(item){restore(item.store,item.previous,item.written);});
        return false;
    }
    if (!primaryCommitted && !committed.some(function(item){return item.store===fallback;})) return false;
    const markers = [];
    try {
        if (fallback) values.forEach(function(entry){
            const key=STORE_OVERRIDE_PREFIX+entry[0],old=fallback.getItem(key);
            markers.push([key,old]);
            if (!primaryCommitted) fallback.setItem(key,entry[1]===null?'0':'1');
            else if (entry[1]===null && fallback.getItem(entry[0])!==null) fallback.setItem(key,'0');
            else if (old!==null) {
                try{fallback.removeItem(key);}catch(_){fallback.setItem(key,'p');}
            }
        });
    } catch (_) {
        committed.forEach(function(item){restore(item.store,item.previous,item.written);});
        markers.forEach(function(item){try{
            if(item[1]===null){try{fallback.removeItem(item[0]);}catch(_){fallback.setItem(item[0],'p');}}
            else fallback.setItem(item[0],item[1]);
        }catch(_){}});
        return false;
    }
    return true;
}
function _storeSet(key, value) { return _storeWriteValues([[key, value]]); }
function _storeRemove(key) {
    for (const store of _webStores()) {
        try { store.removeItem(key); } catch (_) {}
    }
    try { const fallback = _overrideStore(); if (fallback) fallback.removeItem(STORE_OVERRIDE_PREFIX + key); } catch (_) {}
}

function _nameRead() {
    try {
        const value = String(window.name || '');
        return value.indexOf(SAVE_SHARE_WN_MAGIC) === 0
            ? value.slice(SAVE_SHARE_WN_MAGIC.length) : null;
    } catch (e) { return null; }
}

function _nameWrite(text) {
    try {
        if (text.length > SAVE_SHARE_WN_MAX) return false;
        window.name = SAVE_SHARE_WN_MAGIC + text;
        return true;
    } catch (e) { return false; }
}

function _nameClear() {
    try { if (_nameRead() !== null) window.name = ''; } catch (e) { }
}

// 大字符串压成 base64（复用已有的 pako）
function _packText(text) {
    if (typeof pako !== 'undefined' && typeof pako.deflate === 'function'
        && typeof btoa === 'function') {
        try { return btoa(_bytesToAscii(pako.deflate(new TextEncoder().encode(text)))); } catch (e) { }
    }
    return null;
}

function _unpackText(raw) {
    // 未压缩的 JSON 对象一定以 '{' 开头（旧格式的兼容判据，保留）
    if (raw.charCodeAt(0) === 123) return raw;
    if (typeof pako === 'undefined' || typeof atob !== 'function') return null;
    const bin = atob(raw);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(pako.inflate(bytes));
}

function _serializeShareStore(data, meta) {
    let serialized, serializedMeta;
    try { serialized = JSON.stringify(data); serializedMeta = JSON.stringify(meta); }
    catch (_) { return null; }
    if (typeof serialized !== 'string') return null;
    // The active save and library occupy the same origin quota. Compress large
    // current saves as well, but never replace a smaller plain representation.
    if (serialized.length >= 64 * 1024) {
        const packed = _packText(serialized);
        if (packed && packed.length < serialized.length) serialized = packed;
    }
    if (serializedMeta.length > 512 * 1024) {
        const packedMeta = _packText(serializedMeta);
        if (packedMeta && packedMeta.length < serializedMeta.length) serializedMeta = packedMeta;
    }

    return {serialized:serialized, serializedMeta:serializedMeta,
        envelope:JSON.stringify({d:serialized,m:serializedMeta})};
}
function _commitShareStore(packed, additionalValues) {
    if (!packed) return false;
    const values = [[SAVE_SHARE_KEY,packed.serialized],[SAVE_SHARE_META_KEY,packed.serializedMeta]].concat(additionalValues || []);
    const ok = _storeWriteValues(values);
    // window.name is a last resort, never a reason to report an old save as new.
    if (ok) { _nameWrite(packed.envelope); notifyShareChanged(); return true; }
    if (!additionalValues && !_storeGet(SAVE_SHARE_KEY) && _nameWrite(packed.envelope)) {
        notifyShareChanged(); return true;
    }
    return false;
}
function saveShareStore(data, meta) {
    meta = Object.assign({}, meta || {});
    if (!Number.isFinite(Number(meta.importedAt))) meta.importedAt = Date.now();
    return _commitShareStore(_serializeShareStore(data,meta));
}

function notifyShareChanged() {
    shareReadCache = null;
    shareWriteRevision++;
    try { document.dispatchEvent(new CustomEvent('yyjh-save')); } catch (_) {}
}
var shareReadCache=null, shareWriteRevision=0;
// sessionStorage/window.name are tab fallbacks, not independent older saves.
// An external update/clear must invalidate them before shared navigation rereads.
if (typeof window.addEventListener === 'function') window.addEventListener('storage',function(event){
    let primary;try{primary=window.localStorage;}catch(_){return;}
    if(event.storageArea&&event.storageArea!==primary)return;
    const keys=[SAVE_SHARE_KEY,SAVE_SHARE_META_KEY,'yyjh_save_library_v1'];
    if(event.key!==null&&keys.indexOf(event.key)<0)return;
    const fallback=_overrideStore();
    (event.key===null?keys:[event.key]).forEach(function(key){try{
        if(!fallback)return;
        // A marked fallback/tombstone is this tab's pending choice, not a stale
        // mirror. Sibling-frame rollback events must not erase its only copy.
        const marker=fallback.getItem(STORE_OVERRIDE_PREFIX+key);
        if(event.key!==null&&(marker==='1'||marker==='0'))return;
        fallback.removeItem(key);fallback.removeItem(STORE_OVERRIDE_PREFIX+key);
    }catch(_){}});
    _nameClear();shareReadCache=null;shareWriteRevision++;
});
function loadShareStore() { return _readShareStore(true); }
// Menu guards validate the current snapshot without cloning its full game data.
function hasShareStore() { return !!_readShareStore(false)?.data; }
function _readShareStore(copy) {
    try {
        let serialized = _storeGet(SAVE_SHARE_KEY);
        let serializedMeta = _storeGet(SAVE_SHARE_META_KEY) || '{}';

        if (!serialized) {                    // 兵式：从 window.name 恢复
            const packed = _nameRead();
            if (!packed) return null;
            const envelope = JSON.parse(packed);
            serialized = envelope.d;
            serializedMeta = envelope.m || '{}';
        }

        if(typeof structuredClone==='function'&&shareReadCache&&shareReadCache.serialized===serialized&&shareReadCache.serializedMeta===serializedMeta)return copy ? structuredClone(shareReadCache.value) : shareReadCache.value;
        const rawData = _unpackText(serialized);
        if (rawData == null) return null;
        const rawMeta = _unpackText(serializedMeta) || '{}';
        const value={data:JSON.parse(rawData),meta:JSON.parse(rawMeta)};if(typeof structuredClone==='function'){shareReadCache={serialized,serializedMeta,value};return copy ? structuredClone(value) : value;}return value;
    } catch (e) {
        return null;
    }
}

function clearShareStore() {
    const ok = _storeWriteValues([[SAVE_SHARE_KEY,null],[SAVE_SHARE_META_KEY,null]]);
    if (!ok && _storeGet(SAVE_SHARE_KEY)) return false;
    _nameClear();
    notifyShareChanged();
    return true;
}

// ---- 供 page_bridge.js 使用的原始读写口 ----
// 直接搬字符串，避免把 3.4MB 的存档再 JSON.parse / stringify 一遍。

function shareStoreRaw() {
    let d = _storeGet(SAVE_SHARE_KEY);
    let m = _storeGet(SAVE_SHARE_META_KEY) || '{}';
    if (!d) {
        const packed = _nameRead();
        if (packed) {
            try { const env = JSON.parse(packed); d = env.d; m = env.m || '{}'; } catch (e) { }
        }
    }
    return d ? { d: d, m: m } : null;
}

function shareStoreApplyRaw(d, m) {
    if (typeof d !== 'string' || !d) return false;
    m = m || '{}';
    return _commitShareStore({serialized:d,serializedMeta:m,envelope:JSON.stringify({d:d,m:m})});
}


function markNavTransition() {
    try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('yyjh_nav_transition', '1');
    } catch (e) { }
}

function consumeNavTransition() {
    try {
        if (typeof sessionStorage === 'undefined') return false;
        const v = sessionStorage.getItem('yyjh_nav_transition') === '1';
        sessionStorage.removeItem('yyjh_nav_transition');
        return v;
    } catch (e) {
        return false;
    }
}

function _importFeedback(on) {
    try {
        var input = document.getElementById('saveFileInput');
        if (!input) return;
        var label = input.closest ? input.closest('label') : null;
        if (!label) label = input.parentNode;
        if (!label) return;
        var txt = label.querySelector ? label.querySelector('.import-txt') : null;
        if (!txt) return;
        if (on) {
            if (!txt.dataset.importTxt) txt.dataset.importTxt = txt.textContent;
            txt.textContent = '解密中…';
        } else {
            if (txt.dataset.importTxt) txt.textContent = txt.dataset.importTxt;
        }
    } catch (e) { }
}

/* Share one bounded, idle-terminated codec worker across save operations. */
var SaveCodec=(function(){var worker=null,serial=0,pending=new Map(),idle=null,base=typeof document!=='undefined'&&document.currentScript?document.currentScript.src:location.href;
 function stop(error){if(worker)worker.terminate();worker=null;clearTimeout(idle);pending.forEach(function(p){clearTimeout(p.timer);p.reject(error);});pending.clear();}
 function run(command,input){return new Promise(function(resolve,reject){try{clearTimeout(idle);if(!worker){worker=new Worker(new URL('./save-codec-worker.js?v=compact2',base));worker.onmessage=function(e){var m=e.data,p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m.value);if(!pending.size)idle=setTimeout(function(){stop(Error('Codec idle'));},30000);};worker.onerror=function(){stop(Error('本地存档处理线程未能加载'));};}var id=++serial,timer=setTimeout(function(){stop(Error('本地存档处理超时'));},60000);pending.set(id,{resolve:resolve,reject:reject,timer:timer});worker.postMessage(Object.assign({id:id,command:command},input));}catch(e){stop(e);reject(e);}});}
 return {run:run};})();
async function saveShareStoreAsync(data,meta){
    meta=Object.assign({},meta||{});
    if(!Number.isFinite(Number(meta.importedAt)))meta.importedAt=Date.now();
    let packed;
    try{packed=await SaveCodec.run('share',{data:data,meta:meta});}
    catch(_){packed=_serializeShareStore(data,meta);}
    return _commitShareStore(packed);
}

async function loadShareStoreAsync(){var revision=shareWriteRevision;try{var d=_storeGet(SAVE_SHARE_KEY),m=_storeGet(SAVE_SHARE_META_KEY)||'{}';if(!d){var packed=_nameRead();if(!packed)return null;var envelope=JSON.parse(packed);d=envelope.d;m=envelope.m||'{}';}var values=await Promise.all([SaveCodec.run('unpack',{store:{fmt:'pako',text:d}}),SaveCodec.run('unpack',{store:{fmt:'pako',text:m}})]);return revision===shareWriteRevision?{data:values[0],meta:values[1]}:loadShareStore();}catch(e){return loadShareStore();}}
