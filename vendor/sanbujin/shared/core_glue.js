let wasmExports = null;
let wasmReady = false;
let wasmMakeTables = null;


let cachedDataViewMemory0 = null;
let cachedUint8ArrayMemory0 = null;
let WASM_VECTOR_LEN = 0;

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;

const cachedTextEncoder = new TextEncoder();
if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return { read: arg.length, written: buf.length };
    };
}

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true ||
        (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasmExports.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasmExports.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasmExports.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = getUint8ArrayMemory0();
    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) arg = arg.slice(offset);
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);
        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function base64ToUint8Array(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function isWasmBinary(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return view.length >= 4 &&
        view[0] === 0x00 && view[1] === 0x61 &&
        view[2] === 0x73 && view[3] === 0x6d;
}


let wasmInitialization=null;
async function initWasm(){if(wasmReady)return true;if(!wasmInitialization)wasmInitialization=initializeWasm().then(ok=>{if(!ok)wasmInitialization=null;return ok;},error=>{wasmInitialization=null;throw error;});return wasmInitialization;}
async function initializeWasm() {
    try {
        const imports = {
            './wasm_core_bg.js': {
                __wbg_random_95ef1cd58b1a3d73: function() {
                    return Math.random();
                },
            },
        };

        let bytes = null;

        /* 只有显式开启外链时才去 fetch；默认走内嵌 Base64，避免每页一个 404 */
        const externalWasm = typeof document !== 'undefined' && document.documentElement.getAttribute('data-wasm-external') === '1';
        if (location.protocol !== 'file:' && externalWasm) {
            try {
                const response = await fetch('pkg/wasm_core_bg.wasm');
                if (response.ok) {
                    const fetchedBytes = await response.arrayBuffer();
                    if (isWasmBinary(fetchedBytes)) {
                        bytes = fetchedBytes;
                    } else {
                        console.warn('HTTP 返回的 WASM 数据无效，降级使用内嵌 Base64。');
                    }
                }
            } catch (e) {
                console.warn('HTTP fetch WASM 失败，降级使用内嵌 Base64:', e);
            }
        }

        if (!bytes && typeof EMBEDDED_WASM_B64 !== 'undefined' && EMBEDDED_WASM_B64) {
            bytes = base64ToUint8Array(EMBEDDED_WASM_B64);
        }

        if (!bytes) {
            throw new Error('推演资料加载失败，请检查网络并刷新页面。');
        }

        // 版本规则补丁：把内核里编译死的 99999999 换成 SequenceRules.makeMax(state)
        // （v73420+ 应为 98999999）。3.0.2 的 core_glue 丢了这一步，打造序列会和旧版/游戏不一致。
        let preparedBytes = bytes;
        try {
            if (typeof SequenceRules !== 'undefined' && SequenceRules.prepareWasm) {
                preparedBytes = SequenceRules.prepareWasm(bytes);
            }
        } catch (e) {
            console.warn('WASM 版本规则补丁未应用（继续用未打补丁的内核）:', e && e.message);
            preparedBytes = bytes;
        }

        const { instance } = await WebAssembly.instantiate(preparedBytes, imports);

        wasmExports = instance.exports;
        cachedDataViewMemory0 = null;
        cachedUint8ArrayMemory0 = null;
        wasmReady = true;
        return true;
    } catch (e) {
        console.error('WASM 加载失败:', e);
        return false;
    }
}


function _callStringReturn(fn) {
    let d0, d1;
    try {
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        fn(retptr);
        const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
        const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
        d0 = r0; d1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
        wasmExports.__wbindgen_export3(d0, d1, 1);
    }
}

function wasmInitEngine(talentData, zzData) {
    if (!wasmReady) return false;
    const tj = JSON.stringify(talentData);
    const zj = JSON.stringify(zzData);
    const ptr0 = passStringToWasm0(tj, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(zj, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN;
    return wasmExports.init_engine(ptr0, len0, ptr1, len1) !== 0;
}

function wasmSetState(stateObj) {
    if (!wasmReady) return false;
    const json = JSON.stringify(stateObj);
    const ptr = passStringToWasm0(json, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
    const len = WASM_VECTOR_LEN;
    return wasmExports.set_state(ptr, len) !== 0;
}

function wasmGetState() {
    if (!wasmReady) return null;
    try {
        return JSON.parse(_callStringReturn(r => wasmExports.get_state(r)));
    } catch { return null; }
}

function wasmDoWash() {
    if (!wasmReady) return null;
    try {
        const json = _callStringReturn(r => wasmExports.do_wash(r));
        return json === 'null' ? null : JSON.parse(json);
    } catch { return null; }
}

function wasmWashMulti(times) {
    if (!wasmReady) return [];
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            wasmExports.wash_multi(retptr, times);
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch { return []; }
}

function wasmWashUntilGold(maxIterations) {
    if (!wasmReady) return [];
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            wasmExports.wash_until_gold(retptr, maxIterations);
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch { return []; }
}

function wasmWashUntilTalentName(name, maxIterations) {
    if (!wasmReady) return [];
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            const ptr = passStringToWasm0(String(name || ''), wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
            const len = WASM_VECTOR_LEN;
            wasmExports.wash_until_talent_name(retptr, ptr, len, maxIterations >>> 0);
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch (e) {
        console.error('wash_until_talent_name failed', e);
        return [];
    }
}

function wasmPreviewSequence(maxWashes) {
    if (!wasmReady) return [];
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            wasmExports.preview_sequence(retptr, maxWashes);
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch { return []; }
}

function wasmPreviewExchangePads(targets, maxPad) {
    if (!wasmReady) return [];
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            const json = JSON.stringify(targets || []);
            const ptr = passStringToWasm0(json, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
            const len = WASM_VECTOR_LEN;
            wasmExports.preview_exchange_pads(retptr, ptr, len, maxPad >>> 0);
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch (e) {
        console.error('preview_exchange_pads failed', e);
        return [];
    }
}

function wasmExchangeTalent(index) {
    if (!wasmReady) return null;
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            wasmExports.exchange_talent(retptr, index);
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch { return null; }
}

function wasmDecryptSave(b64Text) {
    if (!wasmReady) throw new Error('推演资料尚未加载，请稍候重试');
    let d0, d1;
    const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    try {
        const ptr = passStringToWasm0(b64Text, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
        const len = WASM_VECTOR_LEN;
        wasmExports.decrypt_save(retptr, ptr, len);
        const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
        const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
        d0 = r0; d1 = r1;
        const result = getStringFromWasm0(r0, r1);
        const parsed = JSON.parse(result);
        if (parsed && parsed.error) throw new Error(parsed.error);
        return parsed;
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
        wasmExports.__wbindgen_export3(d0, d1, 1);
    }
}

function wasmGetAvailableTalents() {
    if (!wasmReady) return [];
    try {
        return JSON.parse(_callStringReturn(r => wasmExports.get_available_talents(r)));
    } catch { return []; }
}

function wasmGetConflicts() {
    if (!wasmReady) return [];
    try {
        return JSON.parse(_callStringReturn(r => wasmExports.get_conflicts(r)));
    } catch { return []; }
}


const FIXED_ORANGE_EXT_PROP_ORDER = Object.freeze([
    'atk_add', 'hit_add', 'def_add', 'hp_add', 'speed_add', 'dodge_add', 'parry_add',
    'def_ign', 'unarmed_add', 'sword_add', 'blade_add', 'stick_add', 'hp_back',
    'mp_back', 'mp_f', 'dmg_off', 'dmg_ref', 'blood', 'renxing', 'po_parry',
    'po_dodge', 'atk_extend', 'xx_prob', 'xx_crit', 'gangqi', 'neij',
]);
const FIXED_ORANGE_EXT_SLOT_COUNT = 3;

function correctFixedOrangeExtsFromSource(req, result) {
    if (!req || !result || Number(req.min_color) !== 5 || Number(req.max_color) !== 5 || Number(result.color) !== 5) {
        return result;
    }
    const equip = wasmMakeTables?.equipment?.[String(req.equip_id)];
    const configured = equip?.exts;
    if (!configured || typeof configured !== 'object') return result;

    const ordered = FIXED_ORANGE_EXT_PROP_ORDER
        .filter(prop => Object.prototype.hasOwnProperty.call(configured, prop))
        .map(prop => ({ prop, value: Array.isArray(configured[prop]) ? configured[prop][0] : configured[prop] }))
        .filter(item => typeof item.value === 'number' && Number.isFinite(item.value));
    result.exts = ordered.slice(0, FIXED_ORANGE_EXT_SLOT_COUNT);
    return result;
}

const MAKE_RNG_MULTIPLIER = 245109059551232n;
const MAKE_RNG_INCREMENT = 48083817484545n;
const MAKE_RNG_MASK = 2147483647n;
const MAKE_RNG_REDUCTION_LIMIT = 2047483645;

function _makeWhaleDraw(seed, max) {
    const bound = Math.max(1, Math.floor(Number(max) || 1));
    const mixed = BigInt.asUintN(
        64,
        (BigInt(Math.floor(Number(seed) || 0) + bound) * MAKE_RNG_MULTIPLIER) + MAKE_RNG_INCREMENT,
    );
    const raw = Number((mixed >> 17n) & MAKE_RNG_MASK);
    const next = (raw < MAKE_RNG_REDUCTION_LIMIT ? raw : raw - MAKE_RNG_REDUCTION_LIMIT) + 1;
    return { seed: next, value: (next % bound) + 1 };
}

function _fixedOrangeSourceSeedBefore(req, stateBefore, result) {
    if (!stateBefore || !result) return null;
    const equip = wasmMakeTables?.equipment?.[String(req?.equip_id)];
    if (!equip) return null;
    const tier = Math.floor(Number(equip.lv) / 10);
    const normal = stateBefore.Seeds?.[String(equip.type)]?.[String(tier)];
    const lucky = result.seed_kind === 'lucky' || result.pity;
    let seed = lucky
        ? (Number(equip.lv) >= 90 ? stateBefore.LuckySeeds?.[String(equip.id)] : stateBefore.LuckySeeds?.[String(equip.type)]?.[String(tier)])
        : (Number(equip.lv) >= 100 ? stateBefore.IDSeeds?.[String(equip.id)] : normal);
    // Original JHMakeData initializes per-equipment sequences from the current
    // ordinary type/level seed plus equipment ID; initialization is not a draw.
    if (seed == null && ((lucky && Number(equip.lv) >= 90) || (!lucky && Number(equip.lv) >= 100))) {
        if (normal != null) seed = Number(normal) + Number(equip.id);
    }
    return seed != null && Number.isSafeInteger(Number(seed)) ? Number(seed) : null;
}

function _fixedOrangeRegionEntries(craftsman, tier) {
    if (Array.isArray(craftsman?.tx) && craftsman.tx.length) {
        return craftsman.tx.map(entry => ({
            prop: String(entry?.[0] || ''),
            value: Number(entry?.[1]) || 0,
            weight: Math.max(0, Number(entry?.[2]) || 0),
        })).filter(entry => entry.prop && entry.weight > 0);
    }
    if (Array.isArray(craftsman?.tx2) && craftsman.tx2.length) {
        return craftsman.tx2.map(entry => ({
            prop: String(entry?.[0] || ''),
            value: (Number(entry?.[1]) || 0) + tier * (Number(entry?.[2]) || 0),
            weight: Math.max(0, Number(entry?.[3]) || 0),
        })).filter(entry => entry.prop && entry.weight > 0);
    }
    return [];
}

function correctFixedOrangeRegionFromSource(req, result, stateBefore) {
    if (!req || !result) return result;
    if (Number(req.min_color) !== 5 || Number(req.max_color) !== 5 || Number(result.color) !== 5) return result;

    const equip = wasmMakeTables?.equipment?.[String(req.equip_id)];
    const craftsman = wasmMakeTables?.craftsman?.[String(req.npc_id)];
    if (!equip || !craftsman) return result;
    const tier = Math.floor(Number(equip.lv) / 10);
    const regionEntries = _fixedOrangeRegionEntries(craftsman, tier);
    const sourceSeed = _fixedOrangeSourceSeedBefore(req, stateBefore, result);
    if (sourceSeed == null) return result;

    let seed = sourceSeed + Number(req.select_id || 0) - 3;
    seed = _makeWhaleDraw(seed, 3).seed;

    for (const _ of Object.keys(equip.base || {})) {
        seed = _makeWhaleDraw(seed, 1).seed;
    }

    let extWeight = 0;
    for (const configured of Object.values(equip.exts || {})) {
        if (Array.isArray(configured) && Number(configured[1]) > 0) extWeight += Number(configured[1]);
    }
    if (extWeight <= 0) extWeight = 1;
    // The original loop draws before checking its forced orange slot. With
    // fewer than three configured properties, the first missing slot still
    // consumes a draw and then exits (one property therefore uses two draws).
    const propCount = FIXED_ORANGE_EXT_PROP_ORDER.filter(prop =>
        Object.prototype.hasOwnProperty.call(equip.exts || {}, prop)
        && (Number(equip.lv) >= 100 || !['gangqi', 'neij'].includes(prop))).length;
    const fixedSlots = propCount ? Math.min(FIXED_ORANGE_EXT_SLOT_COUNT, propCount + 1) : 0;
    for (let slot = 0; slot < fixedSlots; slot++) {
        seed = _makeWhaleDraw(seed, extWeight).seed;
    }

    let region = [];
    if (regionEntries.length) {
        const regionDraw = _makeWhaleDraw(seed, 100);
        seed = regionDraw.seed;
        let cursor = regionDraw.value;
        for (const entry of regionEntries) {
            if (cursor <= entry.weight) {
                region = [{ prop: entry.prop, value: entry.value }];
                break;
            }
            cursor -= entry.weight;
        }
    }
    result.region = region;
    const material = wasmMakeTables?.special?.[String(req.special_id || 0)];
    if (material?.prop?.length) {
        const weighted = weights => {
            const draw = _makeWhaleDraw(seed, weights.reduce((sum, n) => sum + Number(n), 0));
            seed = draw.seed;
            let cursor = draw.value;
            for (let i = 0; i < weights.length; i++) {
                cursor -= Number(weights[i]);
                if (cursor <= 0) return i;
            }
            throw new Error('特殊材料权重无效');
        };
        const index = weighted(material.prop.map(p => p[1]));
        const ranges = [[85, 95], [95, 105], [105, 115], [115, 125], [125, 150]];
        const range = ranges[weighted([5000, 500, 50, 5, 1])];
        const factorDraw = _makeWhaleDraw(seed, range[1] - range[0] + 1);
        seed = factorDraw.seed;
        const factor = range[0] + factorDraw.value - 1;
        const rawValue = material.lvs?.['lv' + Number(equip.lv)];
        const baseValue = Array.isArray(rawValue) ? rawValue[index] : rawValue;
        const prop = material.prop[index][0];
        let value = baseValue === 1 && ['mp_f', 'mp_back', 'hp_back'].includes(prop)
            ? baseValue : Number(baseValue) * factor / 100;
        if (value >= 1) value = Math.floor(value);
        result.special = [{ prop, value }];
    }
    result.S = seed;
    return result;
}

function _needsFixedOrangeSourceCorrection(req) {
    if (!req) return false;
    if (Number(req.min_color) !== 5 || Number(req.max_color) !== 5) return false;
    const equip = wasmMakeTables?.equipment?.[String(req.equip_id)];
    return !!equip;
}

function correctMakeResultFromSource(req, response, stateBefore) {
    if (Array.isArray(response?.items)) {
        for (const item of response.items) correctFixedOrangeExtsFromSource(req, item);
        return response;
    }
    correctFixedOrangeExtsFromSource(req, response);
    return correctFixedOrangeRegionFromSource(req, response, stateBefore);
}

function wasmMakeInitTables(tablesObj) {
    if (!wasmReady) return false;
    wasmMakeTables = null;
    try {
        const json = JSON.stringify(tablesObj);
        const ptr = passStringToWasm0(json, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
        const len = WASM_VECTOR_LEN;
        const initialized = wasmExports.make_init_tables(ptr, len) !== 0;
        if (initialized) wasmMakeTables = tablesObj;
        return initialized;
    } catch (e) {
        console.error('make_init_tables failed', e);
        return false;
    }
}

function _applyMakeDrawMax(stateObj) {
    try {
        if (wasmExports && wasmExports.__make_draw_max && typeof SequenceRules !== 'undefined'
            && typeof SequenceRules.makeMax === 'function') {
            wasmExports.__make_draw_max.value = BigInt(SequenceRules.makeMax(stateObj));
        }
    } catch (e) {
        /* 没有补丁的旧内核就跳过，等价于保持编译期常量 */
    }
}

function wasmMakeSetState(stateObj) {
    if (!wasmReady) return false;
    try {
        if (stateObj && stateObj.save_version) wasmMakeSaveContext.version = String(stateObj.save_version);
        if (stateObj && stateObj.save_channel) wasmMakeSaveContext.channel = String(stateObj.save_channel);
        const payload = Object.assign({}, stateObj);
        if (!payload.save_version && wasmMakeSaveContext.version) payload.save_version = wasmMakeSaveContext.version;
        if (!payload.save_channel && wasmMakeSaveContext.channel) payload.save_channel = wasmMakeSaveContext.channel;
        const json = JSON.stringify(payload);
        const ptr = passStringToWasm0(json, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
        const len = WASM_VECTOR_LEN;
        const accepted = wasmExports.make_set_state(ptr, len) !== 0;
        if (accepted) _applyMakeDrawMax(payload);
        return accepted;
    } catch (e) {
        console.error('make_set_state failed', e);
        return false;
    }
}

/* 内核 make_get_state 只回传 Seeds/LuckySeeds/IDSeeds/MakeLucky，
   不带 save_version / save_channel；直接拿它做快照再 set 回来，
   版本就丢了，makeMax 会从 98999999 退回 99999999，序列整体偏移。
   这里把上下文存在 JS 侧，get 时补回、set 时兜底。 */
let wasmMakeSaveContext = { version: '', channel: '' };

function wasmMakeGetState() {
    if (!wasmReady) return null;
    try {
        const st = JSON.parse(_callStringReturn(r => wasmExports.make_get_state(r)));
        if (!st) return st;
        if (!st.save_version && wasmMakeSaveContext.version) st.save_version = wasmMakeSaveContext.version;
        if (!st.save_channel && wasmMakeSaveContext.channel) st.save_channel = wasmMakeSaveContext.channel;
        return st;
    } catch { return null; }
}

function _wasmMakePreviewRaw(req, n) {
    let d0, d1;
    const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    try {
        const json = JSON.stringify(req || {});
        const ptr = passStringToWasm0(json, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
        const len = WASM_VECTOR_LEN;
        wasmExports.make_preview(retptr, ptr, len, n >>> 0);
        const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
        const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
        d0 = r0; d1 = r1;
        return JSON.parse(getStringFromWasm0(r0, r1));
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
        wasmExports.__wbindgen_export3(d0, d1, 1);
    }
}

function _wasmMakeOnceRaw(req) {
    let d0, d1;
    const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    try {
        const json = JSON.stringify(req || {});
        const ptr = passStringToWasm0(json, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
        const len = WASM_VECTOR_LEN;
        wasmExports.make_once(retptr, ptr, len);
        const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
        const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
        d0 = r0; d1 = r1;
        return JSON.parse(getStringFromWasm0(r0, r1));
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
        wasmExports.__wbindgen_export3(d0, d1, 1);
    }
}

// Yield with the live UI RNG restored; another tool action cannot observe or
// overwrite the private preview sequence between slices.
async function wasmMakePreviewAsync(req,n,shouldCancel=()=>false){
 if(!wasmReady)return {items:[],error:'推演资料尚未加载，请稍候重试'};
 let resume=wasmMakeGetState();if(!resume)return {items:[],error:'无法读取打造状态'};const items=[];
 try{while(items.length<(n>>>0)){
  if(shouldCancel())return {items:[],cancelled:true};const live=wasmMakeGetState(),started=performance.now();
  try{wasmMakeSetState(resume);do{const before=wasmMakeGetState(),item=correctMakeResultFromSource(req,_wasmMakeOnceRaw(req),before);item.index=items.length+1;items.push(item);}while(items.length<(n>>>0)&&performance.now()-started<8);resume=wasmMakeGetState();}
  finally{wasmMakeSetState(live);}
  if(items.length<(n>>>0))await new Promise(resolve=>setTimeout(resolve,0));
 }return {items};}catch(error){return {items:[],error:String(error)};}
}

function wasmMakePreview(req, n) {
    if (!wasmReady) return { items: [], error: '推演资料尚未加载，请稍候重试' };
    try {
        /* 预览必须可重复：先快照状态，结束后恢复，避免连续预测把打造序列往后推。
           这里逐次调用 make_once（与「推进到此」完全同一条内核路径），
           不能用内核的 make_preview：它和 make_once 的取色/取值路径并不总是一致，
           曾出现预览显示紫装、推进入包却变成绿装的问题。 */
        const previewSnapshot = wasmMakeGetState();
        if (!previewSnapshot) return { items: [], error: '无法读取打造状态' };
        const items = [];
        try {
            for (let i = 0; i < (n >>> 0); i++) {
                const stateBefore = wasmMakeGetState();
                const item = correctMakeResultFromSource(req, _wasmMakeOnceRaw(req), stateBefore);
                item.index = i + 1;
                items.push(item);
            }
        } finally {
            wasmMakeSetState(previewSnapshot);
        }
        return { items };
    } catch (e) {
        console.error('make_preview failed', e);
        return { items: [], error: String(e) };
    }
}

function wasmMakeOnce(req) {
    if (!wasmReady) return { error: '推演资料尚未加载，请稍候重试' };
    try {
        const stateBefore = _needsFixedOrangeSourceCorrection(req) ? wasmMakeGetState() : null;
        return correctMakeResultFromSource(req, _wasmMakeOnceRaw(req), stateBefore);
    } catch (e) {
        console.error('make_once failed', e);
        return { error: String(e) };
    }
}

// Independent SL alternatives: N ordinary crafts, then one target. The target
// never advances the ordinary padding path or the next alternative's pity.
function wasmMakePaddingPreview(req, paddingReq, n) {
    if (!wasmReady) return { items: [], error: '推演资料尚未加载，请稍候重试' };
    const target = wasmMakeTables?.equipment?.[String(req?.equip_id)];
    const padding = wasmMakeTables?.equipment?.[String(paddingReq?.equip_id)];
    if (!target || ((n >>> 0) > 1 && (!padding || target.type !== padding.type || target.lv !== padding.lv
        || Number(paddingReq.max_color) > 4 || Number(paddingReq.min_color) > 4))) {
        return { items: [], error: '垫刀必须选用同等级、同类型的普通装备' };
    }
    const before = wasmMakeGetState();
    if (!before) return { items: [], error: '无法读取打造状态' };
    const items = [];
    try {
        for (let i = 0; i < (n >>> 0); i++) {
            const response = wasmMakePreview(req, 1);
            if (response.error || response.items?.[0]?.error) throw Error(response.error || response.items[0].error);
            items.push({ ...response.items[0], index: i + 1, padding_count: i });
            if (i + 1 < (n >>> 0)) {
                const pad = wasmMakeOnce({ ...paddingReq, special_id: 0 });
                if (pad.error) throw Error(pad.error);
            }
        }
        return { items, sequence_mode: 'padding', padding_request: paddingReq };
    } catch (error) { return { items: [], error: String(error.message || error) }; }
    finally { wasmMakeSetState(before); }
}

function wasmMakePaddedOnce(req, paddingReq, paddingCount) {
    const count = Number(paddingCount);
    if (!Number.isSafeInteger(count) || count < 0 || count > 5000) return { items: [], error: '垫刀次数必须是0–5000的整数' };
    const target = wasmMakeTables?.equipment?.[String(req?.equip_id)];
    const pad = wasmMakeTables?.equipment?.[String(paddingReq?.equip_id)];
    if (count && (!target || !pad || target.lv !== pad.lv || target.type !== pad.type
        || Number(paddingReq.max_color) > 4)) return { items: [], error: '垫刀必须选择同等级同类型的普通装备图纸' };
    const before = wasmMakeGetState();
    if (!before) return { items: [], error: '无法读取打造状态' };
    try {
        for (let i = 0; i < count; i++) {
            const item = wasmMakeOnce({ ...paddingReq, special_id: 0 });
            if (item.error) throw Error(item.error);
        }
        const item = wasmMakeOnce(req);
        if (item.error) throw Error(item.error);
        return { items: [{ ...item, index: count + 1, padding_count: count }], sequence_mode: 'padding', padding_request: paddingReq };
    } catch (error) { return { items: [], error: String(error.message || error) }; }
    finally { wasmMakeSetState(before); }
}

function _callJsonInOut(fnName, obj, extraArg) {
    if (!wasmReady) return { error: '推演资料尚未加载，请稍候重试' };
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            const json = JSON.stringify(obj || {});
            const ptr = passStringToWasm0(json, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
            const len = WASM_VECTOR_LEN;
            if (extraArg === undefined) {
                wasmExports[fnName](retptr, ptr, len);
            } else {
                wasmExports[fnName](retptr, ptr, len, extraArg >>> 0);
            }
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch (e) {
        console.error(fnName + ' failed', e);
        return { error: String(e) };
    }
}

function wasmXilianPreview(equip, n) {
    return _callJsonInOut('xilian_preview', equip, n);
}

function wasmXilianOnce(equip) {
    return _callJsonInOut('xilian_once', equip);
}

function wasmXilianPlan(equip, accepts) {
    if (!wasmReady) return { error: '推演资料尚未加载，请稍候重试' };
    try {
        let d0, d1;
        const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
        try {
            const j0 = JSON.stringify(equip || {});
            const p0 = passStringToWasm0(j0, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
            const l0 = WASM_VECTOR_LEN;
            const j1 = JSON.stringify(accepts || []);
            const p1 = passStringToWasm0(j1, wasmExports.__wbindgen_export, wasmExports.__wbindgen_export2);
            const l1 = WASM_VECTOR_LEN;
            wasmExports.xilian_plan(retptr, p0, l0, p1, l1);
            const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
            const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
            d0 = r0; d1 = r1;
            return JSON.parse(getStringFromWasm0(r0, r1));
        } finally {
            wasmExports.__wbindgen_add_to_stack_pointer(16);
            wasmExports.__wbindgen_export3(d0, d1, 1);
        }
    } catch (e) {
        console.error('xilian_plan failed', e);
        return { error: String(e) };
    }
}

function wasmStrongPreview(equip, n) {
    return _callJsonInOut('strong_preview', equip, n);
}

function wasmStrongOnce(equip) {
    return _callJsonInOut('strong_once', equip);
}


function syncStateToWasm(jsState) {
    const ws = {
        mode: jsState.mode,
        zizhi: jsState.zizhi,
        sex: jsState.sex,
        vip: jsState.vip,
        seed: jsState.seed,
        luck_seed: jsState.luckSeed,
        luck_seed_inited: jsState.luckSeedInited,
        role_id: jsState.roleId,
        salt: jsState.salt,
        talents: jsState.talents,
        tal_lucky: jsState.talLucky,
        total_wash: jsState.totalWash,
        total_talent_bars: jsState.totalTalentBars || 0,
        total_pills: jsState.totalPills,
        bag_pills: jsState.bagPills,
        has_bag_pills: jsState.hasBagPills,
        gold_count: jsState.goldCount,
        pity_count: jsState.pityCount,
        quality_counts: jsState.qualityCounts,
        last_purple_total_pills: jsState.lastPurpleTotalPills,
        exchange_count: jsState.exchangeCount,
        str_gift: jsState.strGift,
        con_gift: jsState.conGift,
        dex_gift: jsState.dexGift,
        int_gift: jsState.intGift,
        role_level: jsState.roleLevel,
        role_stats: jsState.roleStats || { str_val: 0, dex: 0, con: 0, int_val: 0 },
        global_vars: jsState.globalVars || {},
        born_talent_rc: Number(jsState.bornTalentRC) || 0,
        save_channel: jsState.saveChannel || '',
        // 洗脉 RC 规则靠这个：3.0.2 的 core_glue 漏了 save_version，
        // 内核按「版本 0」走 RC 判定 → 洗脉序列整体偏移。
        save_version: jsState.saveVersion || '',
    };
    return wasmSetState(ws);
}

function syncStateFromWasm(jsState) {
    const ws = wasmGetState();
    if (!ws) return;
    jsState.mode = ws.mode;
    jsState.zizhi = ws.zizhi;
    jsState.sex = ws.sex;
    jsState.vip = ws.vip;
    jsState.seed = ws.seed;
    jsState.luckSeed = ws.luck_seed;
    jsState.luckSeedInited = ws.luck_seed_inited;
    jsState.roleId = ws.role_id;
    jsState.salt = ws.salt;
    jsState.talents = ws.talents;
    jsState.talLucky = ws.tal_lucky;
    jsState.totalWash = ws.total_wash;
    jsState.totalTalentBars = ws.total_talent_bars || 0;
    jsState.totalPills = ws.total_pills;
    jsState.bagPills = ws.bag_pills;
    jsState.hasBagPills = ws.has_bag_pills;
    jsState.goldCount = ws.gold_count;
    jsState.pityCount = ws.pity_count;
    jsState.qualityCounts = ws.quality_counts;
    jsState.lastPurpleTotalPills = ws.last_purple_total_pills;
    jsState.exchangeCount = ws.exchange_count;
    jsState.strGift = ws.str_gift;
    jsState.conGift = ws.con_gift;
    jsState.dexGift = ws.dex_gift;
    jsState.intGift = ws.int_gift;
    jsState.roleLevel = ws.role_level;
    if (ws.born_talent_rc !== undefined) jsState.bornTalentRC = Number(ws.born_talent_rc) || 0;
    if (ws.save_channel !== undefined) jsState.saveChannel = String(ws.save_channel || '');
    if (ws.save_version !== undefined) jsState.saveVersion = String(ws.save_version || '');
}

function convertWashResult(wr) {
    if (!wr) return null;
    return {
        washNo: wr.wash_no,
        talents: wr.talents,
        gotGold: wr.got_gold,
        pillsUsed: wr.pills_used,
        totalPills: wr.total_pills,
        bagPills: wr.bag_pills,
        wasPity: wr.was_pity,
        pityArmed: wr.pity_armed,
        talLucky: wr.tal_lucky,
        purpleGapPills: wr.purple_gap_pills,
        isFirstPurple: wr.is_first_purple,
        startS: wr.start_s,
        endS: wr.end_s,
        luckSeed: wr.luck_seed,
        roleId: wr.role_id,
    };
}

function convertExchangeResult(er) {
    if (!er) return null;
    return {
        success: er.success,
        error: er.error,
        washNo: er.wash_no,
        exchangeNo: er.exchange_no,
        talents: er.talents,
        gotGold: er.got_gold,
        isExchange: er.is_exchange,
        exchangedFrom: er.exchanged_from,
        exchangedTo: er.exchanged_to,
        pillsUsed: er.pills_used,
        totalPills: er.total_pills,
        bagPills: er.bag_pills,
        wasPity: er.was_pity,
        pityArmed: er.pity_armed,
        talLucky: er.tal_lucky,
        purpleGapPills: er.purple_gap_pills,
        isFirstPurple: er.is_first_purple,
        startS: er.start_s,
        endS: er.end_s,
        luckSeed: er.luck_seed,
        roleId: er.role_id,
    };
}
