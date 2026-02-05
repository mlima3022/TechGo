// Sistema de autenticaÃ§Ã£o com Google OAuth
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.supabaseEnabled = false;
        this.pendingDashboardLoad = false;
        this.profile = null;
        this.profileCompleted = false;
        this.init();
    }

    init() {
        // Inicializar Supabase (quando configurado)
        this.initSupabase();
        this.bindEvents();
        this.checkAuthState();
        this.showLoading(false);
    }

    bindEvents() {
        // Login com Google
        const googleLoginButton = document.getElementById('googleLoginButton');
        if (googleLoginButton) {
            googleLoginButton.addEventListener('click', () => this.signInWithGoogle());
        }

        // Login com email/senha
        const emailLoginForm = document.getElementById('emailLoginForm');
        if (emailLoginForm) {
            emailLoginForm.addEventListener('submit', (e) => this.signInWithEmail(e));
        }

        // Cadastro
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.registerWithEmail(e));
        }
        // Profissao no cadastro
        const professionSelect = document.getElementById('registerProfession');
        const professionOtherWrap = document.getElementById('registerProfessionOtherWrap');
        if (professionSelect) {
            professionSelect.addEventListener('change', () => {
                const showOther = professionSelect.value === 'Outros';
                if (professionOtherWrap) {
                    professionOtherWrap.classList.toggle('hidden', !showOther);
                }
            });
        }

        // Alternar entre login e cadastro
        const showRegisterButton = document.getElementById('showRegisterButton');
        if (showRegisterButton) {
            showRegisterButton.addEventListener('click', () => this.toggleAuthForms('register'));
        }

        const showLoginButton = document.getElementById('showLoginButton');
        if (showLoginButton) {
            showLoginButton.addEventListener('click', () => this.toggleAuthForms('login'));
        }

        // Logout
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => this.signOut());
        }

        // Menu do usuÃ¡rio
        const userMenuButton = document.getElementById('userMenuButton');
        if (userMenuButton) {
            userMenuButton.addEventListener('click', () => this.toggleUserMenu());
        }

        // Fechar menu ao clicar fora
        document.addEventListener('click', (e) => {
            const userMenu = document.getElementById('userMenu');
            const userMenuButton = document.getElementById('userMenuButton');
            if (userMenu && userMenuButton && 
                !userMenu.contains(e.target) && 
                !userMenuButton.contains(e.target)) {
                userMenu.classList.add('hidden');
            }
        });
    }

    initSupabase() {
        if (!window.supabase || !window.supabaseConfig || !window.supabaseConfig.url || !window.supabaseConfig.anonKey) {
            this.supabaseEnabled = false;
            return;
        }

        this.supabaseEnabled = true;
        this.supabase = window.supabase.createClient(
            window.supabaseConfig.url,
            window.supabaseConfig.anonKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    flowType: 'pkce'
                }
            }
        );
    }

    getBasePath() {
        const path = window.location.pathname;
        const idx = path.lastIndexOf('/');
        return idx >= 0 ? path.substring(0, idx + 1) : '/';
    }

    enforceLoginForProtected() {
        if (this.isProtectedPage()) {
            this.redirectToLogin();
            return true;
        }
        return false;
    }

    isProtectedPage() {
        return document.body?.dataset?.protected === 'true';
    }

    redirectToLogin() {
        const base = this.getBasePath();
        window.location.href = `${window.location.origin}${base}login.html`;
    }

    redirectToDashboard() {
        const base = this.getBasePath();
        window.location.href = `${window.location.origin}${base}dashboard.html`;
    }
    async signInWithGoogle() {
        try {
            this.showLoading(true);
            if (!this.supabaseEnabled) {
                this.showError('Supabase nÃ£o configurado. Informe as chaves.');
                return;
            }
            const { error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}${this.getBasePath()}login.html`
                }
            });
            if (error) {
                console.error('Erro ao salvar perfil:', error);
                this.showError(error.message || 'Erro ao salvar perfil');
                return;
            }
            
        } catch (error) {
            console.error('Erro no login com Google:', error);
            this.showError('Erro ao fazer login com Google. Tente novamente.');
        } finally {
            this.showLoading(false);
        }
    }

    async signInWithEmail(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            this.showLoading(true);
            if (!this.supabaseEnabled) {
                this.showError('Supabase nÃ£o configurado. Informe as chaves.');
                return;
            }
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) {
                console.error('Erro ao salvar perfil:', error);
                this.showError(error.message || 'Erro ao salvar perfil');
                return;
            }
            if (data.user) {
                await this.handleSuccessfulLogin(this.mapSupabaseUser(data.user));
            }
            
        } catch (error) {
            console.error('Erro no login com email:', error);
            this.showError('Email ou senha incorretos.');
        } finally {
            this.showLoading(false);
        }
    }

    async handleSuccessfulLogin(user) {
        const protectedPage = this.isProtectedPage();
        if (!protectedPage) {
            this.redirectToDashboard();
            return;
        }
        this.currentUser = user;
        this.isAuthenticated = true;
        
        // Atualizar UI
        this.updateUI();
        
        // Mostrar app
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.classList.add('hidden');
        const navbar = document.getElementById('navbar');
        if (navbar) navbar.classList.remove('hidden');
        const appContent = document.getElementById('appContent');
        if (appContent) appContent.classList.remove('hidden');
        
        // Carregar dashboard
        if (window.app && window.app.loadDashboard) {
            window.app.loadDashboard();
        } else {
            this.pendingDashboardLoad = true;
        }

        await this.loadProfileOrOnboard();
        this.checkCheckoutStatus();
    }

    checkAuthState() {
        if (!this.supabaseEnabled) return;

        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const authError = urlParams.get('error');

        const canExchange = typeof this.supabase.auth.exchangeCodeForSession === 'function';

        if (authCode && !authError && canExchange) {
            this.supabase.auth.exchangeCodeForSession(window.location.href).then(async ({ data, error }) => {
                if (error) {
                    console.error('Erro ao trocar código por sessão:', error);
                    this.showLoading(false);
                    return;
                }
                const sessionUser = data?.session?.user;
                if (sessionUser) {
                    await this.handleSuccessfulLogin(this.mapSupabaseUser(sessionUser));
                } else {
                    const { data: userData } = await this.supabase.auth.getUser();
                    if (userData?.user) {
                        await this.handleSuccessfulLogin(this.mapSupabaseUser(userData.user));
                    }
                }
                window.history.replaceState({}, document.title, window.location.pathname);
                this.showLoading(false);
            });
        }

        this.supabase.auth.getSession().then(async ({ data, error }) => {
            if (error) {
                console.error('Erro ao recuperar sessão:', error);
                this.showLoading(false);
                return;
            }
            if (data.session && data.session.user) {
                await this.handleSuccessfulLogin(this.mapSupabaseUser(data.session.user));
            } else {
                const { data: userData } = await this.supabase.auth.getUser();
                if (userData?.user) {
                    await this.handleSuccessfulLogin(this.mapSupabaseUser(userData.user));
                } else {
                    this.enforceLoginForProtected();
                }
            }
            this.showLoading(false);
        });

        this.supabase.auth.onAuthStateChange((event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
                this.handleSuccessfulLogin(this.mapSupabaseUser(session.user));
            }
        });
    }

    async signOut() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.profile = null;
        this.profileCompleted = false;
        if (this.supabaseEnabled && this.supabase) {
            await this.supabase.auth.signOut();
        }

        const appContent = document.getElementById('appContent');
        const navbar = document.getElementById('navbar');
        const loginScreen = document.getElementById('loginScreen');

        if (!appContent || !navbar || !loginScreen) {
            this.redirectToLogin();
            return;
        }

        appContent.classList.add('hidden');
        navbar.classList.add('hidden');
        loginScreen.classList.remove('hidden');

        const emailLoginForm = document.getElementById('emailLoginForm');
        const registerForm = document.getElementById('registerForm');
        if (emailLoginForm) emailLoginForm.reset();
        if (registerForm) registerForm.reset();
        this.toggleAuthForms('login');

        this.redirectToLogin();
    }

    updateUI() {
        if (!this.currentUser) return;
        
        // Atualizar nome do usuÃ¡rio
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = this.currentUser.name;
        }
        
        // Atualizar avatar
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar && this.currentUser.photoURL) {
            userAvatar.src = this.currentUser.photoURL;
            userAvatar.onerror = () => {
                userAvatar.src = this.getDefaultAvatar();
            };
        }
    }

    toggleUserMenu() {
        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.classList.toggle('hidden');
        }
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.toggle('hidden', !show);
        }
    }

    showError(message) {
        // Criar toast de erro
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    showSuccess(message) {
        // Criar toast de sucesso
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getProfile() {
        return this.profile;
    }

    getPlanPatientLimit() {
        const plan = this.profile?.plan || 'free';
        if (plan === 'pro') return 999999;
        return 4;
    }

    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }

    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        const permissions = {
            admin: ['read', 'write', 'delete', 'manage_users', 'manage_finances', 'manage_all_patients'],
            physiotherapist: ['read', 'write', 'manage_own_patients', 'view_schedule', 'manage_finances'],
            assistant: ['read', 'view_schedule', 'manage_appointments']
        };
        
        const userPermissions = permissions[this.currentUser.role] || [];
        return userPermissions.includes(permission);
    }

    toggleAuthForms(mode) {
        const loginForm = document.getElementById('emailLoginForm');
        const registerForm = document.getElementById('registerForm');
        if (!loginForm || !registerForm) return;

        if (mode === 'register') {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        } else {
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        }
    }

    async registerWithEmail(event) {
        event.preventDefault();

        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerPasswordConfirm').value;
        const professionSelect = document.getElementById('registerProfession');
        const professionOther = document.getElementById('registerProfessionOther');
        const professionValue = professionSelect ? professionSelect.value : '';
        const profession = professionValue === 'Outros' ? (professionOther?.value || '').trim() : professionValue;

        if (password !== confirm) {
            this.showError('As senhas nao conferem.');
            return;
        }
        if (professionValue === 'Outros' && !profession) {
            this.showError('Informe sua profissao.');
            return;
        }

        try {
            this.showLoading(true);
            if (!this.supabaseEnabled) {
                this.showError('Supabase nÃ£o configurado. Informe as chaves.');
                return;
            }
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        profession: profession
                    }
                }
            });
            if (error) {
                console.error('Erro ao salvar perfil:', error);
                this.showError(error.message || 'Erro ao salvar perfil');
                return;
            }
            if (data.user && data.session) {
                await this.handleSuccessfulLogin(this.mapSupabaseUser(data.user));
            } else {
                this.showSuccess('Cadastro realizado. Verifique seu email para confirmar a conta.');
            }
        } catch (error) {
            console.error('Erro no cadastro:', error);
            this.showError('Erro ao cadastrar. Verifique os dados e tente novamente.');
        } finally {
            this.showLoading(false);
        }
    }

        checkCheckoutStatus() {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('checkout');
        if (!status) return;

        if (status === 'success') {
            this.showSuccess('Pagamento confirmado. Estamos liberando o plano Pro.');
        } else if (status === 'cancel') {
            this.showError('Pagamento cancelado.');
        }

        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
    }
    mapSupabaseUser(user) {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
        return {
            id: user.id,
            name: fullName || user.email || 'Usuário',
            email: user.email || '',
            photoURL: user.user_metadata?.avatar_url || this.getDefaultAvatar(),
            profession: user.user_metadata?.profession || '',
            role: 'admin',
            createdAt: user.created_at || new Date().toISOString()
        };
    }
    getDefaultAvatar() {
        return "data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%233b82f6%22/%3E%3Ctext x=%2250%25%22 y=%2255%25%22 font-size=%2214%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22%3EU%3C/text%3E%3C/svg%3E";
    }

    async loadProfileOrOnboard() {
        if (!this.supabaseEnabled || !this.currentUser) return;
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                this.profile = data;
                const needsSetup = !data.full_name;
                this.profileCompleted = !needsSetup;
                if (needsSetup) {
                    this.showProfileSetupModal();
                }
                return;
            }

            const initialName = this.currentUser?.name || this.currentUser?.email || 'Usuário';
            const { data: created, error: insertError } = await this.supabase
                .from('profiles')
                .upsert([
                    {
                        user_id: this.currentUser.id,
                        full_name: initialName,
                        plan: 'free',
                        profession: this.currentUser?.profession || null
                    }
                ], { onConflict: 'user_id' })
                .select()
                .single();

            if (insertError) {
                console.error('Erro ao criar perfil:', insertError);
            } else {
                this.profile = created;
            }

            this.showProfileSetupModal();
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
            this.showError('Erro ao carregar perfil. Verifique se a tabela profiles existe.');
        }
    }

    showProfileSetupModal() {
        const existing = document.getElementById('profileSetupModal');
        if (existing) return;
        const modal = document.createElement('div');
        modal.id = 'profileSetupModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Complete seu cadastro</h2>
                </div>
                <form id="profileSetupForm" class="modal-body space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="form-group">
                            <label class="form-label">Nome *</label>
                            <input type="text" id="profileFullName" required class="form-input"
                                   value="${this.profile?.full_name || this.currentUser?.name || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Profissao *</label>
                            <select id="profileProfession" class="form-select" required>
                                <option value="">Selecione...</option>
                                <option value="Fisioterapeuta" ${((this.profile?.profession || this.currentUser?.profession) === 'Fisioterapeuta') ? 'selected' : ''}>Fisioterapeuta</option>
                                <option value="Psicologo" ${((this.profile?.profession || this.currentUser?.profession) === 'Psicologo') ? 'selected' : ''}>Psicologo</option>
                                <option value="Nutricionista" ${((this.profile?.profession || this.currentUser?.profession) === 'Nutricionista') ? 'selected' : ''}>Nutricionista</option>
                                <option value="Fonoaudiologo" ${((this.profile?.profession || this.currentUser?.profession) === 'Fonoaudiologo') ? 'selected' : ''}>Fonoaudiologo</option>
                                <option value="Terapeuta Ocupacional" ${((this.profile?.profession || this.currentUser?.profession) === 'Terapeuta Ocupacional') ? 'selected' : ''}>Terapeuta Ocupacional</option>
                                <option value="Enfermeiro" ${((this.profile?.profession || this.currentUser?.profession) === 'Enfermeiro') ? 'selected' : ''}>Enfermeiro(a)</option>
                                <option value="Medico" ${((this.profile?.profession || this.currentUser?.profession) === 'Medico') ? 'selected' : ''}>Medico(a)</option>
                                <option value="Outros" ${((this.profile?.profession || this.currentUser?.profession) && !['Fisioterapeuta','Psicologo','Nutricionista','Fonoaudiologo','Terapeuta Ocupacional','Enfermeiro','Medico'].includes(this.profile?.profession || this.currentUser?.profession)) ? 'selected' : ''}>Outros</option>
                            </select>
                        </div>
                        <div id="profileProfessionOtherWrap" class="form-group hidden">
                            <label class="form-label">Qual?</label>
                            <input type="text" id="profileProfessionOther" class="form-input" placeholder="Digite sua profissao"
                                   value="${(!['Fisioterapeuta','Psicologo','Nutricionista','Fonoaudiologo','Terapeuta Ocupacional','Enfermeiro','Medico'].includes(this.profile?.profession || this.currentUser?.profession)) ? (this.profile?.profession || this.currentUser?.profession || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Clínica</label>
                            <input type="text" id="profileClinic" class="form-input" placeholder="Nome da clínica"
                                   value="${this.profile?.clinic_name || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Telefone</label>
                            <input type="text" id="profilePhone" class="form-input" placeholder="(00) 00000-0000"
                                   value="${this.profile?.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Cidade</label>
                            <input type="text" id="profileCity" class="form-input"
                                   value="${this.profile?.city || ''}">
                        </div>
                    </div>
                    <div class="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
                        Plano atual: <strong>Gratuito</strong> (até 4 pacientes).
                    </div>
                    <button type="submit" class="btn btn-primary w-full">Salvar cadastro</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        const form = document.getElementById('profileSetupForm');
        form.addEventListener('submit', (e) => this.saveProfile(e));
        const profSelect = document.getElementById('profileProfession');
        const profOtherWrap = document.getElementById('profileProfessionOtherWrap');
        if (profSelect && profOtherWrap) {
            const updateProfOther = () => {
                const known = ['Fisioterapeuta','Psicologo','Nutricionista','Fonoaudiologo','Terapeuta Ocupacional','Enfermeiro','Medico'];
                const showOther = profSelect.value === 'Outros' || (profSelect.value && !known.includes(profSelect.value));
                profOtherWrap.classList.toggle('hidden', !showOther);
            };
            updateProfOther();
            profSelect.addEventListener('change', updateProfOther);
        }
    }

    async saveProfile(event) {
        event.preventDefault();
        const form = document.getElementById('profileSetupForm');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        if (submitBtn) submitBtn.disabled = true;

        if (!this.supabaseEnabled) {
            this.showError('Supabase não configurado.');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        if (!this.currentUser) {
            const { data: userData } = await this.supabase.auth.getUser();
            if (userData?.user) {
                this.currentUser = this.mapSupabaseUser(userData.user);
            }
        }
        if (!this.currentUser) {
            this.showError('Sessão inválida. Faça login novamente.');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        const fullName = document.getElementById('profileFullName').value.trim();
        const clinic = document.getElementById('profileClinic').value.trim();
        const phone = document.getElementById('profilePhone').value.trim();
        const city = document.getElementById('profileCity').value.trim();
        const professionSelect = document.getElementById('profileProfession');
        const professionOther = document.getElementById('profileProfessionOther');
        const professionValue = professionSelect ? professionSelect.value : '';
        const profession = professionValue === 'Outros' ? (professionOther?.value || '').trim() : professionValue;

        if (!fullName) {
            this.showError('Informe seu nome.');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        if (professionValue === 'Outros' && !profession) {
            this.showError('Informe sua profissao.');
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .upsert([{
                    user_id: this.currentUser.id,
                    full_name: fullName,
                    clinic_name: clinic || null,
                    phone: phone || null,
                    city: city || null,
                    profession: profession || null,
                    plan: this.profile?.plan || 'free'
                }], { onConflict: 'user_id' })
                .select()
                .single();
            if (error) {
                console.error('Erro ao salvar perfil:', error);
                this.showError(error.message || 'Erro ao salvar perfil');
                return;
            }
            this.profile = data;
            this.profileCompleted = true;
            const modalEl = document.getElementById('profileSetupModal');
            if (modalEl) modalEl.remove();
            this.showSuccess('Cadastro concluÃ­do!');
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            this.showError('Erro ao salvar perfil. Verifique sua tabela profiles.');
        }
    }

    showUpgradeModal() {
        if (this.profile?.plan === 'pro') {
            this.showCancelPlanModal();
            return;
        }
        const modal = document.createElement('div');
        modal.id = 'upgradeModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Plano Pro</h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <p class="text-sm text-gray-700">
                        O plano gratuito permite ate 4 pacientes. 
                        Para liberar pacientes ilimitados, assine o plano Pro.
                    </p>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <div class="text-2xl font-bold text-gray-900">R$ 7,99/mês</div>
                        <div class="text-sm text-gray-600">Pacientes ilimitados</div>
                    </div>
                    <button class="btn btn-primary w-full" id="upgradePlanButton">
                        Quero assinar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const upgradeButton = document.getElementById('upgradePlanButton');
        if (upgradeButton) {
            upgradeButton.addEventListener('click', async () => {
                if (window.startStripeCheckout) {
                    await window.startStripeCheckout();
                } else {
                    this.showError('Checkout do Stripe nao configurado.');
                }
            });
        }
    }

    showCancelPlanModal() {
        const existing = document.getElementById('cancelPlanModal');
        if (existing) {
            existing.classList.add('active');
            return;
        }
        const modal = document.createElement('div');
        modal.id = 'cancelPlanModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Cancelar plano</h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <p class="text-sm text-gray-700">
                        Seu plano Pro esta ativo. Para cancelar a assinatura, fale com o suporte para validar a solicitacao.
                    </p>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <div class="text-sm text-gray-700">Envie um email para suporte ou entre em contato pelo WhatsApp.</div>
                    </div>
                    <button class="btn btn-outline w-full" onclick="this.closest('.modal').classList.remove('active')">Voltar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

}
// Exportar instÃ¢ncia global
window.authManager = new AuthManager();


















































































