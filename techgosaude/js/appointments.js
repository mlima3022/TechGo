// Atendimentos
class AppointmentsManager {
    constructor() {
        this.appointments = [];
        this.currentAppointment = null;
        this.patientsCache = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadPatientsCache();
        this.loadAppointments();
        this.bindSyncEvents();
        this.initSyncChannel();
    }

    bindSyncEvents() {
        window.addEventListener('focus', () => {
            this.loadPatientsCache();
            this.loadAppointments();
        });
        window.addEventListener('storage', (e) => {
            if (e.key === 'patients_updated') {
                this.loadPatientsCache();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadPatientsCache();
                this.loadAppointments();
            }
        });
    }

    initSyncChannel() {
        if (!('BroadcastChannel' in window)) return;
        this.appointmentsChannel = new BroadcastChannel('appointments_sync');
        this.appointmentsChannel.addEventListener('message', () => {
            this.loadAppointments();
        });
        this.patientsChannel = new BroadcastChannel('patients_sync');
        this.patientsChannel.addEventListener('message', () => {
            this.loadPatientsCache();
        });
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            const registerBtn = e.target.closest('[data-register-evolution]');
            if (registerBtn) {
                const id = registerBtn.getAttribute('data-register-evolution');
                this.openEvolutionModal(id);
            }
            const completeBtn = e.target.closest('[data-complete-appointment]');
            if (completeBtn) {
                const id = completeBtn.getAttribute('data-complete-appointment');
                this.completeAppointment(id);
            }
            const addBtn = e.target.closest('#addAppointmentBtn');
            if (addBtn) {
                this.openAppointmentModal();
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.id === 'appointmentEvolutionForm') {
                e.preventDefault();
                this.saveEvolution();
            }
        });
    }

    async loadAppointments() {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            this.renderEmpty('Supabase nao configurado.');
            return;
        }

        const { data, error } = await supabase
            .from('schedule')
            .select('id,title,patient_name,patient_id,start_datetime,end_datetime,status')
            .eq('user_id', user.id)
            .order('start_datetime', { ascending: true });

        if (error) {
            console.error('Erro ao carregar atendimentos:', error);
            this.renderEmpty('Erro ao carregar atendimentos.');
            return;
        }

        this.appointments = data || [];
        this.renderStats();
        this.renderList();
    }

    renderStats() {
        const todayEl = document.getElementById('appointmentsToday');
        const pendingEl = document.getElementById('appointmentsPending');
        const weekEl = document.getElementById('appointmentsWeek');
        if (!todayEl || !pendingEl || !weekEl) return;

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

        const todayCount = this.appointments.filter(a => {
            const date = new Date(a.start_datetime);
            return date >= startOfDay && date <= endOfDay;
        }).length;

        const pendingCount = this.appointments.filter(a => ['scheduled', 'confirmed', 'in_progress'].includes(a.status)).length;

        const weekCount = this.appointments.filter(a => {
            const date = new Date(a.start_datetime);
            return date >= startOfDay && date <= weekEnd;
        }).length;

        todayEl.textContent = todayCount;
        pendingEl.textContent = pendingCount;
        weekEl.textContent = weekCount;
    }

    renderList() {
        const container = document.getElementById('appointmentsList');
        if (!container) return;

        if (!this.appointments.length) {
            container.innerHTML = '<div class="empty-state">Nenhum atendimento registrado ainda.</div>';
            return;
        }

        container.innerHTML = this.appointments.slice(0, 8).map(item => {
            const date = new Date(item.start_datetime);
            const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const timeLabel = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const status = item.status || 'scheduled';
            const statusLabel = this.getStatusLabel(status);

            return `
                <div class="flex flex-col md:flex-row md:items-center md:justify-between border border-gray-200 rounded-lg p-3">
                    <div class="flex items-center gap-4">
                        <div class="h-10 w-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                            <i class="fas fa-stethoscope"></i>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-900">${item.title}</p>
                            <p class="text-xs text-gray-500">${item.patient_name || 'Paciente'} • ${dateLabel} ${timeLabel}</p>
                        </div>
                    </div>
                    <div class="appointments-actions flex items-center gap-2 mt-3 md:mt-0">
                        <span class="badge badge-info">${statusLabel}</span>
                        <button class="btn btn-outline btn-sm" data-register-evolution="${item.id}">Registrar evolucao</button>
                        <button class="btn btn-outline btn-sm" data-complete-appointment="${item.id}">Concluir</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusLabel(status) {
        const map = {
            scheduled: 'Agendado',
            confirmed: 'Confirmado',
            in_progress: 'Em andamento',
            completed: 'Concluido',
            cancelled: 'Cancelado'
        };
        return map[status] || 'Agendado';
    }

    async completeAppointment(id) {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            window.authManager?.showError('Supabase nao configurado.');
            return;
        }
        const { error } = await supabase
            .from('schedule')
            .update({ status: 'completed' })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Erro ao concluir atendimento:', error);
            window.authManager?.showError('Erro ao concluir atendimento.');
            return;
        }
        window.authManager?.showSuccess('Atendimento concluido.');
        this.loadAppointments();
    }

    openEvolutionModal(appointmentId) {
        const appointment = this.appointments.find(a => a.id === appointmentId);
        if (!appointment) return;
        this.currentAppointment = appointment;

        if (!appointment.patient_id) {
            window.authManager?.showError('Este atendimento nao possui paciente vinculado.');
            return;
        }

        const dateValue = appointment.start_datetime ? new Date(appointment.start_datetime).toISOString().split('T')[0] : '';
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Registrar evolucao</h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="appointmentEvolutionForm" class="modal-body space-y-4">
                    <div class="text-sm text-gray-600">Paciente: ${appointment.patient_name || 'Paciente'}</div>
                    <div>
                        <label class="form-label">Data</label>
                        <input type="date" name="date" class="form-input" value="${dateValue}">
                    </div>
                    <div>
                        <label class="form-label">Procedimentos *</label>
                        <textarea name="procedures" rows="3" class="form-input" required></textarea>
                    </div>
                    <div>
                        <label class="form-label">Resultados *</label>
                        <textarea name="results" rows="3" class="form-input" required></textarea>
                    </div>
                </form>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Cancelar</button>
                    <button type="submit" form="appointmentEvolutionForm" class="btn btn-primary">Salvar evolucao</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async saveEvolution() {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            window.authManager?.showError('Supabase nao configurado.');
            return;
        }

        const formData = new FormData(document.getElementById('appointmentEvolutionForm'));
        const data = Object.fromEntries(formData);

        if (!this.currentAppointment?.patient_id) {
            window.authManager?.showError('Paciente nao encontrado.');
            return;
        }

        const { error } = await supabase.from('evolutions').insert([{
            user_id: user.id,
            patient_id: this.currentAppointment.patient_id,
            date: data.date,
            procedures: data.procedures,
            results: data.results
        }]);

        if (error) {
            console.error('Erro ao salvar evolucao:', error);
            window.authManager?.showError('Erro ao salvar evolucao.');
            return;
        }

        await supabase
            .from('schedule')
            .update({ status: 'completed' })
            .eq('id', this.currentAppointment.id)
            .eq('user_id', user.id);

        document.querySelector('.modal.active')?.remove();
        window.authManager?.showSuccess('Evolucao registrada.');
        this.loadAppointments();
    }

    async openAppointmentModal() {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            window.authManager?.showError('Supabase nao configurado.');
            return;
        }
        await this.loadPatientsCache();

        const today = new Date().toISOString().split('T')[0];
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-3xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Novo atendimento</h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="appointmentForm" class="modal-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Titulo *</label>
                            <input type="text" name="title" required class="form-input" placeholder="Ex.: Atendimento fisioterapia">
                        </div>
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Paciente</label>
                            <select name="patient_id" class="form-select">
                                <option value="">Sem paciente</option>
                                ${this.patientsCache.map(p => `<option value="${p.id}">${p.full_name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Data *</label>
                            <input type="date" name="date" required class="form-input" value="${today}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status *</label>
                            <select name="status" required class="form-select">
                                <option value="scheduled">Agendado</option>
                                <option value="confirmed">Confirmado</option>
                                <option value="in_progress">Em andamento</option>
                                <option value="completed">Concluido</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Inicio *</label>
                            <input type="time" name="start_time" required class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fim *</label>
                            <input type="time" name="end_time" required class="form-input">
                        </div>
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Descricao</label>
                            <textarea name="description" rows="3" class="form-input" placeholder="Detalhes do atendimento"></textarea>
                        </div>
                    </div>
                </form>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').classList.remove('active')">Cancelar</button>
                    <button type="submit" form="appointmentForm" class="btn btn-primary">Salvar atendimento</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#appointmentForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAppointment();
        });
    }

    async saveAppointment() {
        const form = document.getElementById('appointmentForm');
        if (!form) return;

        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            window.authManager?.showError('Supabase nao configurado.');
            return;
        }

        const data = Object.fromEntries(new FormData(form));
        const startDateTime = new Date(`${data.date}T${data.start_time}:00`);
        const endDateTime = new Date(`${data.date}T${data.end_time}:00`);

        const patientId = data.patient_id || null;
        const patient = this.patientsCache.find(p => p.id === patientId);

        const payload = {
            title: data.title,
            patient_id: patientId,
            patient_name: patient ? patient.full_name : '',
            start_datetime: startDateTime.toISOString(),
            end_datetime: endDateTime.toISOString(),
            status: data.status,
            description: data.description || '',
            color: '#3b82f6'
        };

        const { error } = await supabase
            .from('schedule')
            .insert([{ ...payload, user_id: user.id }]);
        if (error) {
            console.error('Erro ao salvar atendimento:', error);
            window.authManager?.showError('Erro ao salvar atendimento.');
            return;
        }

        document.querySelector('.modal.active')?.remove();
        window.authManager?.showSuccess('Atendimento criado.');
        this.loadAppointments();
        if (this.appointmentsChannel) {
            this.appointmentsChannel.postMessage({ type: 'appointments_updated', at: Date.now() });
        }
    }

    async loadPatientsCache() {
        try {
            const { supabase, user } = await this.getSupabaseAndUser();
            if (!supabase || !user) {
                this.patientsCache = [];
                return;
            }
            const { data, error } = await supabase
                .from('patients')
                .select('id,full_name')
                .eq('user_id', user.id)
                .order('full_name', { ascending: true });
            if (error) throw error;
            this.patientsCache = data || [];
        } catch (error) {
            console.error('Erro ao carregar pacientes:', error);
            this.patientsCache = [];
        }
    }

    renderEmpty(message) {
        const container = document.getElementById('appointmentsList');
        if (container) {
            container.innerHTML = `<div class="empty-state">${message}</div>`;
        }
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
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('appointmentsList')) {
        window.appointmentsManager = new AppointmentsManager();
    }
});
