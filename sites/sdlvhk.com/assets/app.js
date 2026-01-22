function refreshLucideIcons() {
    if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;

    const alias = {
        washer: 'washing-machine',
        dryer: 'wind',
        mirror: 'scan',
        elevator: 'arrow-up-down'
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
                agentChildren: [],
                agentOrders: [],
                agentLogs: [],

                agentNotify(message, type = 'info') {
                    this.agentNotice = message;
                    this.agentNoticeType = type;
                    setTimeout(() => {
                        if (this.agentNotice === message) this.agentNotice = '';
                    }, 5000);
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
                        const msg = data?.message || data?.error || '请求失败';
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
                        if (data.success) this.agentNotify('验证码已发送', 'success');
                        else this.agentNotify(data.message || '发送失败', 'error');
                    } catch (e) {
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

                async agentRefreshDashboard() {
                    if (!this.agentToken) {
                        this.agentNotify('请先登录', 'error');
                        this.switchPage('agent-login');
                        return;
                    }
                    try {
                        this.agentBusy = true;
                        await this.agentFetchMe();
                        const [users, orders, logs] = await Promise.all([
                            this.agentApi('/api/agent/users', 'GET', null, true),
                            this.agentApi('/api/agent/orders', 'GET', null, true),
                            this.agentApi('/api/agent/logs', 'GET', null, true)
                        ]);
                        this.agentChildren = users.data || [];
                        this.agentOrders = orders.data || [];
                        this.agentLogs = logs.data || [];
                    } catch (e) {
                        this.agentNotify(e.message || '刷新失败', 'error');
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
    
