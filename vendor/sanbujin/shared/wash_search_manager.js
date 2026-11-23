(function (root) {
    'use strict';

    const SINGLETON = '__SBJ_WASH_SEARCH_MANAGER_V1__';
    const LOADING = '__SBJ_WASH_SEARCH_MANAGER_LOADING_V1__';
    const EMBEDDED = new URLSearchParams(root.location.search).get('communityWash') === '1';
    const STORAGE_KEY = EMBEDDED ? 'sbj_community_wash_snapshot_v1' : 'sbj_wash_search_snapshot_v1';
    const SCHEMA = 1;
    const TERMINAL = new Set(['complete', 'stopped', 'error']);
    const OPAQUE_KEY = /^(?:wash-v1:[a-f0-9]{16}:\d+|wash-auto-v\d+-[a-f0-9-]{16,32})$/;
    const scriptSource = root.document?.currentScript?.src || '';

    function clone(value) {
        if (value == null) return value;
        return JSON.parse(JSON.stringify(value));
    }

    // This is a local identity fingerprint, not a security or content hash.
    // Some callers use the complete saved-role JSON as their task identity;
    // never copy that identity into sessionStorage.
    function keyFor(value) {
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        if (OPAQUE_KEY.test(text || '')) return text;
        if (!text) throw new Error('현재 탐색을 확인할 수 없습니다. 캐릭터를 다시 선택하세요.');
        let first = 2166136261;
        let second = 2246822507;
        for (let index = 0; index < text.length; index += 1) {
            const code = text.charCodeAt(index);
            first = Math.imul(first ^ code, 16777619);
            second = Math.imul(second ^ code, 3266489909);
        }
        const hex = value => (value >>> 0).toString(16).padStart(8, '0');
        return `wash-v1:${hex(first)}${hex(second)}:${text.length}`;
    }

    function highestSameOriginWindow(start) {
        if (EMBEDDED) return start;
        let owner = start;
        while (owner) {
            try {
                const parent = owner.parent;
                if (!parent || parent === owner || parent.location.origin !== owner.location.origin) break;
                // Accessing the document also rejects opaque/cross-origin frames.
                if (!parent.document) break;
                owner = parent;
            } catch (_) {
                break;
            }
        }
        return owner;
    }

    function pick(object, keys) {
        const result = {};
        if (!object || typeof object !== 'object') return result;
        keys.forEach(key => {
            const value = object[key];
            if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) result[key] = value;
        });
        return result;
    }

    function displayView(view) {
        const result = pick(view, ['roleKey', 'roleName', 'dlcMode', 'vip', 'maxTotalPills', 'saveFingerprint']);
        if (Array.isArray(view?.targetIds)) result.targetIds = view.targetIds.map(Number).filter(Number.isFinite);
        if (Array.isArray(view?.targetNames)) result.targetNames = view.targetNames.map(String);
        return result;
    }

    function displayTalents(talents) {
        return (Array.isArray(talents) ? talents : []).map(talent => pick(talent, ['id', 'name', 'locked']));
    }

    function primitiveRecord(object) {
        if (!object || typeof object !== 'object' || Array.isArray(object)) return {};
        return pick(object, Object.keys(object));
    }

    function displayProgress(progress) {
        const output = pick(progress, [ 'phase', 'done', 'total', 'elapsedMs', 'message', 'round', 'pass', 'searchRound', 'activePillCeiling', 'maxTotalPills', 'currentPillCost', 'expandedNodes', 'rawWashesSimulated', 'generatedNodes', 'frontierPeak', 'frontierLimit', 'automatic', 'searchDepth']);
        for (const key of ['implementationRevision','algorithmVersion']) {
            if (typeof progress?.[key] === 'string' && /^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(progress[key])) output[key] = progress[key];
        }
        return output;
    }

    function operationSignature(route) {
        const operations = [];
        const add = operation => {
            const last = operations[operations.length - 1];
            if (operation.kind === 'wash' && last?.kind === 'wash' && last.locks === operation.locks) last.count += operation.count;
            else operations.push(operation);
        };
        const locksFor = ids => (ids || []).map(Number).join('.');
        const groups = route.replay?.groups;
        if (Array.isArray(groups) && groups.every(group => ['wash', 'exchange', 'upgrade', 'unlock'].includes(group?.kind))) {
            for (const group of groups) {
                if (group.kind === 'unlock') continue;
                if (group.kind === 'wash') add({ kind: 'wash', locks: locksFor(group.keepIds), count: Number(group.count || 1) });
                else if (group.kind === 'exchange') add({ kind: 'exchange', locks: locksFor((group.keepIds || []).filter(id => Number(id) !== Number(group.removedId))), from: Number(group.removedId), to: Number(group.addedId) });
                else add({ kind: 'upgrade', slots: Number(group.targetSlots) });
            }
            return JSON.stringify(operations);
        }
        // The lightweight snapshot keeps this physical signature, never the
        // replay/start key or the original character. Validate its shape before
        // using it so old or malformed storage can still fall back to steps.
        if (typeof route.operationSignature === 'string') {
            try {
                const saved = JSON.parse(route.operationSignature);
                if (Array.isArray(saved) && saved.every(operation => operation && (
                    operation.kind === 'wash' && /^\d*(?:\.\d+)*$/.test(operation.locks) && Number.isSafeInteger(operation.count) && operation.count > 0
                    || operation.kind === 'exchange' && /^\d*(?:\.\d+)*$/.test(operation.locks) && Number.isSafeInteger(operation.from) && Number.isSafeInteger(operation.to)
                    || operation.kind === 'upgrade' && Number.isInteger(operation.slots) && operation.slots >= 1 && operation.slots <= 4
                ))) {
                    for (const operation of saved) {
                        if (operation.kind === 'wash') add({ kind: 'wash', locks: operation.locks, count: operation.count });
                        else if (operation.kind === 'exchange') add({ kind: 'exchange', locks: operation.locks.split('.').filter(id => id !== String(operation.from)).join('.'), from: operation.from, to: operation.to });
                        else add({ kind: 'upgrade', slots: operation.slots });
                    }
                    return JSON.stringify(operations);
                }
            } catch (_) { /* Legacy snapshots have only rendered steps. */ }
        }
        const steps = Array.isArray(route.steps) ? route.steps : [];
        const names = new Map();
        for (const talent of [...steps.flatMap(step => step.after?.talents || []), ...(route.finalTalents || [])]) {
            if (talent.name && Number.isFinite(Number(talent.id))) names.set(talent.name, Number(talent.id));
        }
        for (const step of steps) {
            if (['unlock', 'verify'].includes(step.type)) continue;
            const locks = locksFor((step.after?.talents || []).filter(talent => talent.locked).map(talent => talent.id));
            if (step.type === 'wash') add({ kind: 'wash', locks, count: Number(step.washes || 0) });
            else if (step.type === 'upgrade') {
                const match = String(step.label || '').match(/开启第([一二三四1-4])脉/);
                const slots = match ? Number({ 一: 1, 二: 2, 三: 3, 四: 4 }[match[1]] || match[1]) : null;
                add(slots ? { kind: 'upgrade', slots } : { kind: 'upgrade', instruction: String(step.detail || '') });
            } else if (step.type === 'exchange') {
                const match = String(step.detail || '').match(/置换「([^」]+)」.*得到「([^」]+)」/);
                const fromName = match?.[1] || '', toName = match?.[2] || String(step.expectedName || '');
                add(match ? { kind: 'exchange', locks, from: names.get(fromName) ?? fromName, to: names.get(toName) ?? toName }
                    : { kind: 'exchange', locks, instruction: String(step.detail || ''), expected: toName });
            } else {
                // Preserve unfamiliar player instructions rather than merging
                // routes based only on matching totals or final talents.
                add({ kind: String(step.type || ''), instruction: String(step.detail || ''), washes: Number(step.washes || 0), locks });
            }
        }
        return JSON.stringify(operations);
    }

    function routeKey(route) {
        return JSON.stringify({
            totalPills: route.totalPills, totalWashes: route.totalWashes,
            finalTalents: (route.finalTalents || []).map(talent => Number(talent.id)),
            operations: operationSignature(route),
        });
    }

    // Persist only the rendered route. Replay.startKey contains the original
    // role/save and must remain in memory with the worker input.
    function displayResult(result) {
        if (!result || typeof result !== 'object') return null;
        const output = pick(result, ['strength', 'objective', 'resumedCount', 'noResultReason', 'firstRoutePills']);
        output.targetIds = (result.targetIds || []).map(Number).filter(Number.isFinite);
        output.targetNames = (result.targetNames || []).map(String);
        output.searchScope = pick(result.searchScope, ['expandedNodes', 'rawWashesSimulated', 'generatedNodes', 'frontierPeak', 'frontierLimit', 'prunedByFrontier', 'dominatedNodes', 'conflictAnchors', 'targetSacrificeBranches', 'firstExchangePadsChecked', 'prunedByPills', 'maxTotalPills', 'searchDepth', 'initialLuckSeedInited', 'strategyGraph', 'automatic', 'round', 'searchRound', 'stopReason']);
        Object.assign(output.searchScope, pick(result.searchScope, ['algorithm', 'implementationRevision',
            'exactExpandedNodes', 'exactPendingStates', 'minimumPillCost', 'exhaustiveAllActions',
            'provenNoRouteWithinBudget', 'resourceObjective', 'liveGameVerified']));
        output.routes = (Array.isArray(result.routes) ? result.routes : []).map(route => {
            const saved = pick(route, ['kind', 'verified', 'verifiedOptimal', 'branchId', 'branchLabel', 'strategyLabel', 'totalPills', 'totalWashes', 'totalTalentBars', 'exchangeCount']);
            Object.assign(saved, pick(route, ['algorithm', 'algorithmVersion']));
            if (route.optimality) saved.optimality = primitiveRecord(route.optimality);
            saved.operationSignature = operationSignature(route);
            saved.slotPath = (route.slotPath || []).map(Number).filter(Number.isFinite);
            saved.finalTalents = displayTalents(route.finalTalents);
            saved.costBreakdown = primitiveRecord(route.costBreakdown);
            saved.inventory = primitiveRecord(route.inventory);
            saved.steps = (Array.isArray(route.steps) ? route.steps : []).map(step => ({
                ...pick(step, ['type', 'label', 'detail', 'expectedName', 'washes', 'unitCost', 'pills', 'cumulativePills', 'cumulativeWashes', 'cumulativeTalentBars']),
                after: { talents: displayTalents(step.after?.talents) },
            }));
            return saved;
        });
        output.routes = [...new Map(output.routes.map(route => [routeKey(route), route])).values()];
        return output;
    }

    function createManager(owner) {
        const checkpointKey = EMBEDDED ? 'sbj-community-wash-checkpoints-v1' : 'sbj-wash-private-checkpoints-v1';
        let checkpoints = {};
        try { checkpoints = EMBEDDED ? {} : JSON.parse(owner.sessionStorage.getItem(checkpointKey) || '{}') || {}; } catch (_) {}
        function saveCheckpoint() {
            if (EMBEDDED) return;
            const route = state.result?.routes?.[0];
            if (!control?.bundleHash || !Array.isArray(route?.replay?.groups)) return;
            const groups = route.replay.groups;
            if (groups.some(g => !['wash','exchange','upgrade','unlock'].includes(g.kind))) return;
            // Keep only operations and model states; never persist original role/save.
            const safe = displayResult({routes:[route]}).routes[0];
            safe.replay = {version:'wash-route-v029',groups:groups.map(g => ({
                ...pick(g,['kind','count','removedId','addedId','targetSlots','cost','mode']),
                keepIds:(g.keepIds || []).map(Number), releasedIds:(g.releasedIds || []).map(Number),
                after:{...pick(g.after,['zizhi','bornSeed','bornRC','luckSeed','talLucky']),talents:(g.after?.talents || []).map(Number)},
            }))};
            checkpoints[state.taskKey] = {hash:control.bundleHash,route:safe,
                round:state.progress?.optimizationRound || state.result?.searchScope?.optimizationRound || 0};
            const keys = Object.keys(checkpoints);
            while (keys.length > 8) delete checkpoints[keys.shift()];
            try { const raw = JSON.stringify(checkpoints); if(raw.length < 2*1024*1024) owner.sessionStorage.setItem(checkpointKey,raw); } catch (_) {}
        }
        function resumable(taskKey, bundleHash) {
            if (!taskKey || !bundleHash) return null;
            const saved = checkpoints[keyFor(taskKey)];
            return saved && saved.hash === bundleHash && Array.isArray(saved.route?.replay?.groups) ? clone(saved) : null;
        }
        let control = null;
        let input = null;
        let generation = 0;
        let lastPersistedAt = 0;
        const listeners = new Set();
        const idle = () => ({ schema: SCHEMA, status: 'idle', taskKey: '', view: {}, progress: null, result: null, resultRevision: 0, firstRoutePills: null, error: '', startedAt: null, updatedAt: Date.now(), completedAt: null, restored: false });
        let state = idle();

        try {
            const saved = EMBEDDED ? null : JSON.parse(owner.sessionStorage.getItem(STORAGE_KEY) || 'null');
            if (saved?.schema === SCHEMA && ['running', ...TERMINAL].includes(saved.status) && OPAQUE_KEY.test(saved.taskKey || '')) {
                state = {
                    ...idle(),
                    ...pick(saved, ['taskKey', 'error', 'startedAt', 'updatedAt', 'completedAt', 'resultRevision', 'firstRoutePills']),
                    status: saved.status === 'running' ? 'stopped' : saved.status,
                    view: displayView(saved.view),
                    progress: displayProgress(saved.progress),
                    result: displayResult(saved.result),
                    restored: true,
                };
                if (state.firstRoutePills == null || !Number.isFinite(state.firstRoutePills) || state.firstRoutePills < 0) {
                    state.firstRoutePills = state.result?.firstRoutePills ?? state.result?.routes?.[0]?.totalPills ?? null;
                }
                if (state.result && state.firstRoutePills != null) {
                    state.result.firstRoutePills = state.firstRoutePills;
                    state.result.routes = state.result.routes.filter(route => route.totalPills <= state.firstRoutePills);
                }
                if (saved.status === 'running') {
                    state.progress = { ...state.progress, phase: 'stopped', message: '이전 탐색이 중단됐습니다. 다시 시작할 수 있습니다.' };
                    state.stopReason = 'page-reloaded';
                }
                if (state.status === 'complete' && !state.result?.routes?.length) state = idle();
            }
        } catch (_) {
            // Private mode, storage limits, or old data must not prevent search.
        }

        function snapshot() { return clone(state); }

        function persist(force) {
            if (EMBEDDED) return;
            const now = Date.now();
            if (!force && now - lastPersistedAt < 750) return;
            lastPersistedAt = now;
            saveCheckpoint();
            try {
                owner.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                    ...pick(state, ['schema', 'status', 'taskKey', 'error', 'startedAt', 'updatedAt', 'completedAt', 'stopReason', 'resultRevision', 'firstRoutePills']),
                    view: displayView(state.view),
                    progress: displayProgress(state.progress),
                    result: displayResult(state.result),
                }));
            } catch (_) { /* Persistence is optional; the live task remains valid. */ }
        }

        function notify(forcePersist) {
            persist(forcePersist);
            listeners.forEach(listener => {
                try { listener(snapshot()); } catch (_) { /* A detached view cannot stop the task. */ }
            });
        }

        function disposeWorker() {
            const previous = control;
            if (!previous) return;
            control = null;
            previous.settled = true;
            previous.worker.onmessage = null;
            previous.worker.onerror = null;
            try { previous.worker.terminate(); } catch (_) { /* Already terminated. */ }
            try { owner.URL.revokeObjectURL(previous.blobUrl); } catch (_) { /* Already revoked. */ }
        }

        function finish(status, result, error) {
            saveCheckpoint();
            disposeWorker();
            if (result) assignResult(result);
            const now = Date.now();
            state = {
                ...state, status, updatedAt: now, completedAt: now,
                error: error || '',
                progress: status === 'complete'
                    ? { ...(state.progress || {}), phase: 'complete', done: 1, total: 1, message: '목표를 만족하는 경로를 찾았습니다.' }
                    : { ...(state.progress || {}), phase: status, message: error || '탐색을 중지했습니다.' },
            };
            notify(true);
        }

        function verifiedRoutes(result) {
            if (!result || !Array.isArray(result.routes)) return [];
            const targets = (input?.targetIds || []).map(Number);
            const configuredBudget = Number(input?.options?.maxTotalPills);
            const budget = input?.options?.maxTotalPills != null && Number.isFinite(configuredBudget)
                ? Math.max(0, configuredBudget) : Infinity;
            return result.routes.filter(candidate => {
                if (candidate?.verified !== true || !Array.isArray(candidate.finalTalents)) return false;
                if (!Number.isFinite(candidate.totalPills) || candidate.totalPills < 0 || candidate.totalPills > budget) return false;
                const ids = new Set(candidate.finalTalents.map(talent => Number(talent.id)));
                return targets.length > 0 && targets.every(id => ids.has(id));
            });
        }

        function mergeResult(result) {
            const verified = verifiedRoutes(result);
            if (state.firstRoutePills == null && verified.length) state.firstRoutePills = verified[0].totalPills;
            const routes = verified.filter(route => state.firstRoutePills == null || route.totalPills <= state.firstRoutePills);
            const previous = state.result?.routes || [];
            if (!routes.length) return previous.length ? state.result : null;
            const unique = new Map();
            previous.concat(routes).forEach(route => {
                const key = routeKey(route);
                if (!unique.has(key)) unique.set(key, clone(route));
            });
            return {
                ...(state.result || {}), ...clone(result),
                firstRoutePills: state.firstRoutePills,
                routes: [...unique.values()].sort((left, right) => left.totalPills - right.totalPills
                    || Number(left.totalWashes || 0) - Number(right.totalWashes || 0)
                    || Number(left.exchangeCount || 0) - Number(right.exchangeCount || 0)),
            };
        }

        function assignResult(result) {
            const previousKeys = new Set((state.result?.routes || []).map(routeKey));
            const added = result.routes.filter(route => !previousKeys.has(routeKey(route))).length;
            state.result = result;
            if (added) state.resultRevision = Number(state.resultRevision || 0) + added;
        }

        function start(config) {
            const taskKey = keyFor(config?.taskKey);
            if (state.status === 'running' && state.taskKey === taskKey) return snapshot();
            disposeWorker();
            generation += 1;
            input = null;
            const now = Date.now();
            state = { ...idle(), status: 'running', taskKey, view: displayView(config?.view), startedAt: now, updatedAt: now, progress: { phase: 'worker-start', done: 0, total: 1, message: '로컬 경로 탐색 시작 중' } };
            let worker;
            let blobUrl;
            try {
                if (!config?.input || typeof config.input !== 'object') throw new Error('세수 시작 상태가 없습니다. 캐릭터를 다시 선택하세요.');
                input = clone(config.input);
                if (!Array.isArray(input.targetIds) || !input.targetIds.length || input.targetIds.some(id => !Number.isFinite(Number(id)))) throw new Error('목표 재능을 먼저 선택하세요.');
                input.automatic = true;
                input.options = { ...(input.options || {}), automatic: true, mode: 'automatic' };
                if (input.savedRole && !input.ruleContextUrl) throw new Error('세수 데이터가 불완전합니다. 새로고침 후 다시 시도하세요.');
                if (input.ruleContextUrl) {
                    const helperUrl = new owner.URL(input.ruleContextUrl, owner.location.href);
                    if (helperUrl.origin !== owner.location.origin) throw new Error('세수 규칙은 현재 도구와 같은 출처여야 합니다. 새로고침 후 다시 시도하세요.');
                    input.ruleContextUrl = helperUrl.href;
                }
                const bundle = config.bundle || root.WASH_ROUTE_WORKER_BUNDLE || owner.WASH_ROUTE_WORKER_BUNDLE;
                if (!bundle || typeof bundle.src !== 'string' || !bundle.src || typeof bundle.hash !== 'string') throw new Error('로컬 탐색 리소스가 완전히 로드되지 않았습니다. 새로고침 후 다시 시도하세요.');
                const saved = config.restart ? null : resumable(taskKey, bundle.hash);
                if (config.restart) { delete checkpoints[taskKey]; try { owner.sessionStorage.setItem(checkpointKey,JSON.stringify(checkpoints)); } catch (_) {} }
                if (saved) {
                    input.options.resumeBestRoute = saved.route;
                    input.options.resumeOptimizationRound = saved.round;
                    state.progress.message = `저장된 세수단 ${saved.route.totalPills}개 사용 경로를 검증하는 중`;
                }
                blobUrl = owner.URL.createObjectURL(new owner.Blob([bundle.src], {type: 'text/javascript'}));
                worker = new owner.Worker(blobUrl);
                const requestId = `wash-${now}-${generation}-${Math.random().toString(36).slice(2)}`;
                const current = { worker, blobUrl, requestId, generation, settled: false, bundleHash: bundle.hash };
                control = current;
                const isCurrent = () => control === current && !current.settled && current.generation === generation;
                worker.onmessage = event => {
                    const message = event?.data || {};
                    if (!isCurrent() || message.requestId !== requestId) return;
                    try {
                        if (message.type === 'progress') {
                            state.progress = clone(message.progress || {});
                            state.updatedAt = Date.now();
                            notify(false);
                        } else if (message.type === 'candidate' || message.type === 'result') {
                            const result = mergeResult(message.result);
                            if (message.type === 'candidate') {
                                if (result) {
                                    assignResult(result);
                                    state.updatedAt = Date.now();
                                    notify(true);
                                }
                            } else if (message.result?.status === 'invalid' && message.result.noResultReason) {
                                finish('error', result, String(message.result.noResultReason));
                            } else if (message.result?.status === 'not-found'
                                && message.result.searchScope?.provenNoRouteWithinBudget === true
                                && message.result.noResultReason) {
                                finish('error', result, String(message.result.noResultReason));
                            } else if (message.result?.cancelled) {
                                if (message.result.searchScope?.stopReason === 'resource-limit') state.stopReason = 'resource-limit';
                                if (message.result.searchScope?.stopReason === 'optimization-limit') state.stopReason = 'optimization-limit';
                                if (!result?.routes?.length) state.stopReason = 'search-incomplete';
                                finish('stopped', result, '');
                            } else if (result) {
                                finish('complete', result, '');
                            } else {
                                finish('error', null, '백그라운드 탐색이 일찍 종료되어 검증된 전체 경로를 받지 못했습니다. 새로고침 후 다시 시도하세요.');
                            }
                        } else if (message.type === 'error') {
                            finish('error', null, String(message.error || '백그라운드 탐색 실패. 새로고침 후 다시 시도하세요.'));
                        }
                    } catch (error) {
                        finish('error', null, `백그라운드 경로 데이터 오류: ${error?.message || '새로고침 후 다시 시도하세요'}`);
                    }
                };
                worker.onerror = event => {
                    if (!isCurrent()) return;
                    event?.preventDefault?.();
                    finish('error', null, `백그라운드 계산 스레드 오류: ${event?.message || '새로고침 후 다시 시도하세요'}`);
                };
                notify(true);
                if (isCurrent()) worker.postMessage({ type: 'start', requestId, input });
            } catch (error) {
                if (!control && blobUrl) {
                    try { worker?.terminate(); } catch (_) { /* No live worker. */ }
                    try { owner.URL.revokeObjectURL(blobUrl); } catch (_) { /* No live URL. */ }
                }
                finish('error', null, String(error?.message || error || '백그라운드 탐색 실패'));
            }
            return snapshot();
        }

        function cancel(taskKey) {
            if (state.status !== 'running' || (taskKey != null && state.taskKey !== keyFor(taskKey))) return false;
            state.stopReason = 'user';
            finish('stopped', null, '');
            return true;
        }

        return Object.freeze({
            start, cancel, snapshot, keyFor,
            resumable,
            importCheckpoint(taskKey, bundleHash, checkpoint) {
                if (state.status === 'running') throw new Error('진행 중인 탐색을 중지한 뒤 경로를 불러오세요.');
                const saved = clone(checkpoint);
                if (!saved?.route?.replay || !Array.isArray(saved.route.replay.groups)) throw new Error('클라우드 경로 데이터가 불완전합니다.');
                checkpoints[keyFor(taskKey)] = {...saved,hash:bundleHash};
                try { const raw=JSON.stringify(checkpoints); if(raw.length<2*1024*1024)owner.sessionStorage.setItem(checkpointKey,raw); } catch (_) {}
            },
            getInput: () => clone(input),
            subscribe(listener) {
                if (typeof listener !== 'function') throw new TypeError('탐색 알림 콜백은 함수여야 합니다.');
                listeners.add(listener);
                try { listener(snapshot()); } catch (_) { /* Isolate each view. */ }
                return () => listeners.delete(listener);
            },
            clear() {
                disposeWorker();
                generation += 1;
                input = null;
                state = idle();
                try { owner.sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* Optional storage. */ }
                listeners.forEach(listener => { try { listener(snapshot()); } catch (_) { /* Detached view. */ } });
                return snapshot();
            },
        });
    }

    function getLocal(owner) {
        if (!owner[SINGLETON]) owner[SINGLETON] = createManager(owner);
        return owner[SINGLETON];
    }

    root.WashSearchManager = Object.freeze({
        keyFor,
        get() {
            const owner = highestSameOriginWindow(root);
            if (owner === root) return getLocal(root);
            return owner.WashSearchManager?._getLocal?.() || null;
        },
        ready() {
            const owner = highestSameOriginWindow(root);
            if (owner === root) return Promise.resolve(getLocal(root));
            if (owner.WashSearchManager?._getLocal) return Promise.resolve(owner.WashSearchManager._getLocal());
            if (owner[LOADING]) return owner[LOADING];
            const loading = new Promise((resolve, reject) => {
                try {
                    if (!scriptSource) throw new Error('백그라운드 작업 관리 리소스 주소가 없습니다. 새로고침 후 다시 시도하세요.');
                    const url = new owner.URL(scriptSource, root.location.href);
                    if (url.origin !== owner.location.origin) throw new Error('백그라운드 작업 리소스는 현재 도구와 같은 출처여야 합니다.');
                    const script = owner.document.createElement('script');
                    script.src = url.href;
                    script.async = true;
                    script.onload = () => {
                        if (owner.WashSearchManager?._getLocal) resolve(owner.WashSearchManager._getLocal());
                        else reject(new Error('백그라운드 작업 관리 리소스가 완전히 로드되지 않았습니다. 새로고침 후 다시 시도하세요.'));
                    };
                    script.onerror = () => reject(new Error('백그라운드 작업 관리 리소스 로드 실패. 새로고침 후 다시 시도하세요.'));
                    const head = owner.document.head || owner.document.documentElement;
                    if (!head) throw new Error('백그라운드 작업 실행기가 준비되지 않았습니다. 새로고침 후 다시 시도하세요.');
                    head.appendChild(script);
                } catch (error) { reject(error); }
            });
            owner[LOADING] = loading;
            loading.catch(() => { if (owner[LOADING] === loading) delete owner[LOADING]; });
            return loading;
        },
        _getLocal: () => getLocal(root),
    });
})(typeof window !== 'undefined' ? window : globalThis);
