function refreshLucideIcons() {
    if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;

    const alias = {
        washer: 'washing-machine',
        dryer: 'wind',
        mirror: 'scan',
        elevator: 'arrow-up-down',
        hanger: 'shirt',
        'trash-2': 'trash'
    };

    const icons = window.lucide.icons || {};

    document.querySelectorAll('[data-lucide]').forEach((el) => {
        const name = el.getAttribute('data-lucide');
        if (!name) return;

        let finalName = alias[name] || name;
        if (finalName && icons && !icons[finalName]) {
            finalName = icons.circle ? 'circle' : finalName;
        }

        if (finalName !== name) el.setAttribute('data-lucide', finalName);
    });

    window.lucide.createIcons();
}

refreshLucideIcons();

        function appData() {
            return {
                init() {
                    try {
                        this.agentToken = localStorage.getItem('agent_token') || '';
                    } catch (e) {
                        this.agentToken = '';
                    }

                    this.agentInitCooldowns();
                    this.agentApplyDownlineDateDefaults(true);
                    this.agentApplySalesDefaults(true);

                    if (this.agentToken) {
                        this.agentFetchMe().catch(() => {
                            this.agentLogout(false);
                        });
                    }
                },
                lang: 'sc', // sc, tc, en
                page: 'home',

                // ===== Mobile Nav =====
                mobileNavOpen: false,

                // ===== AMap Embed (Page 4B reserved map area) =====
                amapEmbedInited: false,
                amapEmbedMap: null,

                initAmapEmbed() {
                    const container = document.getElementById('amap-embed');
                    if (!container) return;

                    const tryInit = () => {
                        if (!window.AMap || !window.AMap.Map) return false;

                        if (!this.amapEmbedMap) {
                            try {
                                this.amapEmbedMap = new AMap.Map('amap-embed', {
                                    zoom: 12,
                                    center: [114.1694, 22.3193],
                                    viewMode: '2D'
                                });

                                try {
                                    this.amapEmbedMap.addControl(new AMap.ToolBar({ position: 'RB' }));
                                    this.amapEmbedMap.addControl(new AMap.Scale());
                                } catch (e) {
                                    // ignore plugin load issues
                                }

                                // Sample markers (HK)
                                const markers = [
                                    { pos: [114.1422, 22.2866], title: this.t[this.lang].apt_syp || '西营盘' },
                                    { pos: [114.1706, 22.3116], title: this.t[this.lang].apt_ymt || '油麻地' }
                                ];
                                markers.forEach(m => {
                                    new AMap.Marker({
                                        position: m.pos,
                                        title: m.title,
                                        anchor: 'bottom-center',
                                        map: this.amapEmbedMap
                                    });
                                });

                                this.amapEmbedInited = true;
                            } catch (e) {
                                return false;
                            }
                        }

                        // Ensure correct render after x-show
                        try {
                            this.amapEmbedMap && this.amapEmbedMap.resize && this.amapEmbedMap.resize();
                        } catch (e) {
                            // ignore
                        }

                        this.amapEmbedInited = true;
                        return true;
                    };

                    if (this.amapEmbedInited && this.amapEmbedMap) {
                        tryInit();
                        return;
                    }

                    // Retry a few times in case JSAPI is still loading
                    let attempts = 0;
                    const timer = setInterval(() => {
                        attempts += 1;
                        if (tryInit() || attempts >= 20) {
                            clearInterval(timer);
                        }
                    }, 150);
                },

                // ===== WeChat Popup (Template) =====
                wechatModalOpen: false,
                wechatId: 'SDLV_Consultant_001',
                wechatQrSrc: 'https://static.sdlvhk.com/图片素材/other/qrc.png',
                wechatCopied: false,

                // ===== Consult Floating Widget =====
                floatFabOpen: false,

                openWeChatModal() {
                    this.wechatCopied = false;
                    this.wechatModalOpen = true;
                },

                closeWeChatModal() {
                    this.wechatModalOpen = false;
                },

                async copyWeChatId() {
                    const text = String(this.wechatId || '').trim();
                    if (!text) return;

                    let ok = false;
                    try {
                        if (navigator?.clipboard?.writeText) {
                            await navigator.clipboard.writeText(text);
                            ok = true;
                        }
                    } catch (e) {
                        ok = false;
                    }

                    if (!ok) {
                        try {
                            const ta = document.createElement('textarea');
                            ta.value = text;
                            ta.style.position = 'fixed';
                            ta.style.opacity = '0';
                            document.body.appendChild(ta);
                            ta.focus();
                            ta.select();
                            ok = document.execCommand('copy');
                            document.body.removeChild(ta);
                        } catch (e) {
                            ok = false;
                        }
                    }

                    if (ok) {
                        this.wechatCopied = true;
                        setTimeout(() => { this.wechatCopied = false; }, 1500);
                    }
                },

                // ===== Agent Portal State =====
                agentToken: '',
                agentUser: null,
                agentBusy: false,
                agentNotice: '',
                agentNoticeType: 'info', // info|success|error
                agentLoginMode: 'password',
                agentShowReset: false,
                agentForm: { phone: '', password: '', code: '' },
                agentResetForm: { phone: '', code: '', newPassword: '' },
                agentRegisterForm: { phone: '', password: '', role: 'consultant', code: '', idCard: '', idCardName: '' },

                // Per-purpose SMS code cooldown (ms epoch). Purposes: login | reset_password | register
                agentCodeCooldown: { login: 0, reset_password: 0, register: 0 },
                agentCodeCooldownNow: Date.now(),
                agentCodeCooldownTimerId: null,

                agentChildren: [],
                agentOrders: [],
                agentDownlineOrders: [],
                agentLogs: [],
                agentAllUsers: [],

                // ===== Overview: Sales Pies =====
                agentSalesMonth: { startDate: '', endDate: '', myAmount: 0, downlineAmount: 0, total: 0 },
                agentSalesCustom: { startDate: '', endDate: '', myAmount: 0, downlineAmount: 0, total: 0 },
                agentSalesCustomFilters: { startDate: '', endDate: '' },

                // ===== Overview: Sales Trend (Line) =====
                agentSalesTrend: { startDate: '', endDate: '', labels: [], myAmounts: [], downlineAmounts: [] },
                agentSalesTrendFilters: { startDate: '', endDate: '' },
                agentSalesTrendHover: { active: false, i: 0, px: 0, w: 0 },

                agentDashTab: 'overview', // overview | register_sub | downline_orders | change_password
                agentChangePasswordForm: { oldPassword: '', newPassword: '', confirmPassword: '' },

                agentDownlineFilters: { q: '', status: '', role: '', startDate: '', endDate: '' },
                agentEditOrderOpen: false,
                agentEditOrderId: null,
                agentEditOrderNo: '',
                agentEditOrderForm: {
                    bindUserId: null,
                    serviceName: 'EAC',
                    amount: '',
                    status: '已创单',
                    parentName: '',
                    parentGender: '',
                    parentPhone: '',
                    studentName: '',
                    studentGender: '男',
                    studentPhone: '',
                    extraServiceWeight: '',
                    studentIdCard: ''
                },
                agentOrderForm: {
                    bindUserId: null,
                    serviceName: 'EAC',
                    amount: '',
                    status: '已创单',
                    parentName: '',
                    parentGender: '',
                    parentPhone: '',
                    studentName: '',
                    studentGender: '男',
                    studentPhone: '',
                    extraServiceWeight: '',
                    studentIdCard: ''
                },

                dash(v) {
                    if (v === null || v === undefined) return '-';
                    const s = String(v);
                    return s.trim() ? s : '-';
                },

                agentRoleLabel(role) {
                    const r = String(role || '').trim();
                    if (r === 'admin') return '管理员';
                    if (r === 'consultant') return '顾问';
                    if (r === 'agent1') return '1级代理';
                    if (r === 'agent2') return '2级代理';
                    if (r === 'agent3') return '3级代理';
                    if (r === 'agent4') return '4级代理';
                    return '账号';
                },

                agentRoleRank(role) {
                    const r = String(role || '').trim();
                    if (r === 'admin') return 0;
                    if (r === 'consultant') return 1;
                    if (r === 'agent1') return 2;
                    if (r === 'agent2') return 3;
                    if (r === 'agent3') return 4;
                    if (r === 'agent4') return 5;
                    return 999;
                },

                agentRoleLevel(role) {
                    const r = String(role || '').trim();
                    if (r === 'agent1') return 1;
                    if (r === 'agent2') return 2;
                    if (r === 'agent3') return 3;
                    if (r === 'agent4') return 4;
                    return null;
                },

                agentDownlineRoleOptions() {
                    const baseRank = this.agentRoleRank(this.agentUser?.role);
                    const all = ['consultant', 'agent1', 'agent2', 'agent3', 'agent4'];
                    return all.filter(r => this.agentRoleRank(r) >= baseRank);
                },

                agentMaskPhone(phone) {
                    const digits = String(phone || '').replace(/\D/g, '');
                    if (!digits) return '-';
                    if (digits.length >= 11) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
                    if (digits.length >= 7) return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
                    if (digits.length >= 4) {
                        const stars = '*'.repeat(Math.max(1, digits.length - 4));
                        return `${digits.slice(0, 2)}${stars}${digits.slice(-2)}`;
                    }
                    return digits;
                },

                agentUserHeaderLabel() {
                    const name = String(this.agentUser?.idCardName || '').trim() || this.agentRoleLabel(this.agentUser?.role);
                    const maskedPhone = this.agentMaskPhone(this.agentUser?.phone);
                    return `${name}（${maskedPhone}）`;
                },

                agentInitCooldowns() {
                    // Restore cooldowns across refresh
                    try {
                        const raw = localStorage.getItem('agent_code_cooldown_v1');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && typeof parsed === 'object') {
                                this.agentCodeCooldown = {
                                    login: Number(parsed.login || 0),
                                    reset_password: Number(parsed.reset_password || 0),
                                    register: Number(parsed.register || 0)
                                };
                            }
                        }
                    } catch (e) {
                        // ignore
                    }

                    // Kick a ticking value so Alpine refreshes countdown labels
                    if (!this.agentCodeCooldownTimerId) {
                        this.agentCodeCooldownNow = Date.now();
                        this.agentCodeCooldownTimerId = setInterval(() => {
                            this.agentCodeCooldownNow = Date.now();
                        }, 1000);
                    }
                },

                agentPersistCooldowns() {
                    try {
                        localStorage.setItem('agent_code_cooldown_v1', JSON.stringify(this.agentCodeCooldown));
                    } catch (e) {
                        // ignore
                    }
                },

                agentStartCodeCooldown(purpose, seconds = 60) {
                    const safePurpose = ['login', 'reset_password', 'register'].includes(purpose) ? purpose : 'login';
                    const expiresAt = Date.now() + Math.max(1, Number(seconds) || 60) * 1000;
                    this.agentCodeCooldown[safePurpose] = expiresAt;
                    this.agentPersistCooldowns();
                },

                agentCodeCooldownRemaining(purpose) {
                    const expiresAt = Number(this.agentCodeCooldown?.[purpose] || 0);
                    const msLeft = expiresAt - Number(this.agentCodeCooldownNow || Date.now());
                    if (msLeft <= 0) return 0;
                    return Math.ceil(msLeft / 1000);
                },

                agentCodeCooldownActive(purpose) {
                    return this.agentCodeCooldownRemaining(purpose) > 0;
                },

                agentCodeButtonText(purpose, idleText) {
                    const s = this.agentCodeCooldownRemaining(purpose);
                    if (s > 0) {
                        const base = (String(idleText || '').includes('发送')) ? '重新发送' : '重新获取';
                        return `${base}(${s}s)`;
                    }
                    return idleText;
                },

                parseDateMaybe(v) {
                    if (v === null || v === undefined) return null;
                    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
                    if (typeof v === 'number') {
                        const d = new Date(v);
                        return Number.isNaN(d.getTime()) ? null : d;
                    }

                    const s0 = String(v).trim();
                    if (!s0) return null;

                    // MySQL DATETIME like: 2026-01-31 10:06:44
                    // Treat as UTC to match ISO '...Z' semantics used by API.
                    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s0)) {
                        const d = new Date(s0.replace(' ', 'T') + 'Z');
                        return Number.isNaN(d.getTime()) ? null : d;
                    }

                    const d = new Date(s0);
                    return Number.isNaN(d.getTime()) ? null : d;
                },

                fmtCN(v) {
                    const d = this.parseDateMaybe(v);
                    if (!d) return '-';

                    try {
                        const parts = new Intl.DateTimeFormat('zh-CN', {
                            timeZone: 'Asia/Shanghai',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        }).formatToParts(d);

                        const map = {};
                        for (const p of parts) {
                            if (p.type !== 'literal') map[p.type] = p.value;
                        }
                        return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
                    } catch (e) {
                        // Fallback: still show something
                        return d.toISOString();
                    }
                },

                agentNotify(message, type = 'info') {
                    this.agentNotice = message;
                    this.agentNoticeType = type;
                    setTimeout(() => {
                        if (this.agentNotice === message) this.agentNotice = '';
                    }, 5000);
                },

                agentSetDashTab(tab) {
                    const t = String(tab || '').trim();
                    const allowed = ['overview', 'register_sub', 'downline_orders', 'change_password'];
                    this.agentDashTab = allowed.includes(t) ? t : 'overview';

                    // Lazy-load downline orders when entering the tab.
                    if (this.agentDashTab === 'downline_orders') {
                        this.agentApplyDownlineDateDefaults(false);
                        this.agentFetchDownlineOrders().catch(() => {});
                    }

                    // Ensure overview charts stay fresh when returning to overview.
                    if (this.agentDashTab === 'overview') {
                        this.agentApplySalesDefaults(false);
                        this.agentApplySalesTrendDefaults(false);
                        this.agentRefreshSalesPies().catch(() => {});
                        this.agentRefreshSalesTrend().catch(() => {});
                    }
                },

                agentMoney(v) {
                    const n = Number(v);
                    if (!Number.isFinite(n)) return '-';
                    try {
                        return new Intl.NumberFormat('zh-CN', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                        }).format(n);
                    } catch (e) {
                        return String(Math.round(n * 100) / 100);
                    }
                },

                agentPct(rate) {
                    const r = Number(rate);
                    if (!Number.isFinite(r) || r <= 0) return '';
                    const pct = r * 100;
                    const rounded = Math.round(pct * 100) / 100;
                    const s = String(rounded).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
                    return `${s}%`;
                },

                agentCommissionRateForMe(order) {
                    const r = Number(order?.commissionRateForMe);
                    if (Number.isFinite(r)) return r;

                    // Fallback: if API hasn't provided commission fields yet.
                    const level = this.agentRoleLevel(this.agentUser?.role);
                    if (level === 1) return 0.13;
                    if (level === 2 || level === 3 || level === 4) return 0.08;
                    return 0;
                },

                agentCommissionForMe(order) {
                    const v = Number(order?.commissionForMe);
                    if (Number.isFinite(v)) return v;
                    const amount = Number(order?.amount || 0);
                    const rate = this.agentCommissionRateForMe(order);
                    const n = amount * rate;
                    return Number.isFinite(n) ? (Math.round(n * 100) / 100) : 0;
                },

                agentCommissionText(order) {
                    const amount = Number(order?.amount);
                    if (!Number.isFinite(amount)) return '-';
                    const commission = this.agentCommissionForMe(order);
                    const rate = this.agentCommissionRateForMe(order);
                    const pct = this.agentPct(rate);
                    return pct ? `${this.agentMoney(commission)} (${pct})` : this.agentMoney(commission);
                },

                agentMyOrdersCommissionTotal() {
                    const arr = Array.isArray(this.agentOrders) ? this.agentOrders : [];
                    return Math.round(arr.reduce((sum, o) => sum + this.agentCommissionForMe(o), 0) * 100) / 100;
                },

                agentDownlineOrdersCommissionTotal() {
                    const arr = Array.isArray(this.agentDownlineOrders) ? this.agentDownlineOrders : [];
                    return Math.round(arr.reduce((sum, o) => sum + this.agentCommissionForMe(o), 0) * 100) / 100;
                },

                agentTotalCommissionTotal() {
                    const n = this.agentMyOrdersCommissionTotal() + this.agentDownlineOrdersCommissionTotal();
                    return Math.round(n * 100) / 100;
                },

                agentPieStyle(pie) {
                    const my = Number(pie?.myAmount || 0);
                    const down = Number(pie?.downlineAmount || 0);
                    const total = Number(pie?.total || 0);
                    const t = Number.isFinite(total) && total > 0 ? total : (my + down);
                    const pct = t > 0 ? Math.max(0, Math.min(100, (my / t) * 100)) : 0;
                    // Gold = my; light = downline
                    return `background: conic-gradient(rgba(251,191,36,0.95) 0 ${pct}%, rgba(255,255,255,0.18) ${pct}% 100%);`;
                },

                agentGetShanghaiYearMonth(date = new Date()) {
                    try {
                        const parts = new Intl.DateTimeFormat('en-CA', {
                            timeZone: 'Asia/Shanghai',
                            year: 'numeric',
                            month: '2-digit'
                        }).formatToParts(date);
                        const map = {};
                        for (const p of parts) {
                            if (p.type !== 'literal') map[p.type] = p.value;
                        }
                        return { year: map.year, month: map.month };
                    } catch (e) {
                        const d = date instanceof Date ? date : new Date(date);
                        return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, '0') };
                    }
                },

                agentGetThisMonthRangeShanghai() {
                    const today = new Date();
                    const { year, month } = this.agentGetShanghaiYearMonth(today);
                    const startDate = `${year}-${month}-01`;
                    const endDate = this.agentFormatDateYmdShanghai(today);
                    return { startDate, endDate };
                },

                agentApplySalesDefaults(force = false) {
                    const curStart = String(this.agentSalesCustomFilters?.startDate || '').trim();
                    const curEnd = String(this.agentSalesCustomFilters?.endDate || '').trim();
                    if (!force && (curStart || curEnd)) return;

                    // Keep consistent with "下级开单明细" default: last 6 months (Shanghai TZ)
                    const def = this.agentGetDefaultDownlineDateRange();
                    this.agentSalesCustomFilters = { startDate: def.startDate, endDate: def.endDate };
                },

                agentApplySalesTrendDefaults(force = false) {
                    const curStart = String(this.agentSalesTrendFilters?.startDate || '').trim();
                    const curEnd = String(this.agentSalesTrendFilters?.endDate || '').trim();
                    if (!force && (curStart || curEnd)) return;

                    const def = this.agentGetThisMonthRangeShanghai();
                    this.agentSalesTrendFilters = { startDate: def.startDate, endDate: def.endDate };
                },

                async agentFetchSalesSummary(startDate, endDate) {
                    const params = new URLSearchParams();
                    if (startDate) params.set('startDate', String(startDate));
                    if (endDate) params.set('endDate', String(endDate));
                    const url = `/api/agent/sales-summary?${params.toString()}`;
                    const data = await this.agentApi(url, 'GET', null, true);
                    if (!data.success) throw new Error(data.message || '获取统计失败');
                    return data;
                },

                async agentFetchSalesTrend(startDate, endDate) {
                    const params = new URLSearchParams();
                    if (startDate) params.set('startDate', String(startDate));
                    if (endDate) params.set('endDate', String(endDate));
                    const url = `/api/agent/sales-trend?${params.toString()}`;
                    const data = await this.agentApi(url, 'GET', null, true);
                    if (!data.success) throw new Error(data.message || '获取走势失败');
                    return data;
                },

                async agentRefreshSalesPies() {
                    if (!this.agentToken) return;

                    const month = this.agentGetThisMonthRangeShanghai();
                    const customDef = this.agentGetDefaultDownlineDateRange();
                    const customStart = String(this.agentSalesCustomFilters?.startDate || '').trim();
                    const customEnd = String(this.agentSalesCustomFilters?.endDate || '').trim();
                    const custom = {
                        startDate: customStart || customDef.startDate,
                        endDate: customEnd || customDef.endDate
                    };

                    const [m, c] = await Promise.all([
                        this.agentFetchSalesSummary(month.startDate, month.endDate),
                        this.agentFetchSalesSummary(custom.startDate, custom.endDate)
                    ]);

                    const mMy = Number(m.myAmount || 0);
                    const mDown = Number(m.downlineAmount || 0);
                    this.agentSalesMonth = {
                        startDate: m.startDate || month.startDate,
                        endDate: m.endDate || month.endDate,
                        myAmount: Number.isFinite(mMy) ? mMy : 0,
                        downlineAmount: Number.isFinite(mDown) ? mDown : 0,
                        total: (Number.isFinite(mMy) ? mMy : 0) + (Number.isFinite(mDown) ? mDown : 0)
                    };

                    const cMy = Number(c.myAmount || 0);
                    const cDown = Number(c.downlineAmount || 0);
                    this.agentSalesCustom = {
                        startDate: c.startDate || custom.startDate,
                        endDate: c.endDate || custom.endDate,
                        myAmount: Number.isFinite(cMy) ? cMy : 0,
                        downlineAmount: Number.isFinite(cDown) ? cDown : 0,
                        total: (Number.isFinite(cMy) ? cMy : 0) + (Number.isFinite(cDown) ? cDown : 0)
                    };
                },

                async agentRefreshSalesTrend() {
                    if (!this.agentToken) return;

                    const month = this.agentGetThisMonthRangeShanghai();
                    const startDate = String(this.agentSalesTrendFilters?.startDate || '').trim() || month.startDate;
                    const endDate = String(this.agentSalesTrendFilters?.endDate || '').trim() || month.endDate;

                    const data = await this.agentFetchSalesTrend(startDate, endDate);

                    const labels = Array.isArray(data.labels) ? data.labels : [];
                    const myDaily = Array.isArray(data.myAmounts) ? data.myAmounts.map((v) => Number(v || 0) || 0) : [];
                    const downDaily = Array.isArray(data.downlineAmounts) ? data.downlineAmounts.map((v) => Number(v || 0) || 0) : [];

                    // Cumulative (non-decreasing), like GitHub usage charts.
                    let mySum = 0;
                    const myCum = myDaily.map((v) => {
                        mySum += (Number(v) || 0);
                        return mySum;
                    });

                    let downSum = 0;
                    const downCum = downDaily.map((v) => {
                        downSum += (Number(v) || 0);
                        return downSum;
                    });

                    this.agentSalesTrend = {
                        startDate: data.startDate || startDate,
                        endDate: data.endDate || endDate,
                        labels,
                        myAmounts: myCum,
                        downlineAmounts: downCum
                    };
                },

                agentSalesCustomSearch() {
                    const s = String(this.agentSalesCustomFilters?.startDate || '').trim();
                    const e = String(this.agentSalesCustomFilters?.endDate || '').trim();
                    if (!s || !e) {
                        this.agentNotify('请选择开始/结束日期', 'error');
                        return;
                    }
                    this.agentBusy = true;
                    this.agentFetchSalesSummary(s, e).then((c) => {
                        const cMy = Number(c.myAmount || 0);
                        const cDown = Number(c.downlineAmount || 0);
                        this.agentSalesCustom = {
                            startDate: c.startDate || s,
                            endDate: c.endDate || e,
                            myAmount: Number.isFinite(cMy) ? cMy : 0,
                            downlineAmount: Number.isFinite(cDown) ? cDown : 0,
                            total: (Number.isFinite(cMy) ? cMy : 0) + (Number.isFinite(cDown) ? cDown : 0)
                        };
                    }).catch((err) => {
                        this.agentNotify(err?.message || '查询失败', 'error');
                    }).finally(() => {
                        this.agentBusy = false;
                    });
                },

                agentSalesCustomReset() {
                    const def = this.agentGetDefaultDownlineDateRange();
                    this.agentSalesCustomFilters = { startDate: def.startDate, endDate: def.endDate };
                    this.agentSalesCustomSearch();
                },

                agentOpenSalesDatePicker(which) {
                    const w = String(which || '').trim();
                    const el = w === 'end' ? this.$refs?.salesEndDate : this.$refs?.salesStartDate;
                    if (!el) return;

                    try {
                        if (typeof el.showPicker === 'function') {
                            el.showPicker();
                            return;
                        }
                    } catch (e) {}

                    try {
                        el.focus({ preventScroll: true });
                    } catch (e) {
                        try { el.focus(); } catch (_) {}
                    }
                    try { el.click(); } catch (e) {}
                },

                agentOpenSalesTrendDatePicker(which) {
                    const w = String(which || '').trim();
                    const el = w === 'end' ? this.$refs?.salesTrendEndDate : this.$refs?.salesTrendStartDate;
                    if (!el) return;

                    try {
                        if (typeof el.showPicker === 'function') {
                            el.showPicker();
                            return;
                        }
                    } catch (e) {}

                    try {
                        el.focus({ preventScroll: true });
                    } catch (e) {
                        try { el.focus(); } catch (_) {}
                    }
                    try { el.click(); } catch (e) {}
                },

                agentSalesTrendSearch() {
                    const s = String(this.agentSalesTrendFilters?.startDate || '').trim();
                    const e = String(this.agentSalesTrendFilters?.endDate || '').trim();
                    if (!s || !e) {
                        this.agentNotify('请选择开始/结束日期', 'error');
                        return;
                    }

                    this.agentBusy = true;
                    this.agentFetchSalesTrend(s, e).then((d) => {
                        const labels = Array.isArray(d.labels) ? d.labels : [];
                        const myDaily = Array.isArray(d.myAmounts) ? d.myAmounts.map((v) => Number(v || 0) || 0) : [];
                        const downDaily = Array.isArray(d.downlineAmounts) ? d.downlineAmounts.map((v) => Number(v || 0) || 0) : [];

                        let mySum = 0;
                        const myCum = myDaily.map((v) => {
                            mySum += (Number(v) || 0);
                            return mySum;
                        });

                        let downSum = 0;
                        const downCum = downDaily.map((v) => {
                            downSum += (Number(v) || 0);
                            return downSum;
                        });

                        this.agentSalesTrend = {
                            startDate: d.startDate || s,
                            endDate: d.endDate || e,
                            labels,
                            myAmounts: myCum,
                            downlineAmounts: downCum
                        };
                    }).catch((err) => {
                        this.agentNotify(err?.message || '查询失败', 'error');
                    }).finally(() => {
                        this.agentBusy = false;
                    });
                },

                agentSalesTrendReset() {
                    const def = this.agentGetThisMonthRangeShanghai();
                    this.agentSalesTrendFilters = { startDate: def.startDate, endDate: def.endDate };
                    this.agentSalesTrendSearch();
                },

                agentSalesTrendHasData() {
                    const n = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels.length : 0;
                    return n >= 2;
                },

                agentSalesTrendW() { return 700; },
                agentSalesTrendH() { return 260; },
                agentSalesTrendPad() { return { l: 52, r: 14, t: 16, b: 34 }; },
                agentSalesTrendViewBox() { return `0 0 ${this.agentSalesTrendW()} ${this.agentSalesTrendH()}`; },

                agentSalesTrendGridK() { return [0, 1, 2, 3, 4]; },

                agentSalesTrendVGridXs() {
                    const labels = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels : [];
                    const n = labels.length;
                    if (n < 2) return [];

                    const xs = [];
                    const step = n > 20 ? 7 : (n > 10 ? 5 : 3);
                    for (let i = 0; i < n; i += step) {
                        xs.push(this.agentSalesTrendX(i, n));
                    }
                    xs.push(this.agentSalesTrendX(n - 1, n));
                    // De-dupe
                    return Array.from(new Set(xs.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);
                },

                agentSalesTrendMax() {
                    const a = Array.isArray(this.agentSalesTrend?.myAmounts) ? this.agentSalesTrend.myAmounts : [];
                    const b = Array.isArray(this.agentSalesTrend?.downlineAmounts) ? this.agentSalesTrend.downlineAmounts : [];
                    let max = 0;
                    for (const v of a) max = Math.max(max, Number(v || 0) || 0);
                    for (const v of b) max = Math.max(max, Number(v || 0) || 0);
                    return max > 0 ? max : 1;
                },

                agentSalesTrendX(i, n) {
                    const W = this.agentSalesTrendW();
                    const pad = this.agentSalesTrendPad();
                    const plotW = W - pad.l - pad.r;
                    const denom = Math.max(1, (n - 1));
                    return pad.l + (plotW * (i / denom));
                },

                agentSalesTrendY(v) {
                    const H = this.agentSalesTrendH();
                    const pad = this.agentSalesTrendPad();
                    const plotH = H - pad.t - pad.b;
                    const max = this.agentSalesTrendMax();
                    const val = Number(v || 0) || 0;
                    const pct = Math.max(0, Math.min(1, val / max));
                    return pad.t + (plotH * (1 - pct));
                },

                agentSalesTrendGridY(k) {
                    const H = this.agentSalesTrendH();
                    const pad = this.agentSalesTrendPad();
                    const plotH = H - pad.t - pad.b;
                    const kk = Number(k || 0) || 0;
                    return pad.t + (plotH * (kk / 4));
                },

                agentSalesTrendPath(which) {
                    const labels = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels : [];
                    const n = labels.length;
                    if (n < 2) return '';
                    const series = which === 'downline'
                        ? (Array.isArray(this.agentSalesTrend?.downlineAmounts) ? this.agentSalesTrend.downlineAmounts : [])
                        : (Array.isArray(this.agentSalesTrend?.myAmounts) ? this.agentSalesTrend.myAmounts : []);

                    let d = '';
                    for (let i = 0; i < n; i += 1) {
                        const x = this.agentSalesTrendX(i, n);
                        const y = this.agentSalesTrendY(series[i] || 0);
                        d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
                    }
                    return d;
                },

                agentSalesTrendHoverClear() {
                    this.agentSalesTrendHover = { ...(this.agentSalesTrendHover || {}), active: false };
                },

                agentSalesTrendHoverMove(evt) {
                    if (!this.agentSalesTrendHasData()) return;
                    const labels = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels : [];
                    const n = labels.length;
                    if (n < 2) return;

                    const e = evt && evt.touches && evt.touches[0] ? evt.touches[0] : evt;
                    const clientX = Number(e?.clientX);
                    const target = evt?.currentTarget;
                    if (!Number.isFinite(clientX) || !target || typeof target.getBoundingClientRect !== 'function') return;

                    const rect = target.getBoundingClientRect();
                    const w = Number(rect?.width || 0);
                    if (!Number.isFinite(w) || w <= 0) return;

                    const relX = Math.max(0, Math.min(w, clientX - Number(rect.left || 0)));
                    const xView = (relX / w) * this.agentSalesTrendW();

                    const pad = this.agentSalesTrendPad();
                    const plotW = this.agentSalesTrendW() - pad.l - pad.r;
                    const ratio = plotW > 0 ? (xView - pad.l) / plotW : 0;
                    let i = Math.round(ratio * (n - 1));
                    i = Math.max(0, Math.min(n - 1, i));

                    this.agentSalesTrendHover = { active: true, i, px: relX, w };
                },

                agentSalesTrendHoverX() {
                    const labels = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels : [];
                    const n = labels.length;
                    const i = Number(this.agentSalesTrendHover?.i || 0);
                    return this.agentSalesTrendX(Math.max(0, Math.min(n - 1, i)), n);
                },

                agentSalesTrendHoverY(which) {
                    const v = this.agentSalesTrendHoverValue(which);
                    return this.agentSalesTrendY(v);
                },

                agentSalesTrendHoverValue(which) {
                    const labels = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels : [];
                    const n = labels.length;
                    const i = Math.max(0, Math.min(n - 1, Number(this.agentSalesTrendHover?.i || 0)));

                    const my = Array.isArray(this.agentSalesTrend?.myAmounts) ? this.agentSalesTrend.myAmounts : [];
                    const down = Array.isArray(this.agentSalesTrend?.downlineAmounts) ? this.agentSalesTrend.downlineAmounts : [];

                    const myV = Number(my[i] || 0) || 0;
                    const downV = Number(down[i] || 0) || 0;

                    if (which === 'downline') return downV;
                    if (which === 'total') return myV + downV;
                    return myV;
                },

                agentSalesTrendHoverTitle() {
                    const labels = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels : [];
                    const n = labels.length;
                    if (n < 1) return '日期：—';
                    const i = Math.max(0, Math.min(n - 1, Number(this.agentSalesTrendHover?.i || 0)));
                    const ymd = String(labels[i] || '').trim();
                    if (!ymd) return '日期：—';

                    const dt = new Date(`${ymd}T00:00:00`);
                    const w = ['日', '一', '二', '三', '四', '五', '六'];
                    let weekday = '';
                    if (!Number.isNaN(dt.getTime())) {
                        weekday = `周${w[dt.getDay()]}`;
                    }

                    return `日期：${ymd}${weekday ? '（' + weekday + '）' : ''}`;
                },

                agentSalesTrendTooltipStyle() {
                    const px = Number(this.agentSalesTrendHover?.px || 0);
                    const w = Number(this.agentSalesTrendHover?.w || 0);
                    const min = 95;
                    const max = w > 0 ? Math.max(min, w - 95) : px;
                    const left = Math.max(min, Math.min(max, px));
                    return `left: ${left}px; transform: translateX(-50%);`;
                },

                agentSalesTrendYTicks() {
                    const max = this.agentSalesTrendMax();
                    const ticks = [max, max / 2, 0];
                    return ticks.map((v) => ({
                        value: v,
                        y: this.agentSalesTrendY(v),
                        label: this.agentMoney(v)
                    }));
                },

                agentSalesTrendXTicks() {
                    const labels = Array.isArray(this.agentSalesTrend?.labels) ? this.agentSalesTrend.labels : [];
                    const n = labels.length;
                    if (n < 2) return [];

                    const set = new Set([0, n - 1]);
                    // Keep a middle anchor label for readability.
                    set.add(Math.floor((n - 1) / 2));

                    // Weekly-ish ticks when there are many points.
                    if (n > 10) {
                        for (let i = 0; i < n; i += 7) set.add(i);
                    }

                    return Array.from(set).sort((a, b) => a - b).map((i) => {
                        const ymd = String(labels[i] || '');
                        const dd = ymd.split('-')[2] || '';
                        const label = dd ? String(Number(dd)) : ymd;
                        return {
                            i,
                            x: this.agentSalesTrendX(i, n),
                            label
                        };
                    });
                },

                agentFormatDateYmdShanghai(date) {
                    try {
                        return new Intl.DateTimeFormat('en-CA', {
                            timeZone: 'Asia/Shanghai',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        }).format(date);
                    } catch (e) {
                        const d = date instanceof Date ? date : new Date(date);
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        return `${yyyy}-${mm}-${dd}`;
                    }
                },

                agentGetDefaultDownlineDateRange() {
                    const end = new Date();
                    const start = new Date();
                    start.setMonth(start.getMonth() - 6);
                    return {
                        startDate: this.agentFormatDateYmdShanghai(start),
                        endDate: this.agentFormatDateYmdShanghai(end)
                    };
                },

                agentApplyDownlineDateDefaults(force = false) {
                    const curStart = String(this.agentDownlineFilters?.startDate || '').trim();
                    const curEnd = String(this.agentDownlineFilters?.endDate || '').trim();

                    if (!force && (curStart || curEnd)) return;

                    const def = this.agentGetDefaultDownlineDateRange();
                    this.agentDownlineFilters = {
                        ...(this.agentDownlineFilters || {}),
                        startDate: def.startDate,
                        endDate: def.endDate
                    };
                },

                async agentApi(path, method = 'GET', payload = null, auth = false) {
                    const headers = { 'Content-Type': 'application/json' };
                    if (auth && this.agentToken) {
                        headers['Authorization'] = `Bearer ${this.agentToken}`;
                    }

                    const resp = await fetch(path, {
                        method,
                        headers,
                        body: payload ? JSON.stringify(payload) : undefined
                    });

                    let data = null;
                    try {
                        data = await resp.json();
                    } catch (e) {
                        data = { success: false, message: '服务器返回格式异常' };
                    }

                    if (!resp.ok) {
                        const firstValidationMsg = Array.isArray(data?.errors)
                            ? (data.errors[0]?.msg || data.errors[0]?.message)
                            : null;
                        const msg = data?.message || data?.error || firstValidationMsg || '请求失败';
                        throw new Error(msg);
                    }
                    return data;
                },

                async agentFetchMe() {
                    const data = await this.agentApi('/api/agent/me', 'GET', null, true);
                    if (!data.success) throw new Error(data.message || '获取用户失败');
                    this.agentUser = data.user;
                    // default next role
                    const opts = this.agentAllowedChildRoles();
                    if (opts.length > 0) this.agentRegisterForm.role = opts[0];
                },

                goAgentPortal() {
                    if (this.agentToken) {
                        this.switchPage('agent-dashboard');
                        this.agentRefreshDashboard();
                    } else {
                        this.switchPage('agent-login');
                    }
                },

                agentLogout(showNotice = true) {
                    this.agentToken = '';
                    this.agentUser = null;
                    this.agentChildren = [];
                    this.agentOrders = [];
                    this.agentLogs = [];
                    try { localStorage.removeItem('agent_token'); } catch (e) {}
                    if (showNotice) this.agentNotify('已退出登录', 'info');
                    this.switchPage('agent-login');
                },

                async agentSendCode(purpose) {
                    const remaining = this.agentCodeCooldownRemaining(purpose);
                    if (remaining > 0) {
                        this.agentNotify(`请等待 ${remaining}s 再获取验证码`, 'info');
                        return;
                    }

                    const phone = (purpose === 'reset_password'
                        ? this.agentResetForm.phone
                        : (purpose === 'register' ? this.agentRegisterForm.phone : this.agentForm.phone)
                    ).trim();
                    if (!phone) {
                        this.agentNotify('请输入手机号', 'error');
                        return;
                    }
                    try {
                        this.agentBusy = true;
                        const data = await this.agentApi('/api/agent/send-code', 'POST', { phone, purpose }, false);
                        if (data.success) {
                            this.agentNotify('验证码已发送', 'success');
                            this.agentStartCodeCooldown(purpose, 60);
                        } else {
                            const msg = data.message || '发送失败';
                            // If backend says "too frequent", still start a cooldown to match UX
                            if (/\b60\b|稍后|频繁|过于频繁|重试/.test(msg)) this.agentStartCodeCooldown(purpose, 60);
                            this.agentNotify(msg, 'error');
                        }
                    } catch (e) {
                        if (/\b60\b|稍后|频繁|过于频繁|重试/.test(e.message || '')) {
                            this.agentStartCodeCooldown(purpose, 60);
                        }
                        this.agentNotify(e.message, 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                async agentLogin() {
                    const phone = this.agentForm.phone.trim();
                    try {
                        this.agentBusy = true;
                        const mode = (this.agentLoginMode === 'code' && (this.agentForm.code || '').trim()) ? 'code' : 'password';
                        let data;
                        if (!phone) {
                            this.agentNotify('请输入手机号', 'error');
                            return;
                        }

                        if (mode === 'password') {
                            if (!this.agentForm.password) {
                                this.agentNotify('请输入密码', 'error');
                                return;
                            }
                            data = await this.agentApi('/api/agent/login/password', 'POST', { phone, password: this.agentForm.password }, false);
                        } else {
                            if (!(this.agentForm.code || '').trim()) {
                                this.agentNotify('请输入验证码', 'error');
                                return;
                            }
                            data = await this.agentApi('/api/agent/login/code', 'POST', { phone, code: this.agentForm.code }, false);
                        }

                        if (!data.success) {
                            this.agentNotify(data.message || '登录失败', 'error');
                            return;
                        }

                        this.agentToken = data.token;
                        try { localStorage.setItem('agent_token', this.agentToken); } catch (e) {}
                        this.agentUser = data.user;
                        this.agentNotify('登录成功', 'success');
                        this.switchPage('agent-dashboard');
                        await this.agentRefreshDashboard();
                    } catch (e) {
                        this.agentNotify(e.message, 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                async agentResetPassword() {
                    const phone = this.agentResetForm.phone.trim();
                    const code = this.agentResetForm.code.trim();
                    const newPassword = this.agentResetForm.newPassword;
                    if (!phone || !code || !newPassword) {
                        this.agentNotify('请填写手机号、验证码和新密码', 'error');
                        return;
                    }
                    try {
                        this.agentBusy = true;
                        const data = await this.agentApi('/api/agent/reset-password', 'POST', { phone, code, newPassword }, false);
                        if (data.success) {
                            this.agentNotify('密码重置成功，请登录', 'success');
                            this.agentShowReset = false;
                        } else {
                            this.agentNotify(data.message || '重置失败', 'error');
                        }
                    } catch (e) {
                        this.agentNotify(e.message, 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                agentAllowedChildRoles() {
                    const r = this.agentUser?.role;
                    if (r === 'admin') return ['consultant'];
                    if (r === 'consultant') return ['agent1'];
                    if (r === 'agent1') return ['agent2'];
                    if (r === 'agent2') return ['agent3'];
                    if (r === 'agent3') return ['agent4'];
                    return [];
                },

                async agentCreateSubaccount() {
                    const phone = this.agentRegisterForm.phone.trim();
                    const password = this.agentRegisterForm.password;
                    const role = this.agentRegisterForm.role;
                    const code = (this.agentRegisterForm.code || '').trim();
                    const idCard = (this.agentRegisterForm.idCard || '').trim();
                    const idCardName = (this.agentRegisterForm.idCardName || '').trim();
                    if (!phone || !password || !role || !code || !idCard || !idCardName) {
                        this.agentNotify('请填写下级手机号/密码/角色/验证码/姓名/身份证号', 'error');
                        return;
                    }
                    try {
                        this.agentBusy = true;
                        const data = await this.agentApi('/api/agent/register', 'POST', { phone, password, role, code, idCard, idCardName }, true);
                        if (data.success) {
                            this.agentNotify('创建成功', 'success');
                            this.agentRegisterForm.phone = '';
                            this.agentRegisterForm.password = '';
                            this.agentRegisterForm.code = '';
                            this.agentRegisterForm.idCard = '';
                            this.agentRegisterForm.idCardName = '';
                            await this.agentRefreshDashboard();
                        } else {
                            this.agentNotify(data.message || '创建失败', 'error');
                        }
                    } catch (e) {
                        this.agentNotify(e.message, 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                async agentCreateOrder() {
                    if (!this.agentToken) {
                        this.agentNotify('请先登录', 'error');
                        this.switchPage('agent-login');
                        return;
                    }

                    const role = this.agentUser?.role;
                    if (role !== 'consultant') {
                        this.agentNotify('无权限创建订单', 'error');
                        return;
                    }

                    // Immediate feedback so users can tell the click handler ran.
                    this.agentNotify('正在检查订单信息…', 'info');

                    const f = this.agentOrderForm;
                    const serviceName = String(f.serviceName || '').trim().toUpperCase();
                    const status = String(f.status || '').trim();
                    const amount = String(f.amount || '').trim();
                    const studentName = String(f.studentName || '').trim();
                    const studentGender = String(f.studentGender || '').trim();
                    const studentPhoneRaw = String(f.studentPhone || '').trim();
                    const studentPhone = studentPhoneRaw.replace(/[^\d]/g, '');
                    const parentPhoneRaw = String(f.parentPhone || '').trim();
                    const parentPhone = parentPhoneRaw.replace(/[^\d]/g, '');

                    if (!serviceName) return this.agentNotify('请选择服务名', 'error');
                    if (!amount) return this.agentNotify('请输入金额', 'error');
                    if (!status) return this.agentNotify('请选择状态', 'error');
                    if (!studentName) return this.agentNotify('请输入学生名字', 'error');
                    if (!studentGender) return this.agentNotify('请选择学生性别', 'error');
                    if (!studentPhone) return this.agentNotify('请输入学生电话', 'error');
                    if (String(studentPhone).length < 6) return this.agentNotify('学生电话至少 6 位数字', 'error');

                    const payload = {
                        bindUserId: f.bindUserId ? Number(f.bindUserId) : undefined,
                        serviceName,
                        amount: Number(amount),
                        status,
                        parentName: String(f.parentName || '').trim() || undefined,
                        parentGender: String(f.parentGender || '').trim() || undefined,
                        parentPhone: parentPhone ? parentPhone : undefined,
                        studentName,
                        studentGender,
                        studentPhone,
                        extraServiceWeight: String(f.extraServiceWeight || '').trim().toUpperCase() || undefined,
                        studentIdCard: String(f.studentIdCard || '').trim() || undefined
                    };

                    try {
                        this.agentBusy = true;
                        const data = await this.agentApi('/api/agent/orders', 'POST', payload, true);
                        if (data.success) {
                            this.agentNotify(`创建成功，订单号：${data.orderNo}`, 'success');
                            // reset fields (keep bindUserId default)
                            this.agentOrderForm.serviceName = 'EAC';
                            this.agentOrderForm.amount = '';
                            this.agentOrderForm.status = '已创单';
                            this.agentOrderForm.parentName = '';
                            this.agentOrderForm.parentGender = '';
                            this.agentOrderForm.parentPhone = '';
                            this.agentOrderForm.studentName = '';
                            this.agentOrderForm.studentGender = '男';
                            this.agentOrderForm.studentPhone = '';
                            this.agentOrderForm.extraServiceWeight = '';
                            this.agentOrderForm.studentIdCard = '';
                            await this.agentRefreshDashboard();
                        } else {
                            this.agentNotify(data.message || '创建失败', 'error');
                        }
                    } catch (e) {
                        this.agentNotify(e.message || '创建失败', 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                async agentDeleteOrder(orderId) {
                    if (!this.agentToken) {
                        this.agentNotify('请先登录', 'error');
                        this.switchPage('agent-login');
                        return;
                    }

                    if (this.agentUser?.role !== 'consultant') {
                        this.agentNotify('无权限删除订单', 'error');
                        return;
                    }

                    const id = Number(orderId);
                    if (!Number.isFinite(id) || id <= 0) {
                        this.agentNotify('订单ID不正确', 'error');
                        return;
                    }

                    const ok = window.confirm('确认删除该订单？此操作不可恢复。');
                    if (!ok) return;

                    try {
                        this.agentBusy = true;
                        await this.agentApi(`/api/agent/orders/${id}`, 'DELETE', null, true);
                        this.agentNotify('删除成功', 'success');
                        await this.agentRefreshDashboard();
                    } catch (e) {
                        this.agentNotify(e.message || '删除失败', 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                async agentAdvanceOrder(orderId) {
                    if (!this.agentToken) {
                        this.agentNotify('请先登录', 'error');
                        this.switchPage('agent-login');
                        return;
                    }

                    if (this.agentUser?.role !== 'consultant') {
                        this.agentNotify('无权限更新订单', 'error');
                        return;
                    }

                    const id = Number(orderId);
                    if (!Number.isFinite(id) || id <= 0) {
                        this.agentNotify('订单ID不正确', 'error');
                        return;
                    }

                    try {
                        this.agentBusy = true;
                        const data = await this.agentApi(`/api/agent/orders/${id}/advance`, 'POST', {}, true);
                        this.agentNotify(`更新成功：${data.status || ''}`, 'success');
                        await this.agentRefreshDashboard();
                    } catch (e) {
                        this.agentNotify(e.message || '更新失败', 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                agentOpenEditOrder(order) {
                    if (this.agentUser?.role !== 'consultant') {
                        this.agentNotify('无权限修改订单', 'error');
                        return;
                    }
                    if (!order || !order.id) {
                        this.agentNotify('订单数据异常', 'error');
                        return;
                    }

                    this.agentEditOrderId = Number(order.id);
                    this.agentEditOrderNo = String(order.orderNo || '');
                    this.agentEditOrderForm.bindUserId = order.boundUserId ? Number(order.boundUserId) : (this.agentUser?.id || null);
                    this.agentEditOrderForm.serviceName = String(order.serviceName || 'EAC').trim().toUpperCase();
                    this.agentEditOrderForm.amount = (order.amount === null || order.amount === undefined) ? '' : String(order.amount);
                    this.agentEditOrderForm.status = String(order.status || '已创单').trim();
                    this.agentEditOrderForm.parentName = String(order.parentName || '').trim();
                    this.agentEditOrderForm.parentGender = String(order.parentGender || '').trim();
                    this.agentEditOrderForm.parentPhone = String(order.parentPhone || '').trim();
                    this.agentEditOrderForm.studentName = String(order.studentName || '').trim();
                    this.agentEditOrderForm.studentGender = String(order.studentGender || '男').trim();
                    this.agentEditOrderForm.studentPhone = String(order.studentPhone || '').trim();
                    this.agentEditOrderForm.extraServiceWeight = String(order.extraServiceWeight || '').trim().toUpperCase();
                    this.agentEditOrderForm.studentIdCard = String(order.studentIdCard || '').trim();

                    this.agentEditOrderOpen = true;
                },

                agentCloseEditOrder() {
                    this.agentEditOrderOpen = false;
                    this.agentEditOrderId = null;
                    this.agentEditOrderNo = '';
                },

                async agentSaveEditOrder() {
                    if (!this.agentToken) {
                        this.agentNotify('请先登录', 'error');
                        this.switchPage('agent-login');
                        return;
                    }
                    if (this.agentUser?.role !== 'consultant') {
                        this.agentNotify('无权限修改订单', 'error');
                        return;
                    }

                    const id = Number(this.agentEditOrderId);
                    if (!Number.isFinite(id) || id <= 0) {
                        this.agentNotify('订单ID不正确', 'error');
                        return;
                    }

                    const f = this.agentEditOrderForm;
                    const serviceName = String(f.serviceName || '').trim().toUpperCase();
                    const status = String(f.status || '').trim();
                    const amount = String(f.amount || '').trim();
                    const studentName = String(f.studentName || '').trim();
                    const studentGender = String(f.studentGender || '').trim();
                    const studentPhoneRaw = String(f.studentPhone || '').trim();
                    const studentPhone = studentPhoneRaw.replace(/[^\d]/g, '');
                    const parentPhoneRaw = String(f.parentPhone || '').trim();
                    const parentPhone = parentPhoneRaw.replace(/[^\d]/g, '');

                    if (!serviceName) return this.agentNotify('请选择服务名', 'error');
                    if (!amount) return this.agentNotify('请输入金额', 'error');
                    if (!status) return this.agentNotify('请选择状态', 'error');
                    if (!studentName) return this.agentNotify('请输入学生名字', 'error');
                    if (!studentGender) return this.agentNotify('请选择学生性别', 'error');
                    if (!studentPhone) return this.agentNotify('请输入学生电话', 'error');
                    if (String(studentPhone).length < 6) return this.agentNotify('学生电话至少 6 位数字', 'error');

                    const payload = {
                        bindUserId: f.bindUserId ? Number(f.bindUserId) : undefined,
                        serviceName,
                        amount: Number(amount),
                        status,
                        parentName: String(f.parentName || '').trim() || undefined,
                        parentGender: String(f.parentGender || '').trim() || undefined,
                        parentPhone: parentPhone ? parentPhone : undefined,
                        studentName,
                        studentGender,
                        studentPhone,
                        extraServiceWeight: String(f.extraServiceWeight || '').trim().toUpperCase() || undefined,
                        studentIdCard: String(f.studentIdCard || '').trim() || undefined
                    };

                    try {
                        this.agentBusy = true;
                        await this.agentApi(`/api/agent/orders/${id}`, 'PUT', payload, true);
                        this.agentNotify('修改成功', 'success');
                        this.agentEditOrderOpen = false;
                        await this.agentRefreshDashboard();
                    } catch (e) {
                        this.agentNotify(e.message || '修改失败', 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                async agentRefreshDashboard() {
                    if (!this.agentToken) {
                        this.agentNotify('请先登录', 'error');
                        this.switchPage('agent-login');
                        return;
                    }
                    try {
                        this.agentBusy = true;
                        await this.agentFetchMe();
                        const [users, orders, logs, downlineOrders] = await Promise.all([
                            this.agentApi('/api/agent/users', 'GET', null, true),
                            this.agentApi('/api/agent/orders', 'GET', null, true),
                            this.agentApi('/api/agent/logs', 'GET', null, true),
                            this.agentFetchDownlineOrders().catch(() => ({ success: true, data: [] }))
                        ]);
                        this.agentChildren = users.data || [];
                        this.agentOrders = orders.data || [];
                        this.agentLogs = logs.data || [];
                        this.agentDownlineOrders = downlineOrders.data || [];

                        // For consultant/admin: load all active accounts for order assignment
                        if (this.agentUser?.role === 'consultant') {
                            try {
                                const all = await this.agentApi('/api/agent/users-all', 'GET', null, true);
                                this.agentAllUsers = all.data || [];
                            } catch (e) {
                                this.agentAllUsers = [];
                            }
                        } else {
                            this.agentAllUsers = [];
                        }

                        // Default binding: self
                        if (!this.agentOrderForm.bindUserId) {
                            this.agentOrderForm.bindUserId = this.agentUser?.id || null;
                        }

                        this.agentApplySalesDefaults(false);
                        this.agentApplySalesTrendDefaults(false);
                        await Promise.all([
                            this.agentRefreshSalesPies(),
                            this.agentRefreshSalesTrend().catch(() => {})
                        ]);
                    } catch (e) {
                        this.agentNotify(e.message || '刷新失败', 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },

                async agentFetchDownlineOrders() {
                    if (!this.agentToken) {
                        return { success: true, data: [] };
                    }

                    const q = String(this.agentDownlineFilters?.q || '').trim();
                    const status = String(this.agentDownlineFilters?.status || '').trim();
                    const role = String(this.agentDownlineFilters?.role || '').trim();
                    const startDate = String(this.agentDownlineFilters?.startDate || '').trim();
                    const endDate = String(this.agentDownlineFilters?.endDate || '').trim();

                    const params = new URLSearchParams();
                    if (q) params.set('q', q);
                    if (status) params.set('status', status);
                    if (role) params.set('role', role);
                    if (startDate) params.set('startDate', startDate);
                    if (endDate) params.set('endDate', endDate);
                    params.set('limit', '500');

                    const url = `/api/agent/orders-downline?${params.toString()}`;
                    const data = await this.agentApi(url, 'GET', null, true);
                    return data;
                },

                agentDownlineResetFilters() {
                    const def = this.agentGetDefaultDownlineDateRange();
                    this.agentDownlineFilters = { q: '', status: '', role: '', startDate: def.startDate, endDate: def.endDate };
                    this.agentFetchDownlineOrders().then(d => {
                        this.agentDownlineOrders = d.data || [];
                    }).catch(() => {
                        this.agentDownlineOrders = [];
                    });
                },

                agentDownlineSearch() {
                    this.agentFetchDownlineOrders().then(d => {
                        this.agentDownlineOrders = d.data || [];
                    }).catch(e => {
                        this.agentNotify(e.message || '查询失败', 'error');
                    });
                },

                agentOpenDownlineDatePicker(which) {
                    const w = String(which || '').trim();
                    const el = w === 'end' ? this.$refs?.downlineEndDate : this.$refs?.downlineStartDate;
                    if (!el) return;

                    try {
                        if (typeof el.showPicker === 'function') {
                            el.showPicker();
                            return;
                        }
                    } catch (e) {
                        // ignore and fallback
                    }

                    try {
                        el.focus({ preventScroll: true });
                    } catch (e) {
                        try { el.focus(); } catch (_) {}
                    }
                    try { el.click(); } catch (e) {}
                },

                async agentChangePassword() {
                    if (!this.agentToken) {
                        this.agentNotify('请先登录', 'error');
                        this.switchPage('agent-login');
                        return;
                    }

                    const oldPassword = String(this.agentChangePasswordForm.oldPassword || '');
                    const newPassword = String(this.agentChangePasswordForm.newPassword || '');
                    const confirmPassword = String(this.agentChangePasswordForm.confirmPassword || '');
                    if (!oldPassword || !newPassword) {
                        this.agentNotify('请输入旧密码和新密码', 'error');
                        return;
                    }
                    if (newPassword.length < 6) {
                        this.agentNotify('新密码至少 6 位', 'error');
                        return;
                    }
                    if (newPassword !== confirmPassword) {
                        this.agentNotify('两次输入的新密码不一致', 'error');
                        return;
                    }

                    try {
                        this.agentBusy = true;
                        const data = await this.agentApi('/api/agent/change-password', 'POST', { oldPassword, newPassword }, true);
                        if (data.success) {
                            this.agentNotify('密码修改成功，请重新登录', 'success');
                            this.agentChangePasswordForm.oldPassword = '';
                            this.agentChangePasswordForm.newPassword = '';
                            this.agentChangePasswordForm.confirmPassword = '';
                            this.agentLogout(false);
                        } else {
                            this.agentNotify(data.message || '修改失败', 'error');
                        }
                    } catch (e) {
                        this.agentNotify(e.message || '修改失败', 'error');
                    } finally {
                        this.agentBusy = false;
                    }
                },
                t: window.SDLV_I18N,
                
                switchPage(newPage, anchorId = null) {
                    // Guard: agent pages require login
                    if (newPage === 'agent-dashboard' && !this.agentToken) {
                        this.page = 'agent-login';
                        this.agentNotify('请先登录代理账号', 'error');
                        window.scrollTo({ top: 0, behavior: 'auto' });
                        setTimeout(() => initScrollEngine(), 100);
                        return;
                    }

                    this.mobileNavOpen = false;

                    this.page = newPage;
                    window.scrollTo({ top: 0, behavior: 'auto' });
                    
                    // 等待页面DOM更新后，重新初始化动画引擎
                    setTimeout(() => {
                        initScrollEngine();
                        refreshLucideIcons();
                        if (newPage === 'apartments') {
                            this.initAmapEmbed();
                        }
                        if(anchorId) {
                            const el = document.getElementById(anchorId);
                            if(el) {
                                const y = el.getBoundingClientRect().top + window.pageYOffset - 100;
                                window.scrollTo({top: y, behavior: 'smooth'});
                            }
                        }
                    }, 100);
                }
            }
        }

        // ================= Custom Scroll Scrubbing Engine =================
        let scrubElements = [];
        let parallaxElements = [];

        function getDocumentTop(el) {
            let top = 0;
            let current = el;
            while (current) {
                top += current.offsetTop || 0;
                current = current.offsetParent;
            }
            return top;
        }

        function initScrollEngine() {
            // 收集所有标记为 scrub-item 的元素
            scrubElements = Array.from(document.querySelectorAll('.scrub-item'));
            parallaxElements = Array.from(document.querySelectorAll('.anim-parallax'));
        }

        function scrollLoop() {
            const viewportHeight = window.innerHeight;
            const scrollTop = window.scrollY;

            // Floating consult button: lag-follow (smooth + natural, keep slow)
            const now = performance.now();
            scrollLoop._t = Number.isFinite(scrollLoop._t) ? scrollLoop._t : now;
            const dt = Math.min(40, Math.max(8, now - scrollLoop._t)); // ms, clamp for stability
            scrollLoop._t = now;

            scrollLoop._lastScroll = Number.isFinite(scrollLoop._lastScroll) ? scrollLoop._lastScroll : scrollTop;
            const rawVel = (scrollTop - scrollLoop._lastScroll) / dt; // px/ms
            scrollLoop._lastScroll = scrollTop;

            scrollLoop._vel = Number.isFinite(scrollLoop._vel) ? scrollLoop._vel : 0;
            const velSmooth = 0.10; // smaller = smoother/slower response
            scrollLoop._vel += (rawVel - scrollLoop._vel) * velSmooth;

            const maxLagPx = 18;
            const lagTarget = Math.max(-maxLagPx, Math.min(maxLagPx, -scrollLoop._vel * 18));

            scrollLoop._lag = Number.isFinite(scrollLoop._lag) ? scrollLoop._lag : 0;
            const lagEase = 0.08; // smaller = slower catch-up
            scrollLoop._lag += (lagTarget - scrollLoop._lag) * lagEase;
            document.body.style.setProperty('--fab-lag', String(scrollLoop._lag));

            // 1. 处理通用 Scrubbing 动画
            scrubElements.forEach(el => {
                // x-show 会对非当前页设置 display:none，此时跳过（避免 0 高度/NaN 进度污染）
                if (el.offsetParent === null) return;

                // 用文档流位置计算，避免受 transform 动画影响产生“反馈回路”
                const elementTop = getDocumentTop(el);
                const elementHeight = el.offsetHeight;

                // 定义触发区间：
                // start: 元素顶部刚进入屏幕下方
                // end: 元素完全进入屏幕并向上移动一段距离
                let start = elementTop - viewportHeight;
                let end = elementTop + (elementHeight * 0.2); // 可以调整系数控制动画完成的快慢

                // 计算进度 0.0 -> 1.0
                let progress = (scrollTop - start) / (end - start);
                
                // 限制在 0-1 之间
                let clampedProgress = Math.min(Math.max(progress, 0), 1);
                if (!Number.isFinite(clampedProgress)) clampedProgress = 0;

                // 写入 CSS 变量 --p
                el.style.setProperty('--p', clampedProgress);
            });

            // 2. 处理视差滚动 (Parallax)
            // 简单的将 scrollY 传给 --scroll-y
            document.body.style.setProperty('--scroll-y', scrollTop);

            requestAnimationFrame(scrollLoop);
        }

        // 启动引擎
        document.addEventListener('DOMContentLoaded', () => {
            initScrollEngine();
            scrollLoop();
        });