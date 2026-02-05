// Aplicação principal
class FisioApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.patients = [];
        this.appointments = [];
        this.financial = [];
        this.appointmentsChart = null;
        this.revenueChart = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupTheme();
        this.setActiveNav();
        if (document.getElementById('dashboard')) {
            this.loadDashboard();
        }
        if (document.getElementById('profile')) {
            this.loadProfile();
        }
        if (document.getElementById('plans')) {
            this.loadPlansPage();
        }
        if (window.authManager && window.authManager.pendingDashboardLoad) {
            this.loadDashboard();
            window.authManager.pendingDashboardLoad = false;
        }
    }

    bindEvents() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        const exportReportsPdf = document.getElementById('exportReportsPdf');
        if (exportReportsPdf) {
            exportReportsPdf.addEventListener('click', () => this.exportReportsPdf());
        }
        const mobileButton = document.getElementById('mobileMenuButton');
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileButton && mobileMenu) {
            mobileButton.addEventListener('click', () => {
                mobileMenu.classList.toggle('is-open');
            });
            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    mobileMenu.classList.remove('is-open');
                });
            });
            window.addEventListener('resize', () => {
                mobileMenu.classList.remove('is-open');
            });
        }

        const editPreferencesButton = document.getElementById('editPreferencesButton');
        if (editPreferencesButton) {
            editPreferencesButton.addEventListener('click', () => this.showPreferencesModal());
        }

        const editBrandButton = document.getElementById('editBrandButton');
        if (editBrandButton) {
            editBrandButton.addEventListener('click', () => this.showBrandModal());
        }
    }

    
    setActiveNav() {
        const current = window.location.pathname.split('/').pop();
        if (!current) return;
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            link.classList.remove('border-primary-500');
            link.classList.add('border-transparent');
        });
        const active = document.querySelector(`.nav-link[href="${current}"]`);
        if (active) {
            active.classList.add('active');
            active.classList.add('border-primary-500');
            active.classList.remove('border-transparent');
        }
    }

    setupTheme() {
        // Verificar tema salvo
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setupNavigation() {
        // Verificar hash na URL
        const hash = window.location.hash.substring(1) || 'dashboard';
        this.navigateTo(hash);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.documentElement.classList.remove('dark');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
        }
        localStorage.setItem('theme', theme);
    }

    navigateTo(page) {
        // Esconder todas as páginas
        document.querySelectorAll('.page-content').forEach(el => {
            el.classList.add('hidden');
        });

        // Remover classe active dos links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            link.classList.remove('border-primary-500');
            link.classList.add('border-transparent');
        });

        // Mostrar página selecionada
        const pageElement = document.getElementById(page);
        if (pageElement) {
            pageElement.classList.remove('hidden');
            this.currentPage = page;
        }

        // Atualizar link ativo
        const activeLink = document.querySelector(`a[href="#${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            activeLink.classList.add('border-primary-500');
            activeLink.classList.remove('border-transparent');
        }

        // Atualizar hash na URL
        window.location.hash = page;

        // Carregar dados específicos da página
        this.loadPageData(page);
    }

    loadPageData(page) {
        switch (page) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'patients':
                this.loadPatients();
                break;
            case 'schedule':
                this.loadSchedule();
                break;
            case 'finance':
                this.loadFinance();
                break;
            case 'profile':
                this.loadProfile();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

        async loadDashboard() {
        try {
            const stats = await this.getDashboardStats();
            this.updateDashboardStats(stats);
            await this.loadDashboardCharts();
            await this.loadUpcomingAppointments();
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
        }
    }

    async getDashboardStats() {
        try {
            const { supabase, user } = await this.getSupabaseAndUser();
            if (!supabase || !user) {
                return {
                    totalPatients: 0,
                    todayAppointments: 0,
                    monthlyRevenue: 0,
                    pendingCount: 0
                };
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            monthEnd.setHours(23, 59, 59, 999);

            const [
                patientsCount,
                todayAppointmentsCount,
                pendingAppointmentsCount,
                financialRows
            ] = await Promise.all([
                supabase.from('patients').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('schedule').select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .gte('start_datetime', todayStart.toISOString())
                    .lte('start_datetime', todayEnd.toISOString()),
                supabase.from('schedule').select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .in('status', ['scheduled', 'confirmed']),
                supabase.from('financial').select('amount,transaction_type')
                    .eq('user_id', user.id)
                    .gte('transaction_date', monthStart.toISOString().split('T')[0])
                    .lte('transaction_date', monthEnd.toISOString().split('T')[0])
            ]);

            if (patientsCount.error || todayAppointmentsCount.error || pendingAppointmentsCount.error || financialRows.error) {
                throw new Error('Erro ao consultar dados do dashboard');
            }

            const financialData = financialRows.data || [];
            const monthlyRevenue = financialData
                .filter(item => item.transaction_type === 'income')
                .reduce((sum, item) => sum + (item.amount || 0), 0);

            return {
                totalPatients: patientsCount.count || 0,
                todayAppointments: todayAppointmentsCount.count || 0,
                monthlyRevenue,
                pendingCount: pendingAppointmentsCount.count || 0
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return {
                totalPatients: 0,
                todayAppointments: 0,
                monthlyRevenue: 0,
                pendingCount: 0
            };
        }
    }

    updateDashboardStats(stats) {
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('totalPatients', stats.totalPatients);
        setText('todayAppointments', stats.todayAppointments);
        setText('monthlyRevenue', `R$ ${stats.monthlyRevenue.toLocaleString('pt-BR')}`);
        setText('pendingCount', stats.pendingCount);
        setText('monthlyRevenueSummary', `R$ ${stats.monthlyRevenue.toLocaleString('pt-BR')}`);
        setText('pendingCountSummary', stats.pendingCount);
        setText('totalPatientsSummary', stats.totalPatients);
    }

        async loadDashboardCharts() {
        const series = await this.getDashboardSeries();
        this.renderAppointmentsChart(series.labels, series.appointments);
        this.renderRevenueChart(series.labels, series.revenue);
    }

    async getDashboardSeries() {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        const months = this.getLastMonths(6);
        const labels = months.map(m => m.label);
        const emptyResult = { labels, appointments: months.map(() => 0), revenue: months.map(() => 0) };

        if (!supabase || !user) return emptyResult;

        const rangeStart = months[0].start.toISOString();
        const rangeEnd = months[months.length - 1].end.toISOString();

        const [appointmentsRes, financialRes] = await Promise.all([
            supabase.from('schedule')
                .select('start_datetime,status')
                .eq('user_id', user.id)
                .gte('start_datetime', rangeStart)
                .lte('start_datetime', rangeEnd),
            supabase.from('financial')
                .select('amount,transaction_type,transaction_date')
                .eq('user_id', user.id)
                .gte('transaction_date', months[0].start.toISOString().split('T')[0])
                .lte('transaction_date', months[months.length - 1].end.toISOString().split('T')[0])
        ]);

        if (appointmentsRes.error || financialRes.error) {
            console.error('Erro ao buscar series:', appointmentsRes.error || financialRes.error);
            return emptyResult;
        }

        const appointments = months.map(() => 0);
        const revenue = months.map(() => 0);

        (appointmentsRes.data || []).forEach(item => {
            if (item.status === 'cancelled') return;
            const date = new Date(item.start_datetime);
            const idx = months.findIndex(m => date >= m.start && date <= m.end);
            if (idx >= 0) appointments[idx] += 1;
        });

        (financialRes.data || []).forEach(item => {
            if (item.transaction_type !== 'income') return;
            const date = new Date(item.transaction_date);
            const idx = months.findIndex(m => date >= m.start && date <= m.end);
            if (idx >= 0) revenue[idx] += Number(item.amount || 0);
        });

        return { labels, appointments, revenue };
    }

    getLastMonths(count) {
        const months = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            const label = start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            months.push({ start, end, label });
        }
        return months;
    }

    renderAppointmentsChart(labels, values) {
        const ctx = document.getElementById('appointmentsChart');
        const empty = document.getElementById('appointmentsChartEmpty');
        if (!ctx) return;
        const isEmpty = values.every(v => v === 0);
        ctx.style.display = isEmpty ? 'none' : 'block';
        if (empty) empty.classList.toggle('hidden', !isEmpty);
        if (isEmpty) {
            if (this.appointmentsChart) this.appointmentsChart.destroy();
            return;
        }

        const data = {
            labels,
            datasets: [{
                label: 'Atendimentos',
                data: values,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        };

        if (this.appointmentsChart) this.appointmentsChart.destroy();
        this.appointmentsChart = new Chart(ctx, { type: 'line', data, options });
    }

    renderRevenueChart(labels, values) {
        const ctx = document.getElementById('revenueChart');
        const empty = document.getElementById('revenueChartEmpty');
        if (!ctx) return;
        const isEmpty = values.every(v => v === 0);
        ctx.style.display = isEmpty ? 'none' : 'block';
        if (empty) empty.classList.toggle('hidden', !isEmpty);
        if (isEmpty) {
            if (this.revenueChart) this.revenueChart.destroy();
            return;
        }

        const data = {
            labels,
            datasets: [{
                label: 'Receita',
                data: values,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: value => 'R$ ' + value.toLocaleString('pt-BR') }
                }
            }
        };

        if (this.revenueChart) this.revenueChart.destroy();
        this.revenueChart = new Chart(ctx, { type: 'line', data, options });
    }

    async loadUpcomingAppointments() {
        const container = document.getElementById('upcomingAppointments');
        if (!container) return;
        const { supabase, user } = await this.getSupabaseAndUser();
        if (!supabase || !user) {
            container.innerHTML = '<div>Nenhum atendimento agendado.</div>';
            return;
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('schedule')
            .select('title,patient_name,start_datetime,status')
            .eq('user_id', user.id)
            .gte('start_datetime', now)
            .order('start_datetime', { ascending: true })
            .limit(5);

        if (error) {
            console.error('Erro ao carregar proximos atendimentos:', error);
            container.innerHTML = '<div>Erro ao carregar atendimentos.</div>';
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = '<div>Nenhum atendimento agendado.</div>';
            return;
        }

        container.innerHTML = data.map(item => {
            const date = new Date(item.start_datetime);
            const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const timeLabel = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const patient = item.patient_name || 'Paciente';
            const title = item.title || 'Atendimento';
            return `
                <div class="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <div>
                        <p class="text-sm font-medium text-gray-900">${title}</p>
                        <p class="text-xs text-gray-500">${patient}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-900">${dateLabel}</p>
                        <p class="text-xs text-gray-500">${timeLabel}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    getTodayAppointments(appointments) {
        const today = new Date().toISOString().split('T')[0];
        return appointments.filter(apt => {
            const dateValue = apt.start_datetime || apt.appointment_date || apt.date;
            if (!dateValue) return false;
            const aptDate = new Date(dateValue).toISOString().split('T')[0];
            return aptDate === today;
        }).length;
    }

    getMonthlyRevenue(financial) {
        const currentMonth = new Date().getMonth();
        const monthly = financial.filter(item => {
            const itemMonth = new Date(item.transaction_date).getMonth();
            return itemMonth === currentMonth && item.transaction_type === 'income';
        });

        return monthly.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    getPendingCount(appointments) {
        return appointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed').length;
    }

    async getSupabaseAndUser() {
        const attempts = 12;
        for (let i = 0; i < attempts; i++) {
            const supabase = window.authManager?.supabase;
            const user = window.authManager?.getCurrentUser?.();
            if (supabase && user) return { supabase, user };
            await new Promise(r => setTimeout(r, 150));
        }
        return { supabase: null, user: null };
    }

    // Métodos para serem implementados
    async loadPatients() {
        // Será implementado em patients.js
        if (window.patientsManager) {
            window.patientsManager.loadPatients();
        }
    }

    async loadSchedule() {
        // Será implementado em schedule.js
        if (window.scheduleManager) {
            window.scheduleManager.loadSchedule();
        }
    }

    async loadFinance() {
        // Será implementado em finance.js
        if (window.financeManager) {
            window.financeManager.loadFinance();
        }
    }

    async loadProfile() {
        const container = document.getElementById('profile');
        if (!container) return;

        const profile = await this.getProfileWithRetry();
        const mainInfo = document.getElementById('profileMainInfo');
        const planInfo = document.getElementById('profilePlanInfo');

        if (!profile) {
            if (mainInfo) {
                mainInfo.innerHTML = '<div class="empty-state">Complete seu cadastro para exibir informa&ccedil;&otilde;es aqui.</div>';
            }
            if (planInfo) {
                planInfo.innerHTML = '<div class="empty-state">Plano atual ser&aacute; exibido aqui.</div>';
            }
            this.loadProfileExtras();
            return;
        }

        if (mainInfo) {
            mainInfo.innerHTML = `
                <div class="space-y-2 text-sm text-gray-600">
                    <div><strong class="text-gray-900">Nome:</strong> ${profile.full_name || '-'}</div>
                    <div><strong class="text-gray-900">Profissao:</strong> ${profile.profession || '-'}</div>
                    <div><strong class="text-gray-900">Clinica:</strong> ${profile.clinic_name || '-'}</div>
                    <div><strong class="text-gray-900">Telefone:</strong> ${profile.phone || '-'}</div>
                    <div><strong class="text-gray-900">Cidade:</strong> ${profile.city || '-'}</div>
                </div>
            `;
        }

        if (planInfo) {
            const plan = profile.plan || 'free';
            const limit = window.authManager?.getPlanPatientLimit?.() || 0;
            planInfo.innerHTML = `
                <div class="space-y-2 text-sm text-gray-600">
                    <div><strong class="text-gray-900">Plano atual:</strong> ${plan === 'pro' ? 'Pro' : 'Gratuito'}</div>
                    <div><strong class="text-gray-900">Limite de pacientes:</strong> ${limit}</div>
                </div>
            `;
        }

        this.loadProfileExtras();
    }

    async getProfileWithRetry() {
        const attempts = 12;
        for (let i = 0; i < attempts; i++) {
            const profile = window.authManager?.getProfile?.();
            if (profile) return profile;
            await new Promise(r => setTimeout(r, 150));
        }
        return null;
    }

    getProfileStorageKey(suffix) {
        const user = window.authManager?.getCurrentUser?.();
        const userId = user?.id || 'guest';
        return profile__;
    }

    getStoredProfileData(suffix) {
        const key = this.getProfileStorageKey(suffix);
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.warn('Erro ao ler preferencias locais:', error);
            return null;
        }
    }

    setStoredProfileData(suffix, data) {
        const key = this.getProfileStorageKey(suffix);
        localStorage.setItem(key, JSON.stringify(data));
    }

    normalizeProfileExtra(value) {
        if (!value) return null;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (error) {
                return null;
            }
        }
        return value;
    }

    async persistProfileExtras(suffix, payload) {
        this.setStoredProfileData(suffix, payload);
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser?.();
        if (!supabase || !user) return;
        const updatePayload = { updated_at: new Date().toISOString() };
        updatePayload[suffix] = payload;

        const { data, error } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('user_id', user.id)
            .select('*')
            .single();

        if (error) {
            console.error('Erro ao salvar perfil extra:', error);
            return;
        }

        if (data && window.authManager) {
            window.authManager.profile = data;
        }
    }

    loadProfileExtras() {
        const preferencesEl = document.getElementById('profilePreferencesInfo');
        const brandEl = document.getElementById('profileBrandInfo');
        const profile = window.authManager?.getProfile?.();

        if (preferencesEl) {
            const prefs = this.normalizeProfileExtra(profile?.preferences) || this.getStoredProfileData('preferences');
            if (!prefs) {
                preferencesEl.innerHTML = '<div class="empty-state">Nenhuma prefer&ecirc;ncia definida.</div>';
            } else {
                preferencesEl.innerHTML = `
                    <div class="space-y-2 text-sm text-gray-600">
                        <div><strong class="text-gray-900">Notifica&ccedil;&otilde;es:</strong> ${prefs.notifications || 'Nenhuma'}</div>
                        <div><strong class="text-gray-900">Lembretes:</strong> ${prefs.reminders || 'Desativados'}</div>
                        <div><strong class="text-gray-900">Canal principal:</strong> ${prefs.channel || 'Email'}</div>
                    </div>
                `;
            }
        }

        if (brandEl) {
            const brand = this.normalizeProfileExtra(profile?.brand) || this.getStoredProfileData('brand');
            if (!brand) {
                brandEl.innerHTML = '<div class="empty-state">Personaliza&ccedil;&atilde;o em breve.</div>';
            } else {
                const colorSwatch = brand.primaryColor
                    ? `<span class="inline-block w-3 h-3 rounded-full align-middle mr-2" style="background:${brand.primaryColor};"></span>`
                    : '';
                brandEl.innerHTML = `
                    <div class="space-y-2 text-sm text-gray-600">
                        <div><strong class="text-gray-900">Nome exibido:</strong> ${brand.displayName || '-'}</div>
                        <div><strong class="text-gray-900">Cor principal:</strong> ${colorSwatch}${brand.primaryColor || '-'}</div>
                        <div><strong class="text-gray-900">Assinatura:</strong> ${brand.signature || '-'}</div>
                    </div>
                `;
            }
        }
    }
    showPreferencesModal() {
        const existing = document.getElementById('preferencesModal');
        if (existing) {
            existing.classList.add('active');
            return;
        }

        const profile = window.authManager?.getProfile?.();
        const prefs = this.normalizeProfileExtra(profile?.preferences) || this.getStoredProfileData('preferences') || {};
        const modal = document.createElement('div');
        modal.id = 'preferencesModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3>Prefer&ecirc;ncias</h3>
                    <button onclick="this.closest('.modal').classList.remove('active')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="preferencesForm" class="modal-body space-y-4">
                    <div class="form-group">
                        <label class="form-label">Notifica&ccedil;&otilde;es</label>
                        <select id="preferencesNotifications" class="form-select">
                            <option value="Todas" ${prefs.notifications === 'Todas' ? 'selected' : ''}>Todas</option>
                            <option value="Importantes" ${prefs.notifications === 'Importantes' ? 'selected' : ''}>Importantes</option>
                            <option value="Nenhuma" ${prefs.notifications === 'Nenhuma' ? 'selected' : ''}>Nenhuma</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lembretes</label>
                        <select id="preferencesReminders" class="form-select">
                            <option value="Ativados" ${prefs.reminders === 'Ativados' ? 'selected' : ''}>Ativados</option>
                            <option value="Desativados" ${prefs.reminders === 'Desativados' ? 'selected' : ''}>Desativados</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Canal principal</label>
                        <select id="preferencesChannel" class="form-select">
                            <option value="Email" ${prefs.channel === 'Email' ? 'selected' : ''}>Email</option>
                            <option value="Whatsapp" ${prefs.channel === 'Whatsapp' ? 'selected' : ''}>Whatsapp</option>
                            <option value="SMS" ${prefs.channel === 'SMS' ? 'selected' : ''}>SMS</option>
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('#preferencesForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const notifications = document.getElementById('preferencesNotifications').value;
            const reminders = document.getElementById('preferencesReminders').value;
            const channel = document.getElementById('preferencesChannel').value;
            const payload = { notifications, reminders, channel };
            this.persistProfileExtras('preferences', payload).then(() => {
                this.loadProfileExtras();
                modal.classList.remove('active');
            });
        });
    }

    showBrandModal() {
        const existing = document.getElementById('brandModal');
        if (existing) {
            existing.classList.add('active');
            return;
        }

        const profile = window.authManager?.getProfile?.();
        const brand = this.normalizeProfileExtra(profile?.brand) || this.getStoredProfileData('brand') || {};
        const modal = document.createElement('div');
        modal.id = 'brandModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3>Identidade visual</h3>
                    <button onclick="this.closest('.modal').classList.remove('active')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="brandForm" class="modal-body space-y-4">
                    <div class="form-group">
                        <label class="form-label">Nome exibido</label>
                        <input id="brandDisplayName" class="form-input" type="text" placeholder="Nome que aparece para clientes" value="${brand.displayName || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cor principal</label>
                        <input id="brandPrimaryColor" class="form-input" type="text" placeholder="#2563eb" value="${brand.primaryColor || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Assinatura</label>
                        <textarea id="brandSignature" class="form-textarea" rows="3" placeholder="Mensagem curta">${brand.signature || ''}</textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('#brandForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const displayName = document.getElementById('brandDisplayName').value.trim();
            const primaryColor = document.getElementById('brandPrimaryColor').value.trim();
            const signature = document.getElementById('brandSignature').value.trim();
            const payload = { displayName, primaryColor, signature };
            this.persistProfileExtras('brand', payload).then(() => {
                this.loadProfileExtras();
                modal.classList.remove('active');
            });
        });
    }
    loadPlansPage() {
        const profile = window.authManager?.getProfile?.();
        const plan = profile?.plan || 'free';
        const planLabel = plan === 'pro' ? 'Pro' : 'Gratuito';

        const proAction = document.getElementById('plansProAction');
        const currentPlanInfo = document.getElementById('currentPlanInfo');
        const currentPlanBadge = document.getElementById('currentPlanBadge');

        if (currentPlanBadge) {
            currentPlanBadge.textContent = planLabel;
        }

        if (currentPlanInfo) {
            currentPlanInfo.innerHTML = `
                <div class="space-y-2 text-sm text-gray-600">
                    <div><strong class="text-gray-900">Plano:</strong> ${planLabel}</div>
                    <div><strong class="text-gray-900">Limite:</strong> ${plan === 'pro' ? 'Ilimitado' : '4 pacientes'}</div>
                </div>
            `;
        }

        if (proAction) {
            if (plan === 'pro') {
                proAction.textContent = 'Cancelar plano';
                proAction.classList.remove('btn-primary');
                proAction.classList.add('btn-outline');
                proAction.onclick = () => window.authManager?.showCancelPlanModal?.();
            } else {
                proAction.textContent = 'Assinar Pro';
                proAction.classList.remove('btn-outline');
                proAction.classList.add('btn-primary');
                proAction.onclick = () => window.authManager?.showUpgradeModal?.();
            }
        }
    }

    loadSettings() {
        const container = document.getElementById('settings');
        if (!container) return;

        const profile = window.authManager.getProfile();
        const plan = profile?.plan || 'free';
        const limit = window.authManager.getPlanPatientLimit();
        const isPro = plan === 'pro';

        container.innerHTML = `
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 class="text-3xl font-bold text-gray-900">Configurações</h1>
                <div class="bg-white rounded-lg shadow p-6 mt-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="text-sm text-gray-500">Plano atual</div>
                            <div class="text-lg font-semibold text-gray-900">${isPro ? 'Pro' : 'Gratuito'}</div>
                            <div class="text-sm text-gray-600">Limite: ${isPro ? 'Ilimitado' : `${limit} pacientes`}</div>
                        </div>
                        <button class="btn ${isPro ? 'btn-outline' : 'btn-primary'}" id="upgradeSettingsButton">
                            ${isPro ? 'Cancelar plano' : 'Assinar Pro'}
                        </button>
                    </div>
                    <div class="text-sm text-gray-600">
                        ${isPro ? 'Seu plano Pro esta ativo.' : 'Plano Pro libera pacientes ilimitados por R$ 7,99/mês.'}
                    </div>
                </div>
            </div>
        `;

        const upgradeButton = document.getElementById('upgradeSettingsButton');
        if (upgradeButton) {
            upgradeButton.addEventListener('click', () => {
                if (isPro) {
                    window.authManager?.showCancelPlanModal?.();
                } else {
                    window.authManager.showUpgradeModal();
                }
            });
        }
    }
    // Utilitários
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(date));
    }

    formatDateTime(date) {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    exportReportsPdf() {
        window.print();
    }
}

// Inicializar aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FisioApp();
});

















