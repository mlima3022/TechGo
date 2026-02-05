// Gerenciador de agenda
class ScheduleManager {
    constructor() {
        this.events = [];
        this.currentDate = new Date();
        this.viewType = 'month';
        this.currentEvent = null;
        this.patientsCache = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadPatientsCache();
        this.loadSchedule();
        this.bindSyncEvents();
        this.initSyncChannel();
    }

    bindSyncEvents() {
        window.addEventListener('focus', () => {
            this.loadPatientsCache();
            this.loadSchedule();
        });
        window.addEventListener('storage', (e) => {
            if (e.key === 'patients_updated') {
                this.loadPatientsCache();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadPatientsCache();
                this.loadSchedule();
            }
        });
    }

    initSyncChannel() {
        if (!('BroadcastChannel' in window)) return;
        this.patientsChannel = new BroadcastChannel('patients_sync');
        this.patientsChannel.addEventListener('message', () => {
            this.loadPatientsCache();
        });
        this.appointmentsChannel = new BroadcastChannel('appointments_sync');
        this.appointmentsChannel.addEventListener('message', () => {
            this.loadSchedule();
        });
    }

    bindEvents() {
        // Botão de adicionar agendamento
        document.addEventListener('click', (e) => {
            if (e.target.closest('#addScheduleBtn')) {
                this.showScheduleForm();
            }
        });

        // Formulário de agendamento
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'scheduleForm') {
                e.preventDefault();
                this.saveSchedule();
            }
        });

        // Navegação do calendário
        document.addEventListener('click', (e) => {
            if (e.target.closest('#prevMonth')) {
                this.changeMonth(-1);
            } else if (e.target.closest('#nextMonth')) {
                this.changeMonth(1);
            } else if (e.target.closest('#todayBtn')) {
                this.goToToday();
            }
        });

        // Mudança de visualização
        document.addEventListener('change', (e) => {
            if (e.target.id === 'viewType') {
                this.viewType = e.target.value;
                this.renderCalendar();
            }
        });
    }

    async loadSchedule() {
        try {
            const supabase = window.authManager?.supabase;
            const user = window.authManager?.getCurrentUser();
            if (!supabase || !user) {
                this.events = [];
                this.renderCalendar();
                return;
            }

            const { data, error } = await supabase
                .from('schedule')
                .select('*')
                .eq('user_id', user.id)
                .order('start_datetime', { ascending: true });
            if (error) throw error;
            this.events = data || [];
            this.renderCalendar();
        } catch (error) {
            console.error('Erro ao carregar agenda:', error);
            this.showError('Erro ao carregar agenda');
        }
    }

    renderCalendar() {
        const container = document.getElementById('schedule');
        if (!container) return;

        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="mb-8">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div class="mb-4 sm:mb-0">
                            <h1 class="text-3xl font-bold text-gray-900">Agenda</h1>
                            <p class="text-gray-600 mt-1">Gerencie seus compromissos e atendimentos</p>
                        </div>
                        <div class="flex items-center space-x-4">
                            <select id="viewType" class="form-select">
                                <option value="month" ${this.viewType === 'month' ? 'selected' : ''}>Mês</option>
                                <option value="week" ${this.viewType === 'week' ? 'selected' : ''}>Semana</option>
                                <option value="day" ${this.viewType === 'day' ? 'selected' : ''}>Dia</option>
                            </select>
                            <button id="addScheduleBtn" class="btn btn-primary">
                                <i class="fas fa-plus mr-2"></i>Novo Compromisso
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Controles do calendário -->
                <div class="bg-white rounded-lg shadow mb-6 p-4">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-semibold text-gray-900">
                            ${this.formatDate(this.currentDate, 'month')}
                        </h2>
                        <div class="flex items-center space-x-2">
                            <button id="prevMonth" class="btn btn-outline btn-sm">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button id="todayBtn" class="btn btn-outline btn-sm">
                                Hoje
                            </button>
                            <button id="nextMonth" class="btn btn-outline btn-sm">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Calendário -->
                    <div id="calendar" class="calendar-container">
                        ${this.renderCalendarGrid()}
                    </div>
                </div>

                <!-- Próximos compromissos -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Próximos Compromissos</h3>
                    <div id="upcomingEvents" class="space-y-3">
                        ${this.renderUpcomingEvents()}
                    </div>
                </div>
            </div>
        `;
    }

    renderCalendarGrid() {
        if (this.viewType === 'month') {
            return this.renderMonthView();
        } else if (this.viewType === 'week') {
            return this.renderWeekView();
        } else {
            return this.renderDayView();
        }
    }

    renderMonthView() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let html = '<div class="grid grid-cols-7 gap-1 mb-2">';
        
        // Dias da semana
        const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        weekDays.forEach(day => {
            html += `<div class="text-center font-medium text-gray-500 py-2">${day}</div>`;
        });

        html += '</div><div class="grid grid-cols-7 gap-1">';

        // Dias do mês
        const today = new Date();
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.toDateString() === today.toDateString();
            const dayEvents = this.getEventsForDate(date);

            html += `
                <div class="min-h-24 p-2 border border-gray-200 rounded ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white'} ${isToday ? 'bg-blue-50 border-blue-300' : ''}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-sm font-medium ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}">${date.getDate()}</span>
                        ${dayEvents.length > 0 ? `<span class="badge badge-primary badge-sm">${dayEvents.length}</span>` : ''}
                    </div>
                    <div class="space-y-1">
                        ${dayEvents.slice(0, 2).map(event => `
                            <div class="text-xs p-1 rounded text-white truncate" 
                                 style="background-color: ${event.color || '#3b82f6'}"
                                 title="${event.title}">
                                ${event.title}
                            </div>
                        `).join('')}
                        ${dayEvents.length > 2 ? `<div class="text-xs text-gray-500">+${dayEvents.length - 2} mais</div>` : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    renderWeekView() {
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());

        let html = '<div class="grid grid-cols-8 gap-1">';
        
        // Horas
        html += '<div class="font-medium text-gray-500 p-2">Horário</div>';
        
        // Dias da semana
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            html += `<div class="text-center font-medium text-gray-500 p-2">
                        <div>${date.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                        <div class="text-lg">${date.getDate()}</div>
                     </div>`;
        }

        // Horários
        for (let hour = 6; hour <= 22; hour++) {
            html += `<div class="font-medium text-gray-500 p-2 text-right">${hour}:00</div>`;
            for (let day = 0; day < 7; day++) {
                const date = new Date(startOfWeek);
                date.setDate(startOfWeek.getDate() + day);
                date.setHours(hour, 0, 0, 0);
                
                const hourEvents = this.getEventsForDateRange(date, new Date(date.getTime() + 3600000));
                
                html += `<div class="min-h-16 p-2 border border-gray-200 rounded bg-white">
                            ${hourEvents.map(event => `
                                <div class="text-xs p-1 mb-1 rounded text-white truncate" 
                                     style="background-color: ${event.color || '#3b82f6'}"
                                     title="${event.title}">
                                    ${event.title}
                                </div>
                            `).join('')}
                         </div>`;
            }
        }

        html += '</div>';
        return html;
    }

    renderDayView() {
        const dayStart = new Date(this.currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(this.currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        let html = '<div class="space-y-2">';
        
        // Horários
        for (let hour = 6; hour <= 22; hour++) {
            const hourStart = new Date(this.currentDate);
            hourStart.setHours(hour, 0, 0, 0);
            const hourEnd = new Date(this.currentDate);
            hourEnd.setHours(hour, 59, 59, 999);
            
            const hourEvents = this.getEventsForDateRange(hourStart, hourEnd);
            
            html += `
                <div class="flex items-start space-x-4 p-4 border border-gray-200 rounded bg-white">
                    <div class="font-medium text-gray-500 w-16 text-right">${hour}:00</div>
                    <div class="flex-1">
                        ${hourEvents.map(event => `
                            <div class="p-3 mb-2 rounded text-white" 
                                 style="background-color: ${event.color || '#3b82f6'}">
                                <div class="font-medium">${event.title}</div>
                                <div class="text-sm opacity-90">${event.description || 'Sem descrição'}</div>
                                <div class="text-xs opacity-75 mt-1">
                                    ${new Date(event.start_datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    - 
                                    ${new Date(event.end_datetime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        `).join('')}
                        ${hourEvents.length === 0 ? '<div class="text-gray-400 text-sm">Nenhum compromisso</div>' : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    renderUpcomingEvents() {
        const now = new Date();
        const upcoming = this.events
            .filter(event => new Date(event.start_datetime) >= now)
            .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
            .slice(0, 5);

        if (upcoming.length === 0) {
            return '<div class="text-center text-gray-500 py-4">Nenhum compromisso próximo</div>';
        }

        return upcoming.map(event => {
            const date = new Date(event.start_datetime);
            const isToday = date.toDateString() === now.toDateString();
            
            return `
                <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div class="flex items-center">
                        <div class="h-10 w-10 rounded-full flex items-center justify-center"
                             style="background-color: ${event.color || '#3b82f6'}20; color: ${event.color || '#3b82f6'}">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <div class="ml-3">
                            <div class="font-medium text-gray-900">${event.title}</div>
                            <div class="text-sm text-gray-600">
                                ${isToday ? 'Hoje' : date.toLocaleDateString('pt-BR')}
                                às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                    <button onclick="window.scheduleManager.editSchedule('${event.id}')" 
                            class="btn btn-outline btn-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    showScheduleForm(event = null) {
        this.currentEvent = event || null;
        const start = event?.start_datetime ? new Date(event.start_datetime) : new Date();
        const end = event?.end_datetime ? new Date(event.end_datetime) : new Date(start.getTime() + 3600000);

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-3xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">
                        ${event ? 'Editar Compromisso' : 'Novo Compromisso'}
                    </h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="scheduleForm" class="modal-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Título *</label>
                            <input type="text" name="title" required 
                                   value="${event?.title || ''}" class="form-input">
                        </div>
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Paciente</label>
                            <select name="patient_id" class="form-select">
                                <option value="">Sem paciente</option>
                                ${this.patientsCache.map(p => `<option value="${p.id}" ${event?.patient_id === p.id ? 'selected' : ''}>${p.full_name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Data *</label>
                            <input type="date" name="date" required 
                                   value="${start.toISOString().split('T')[0]}" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status *</label>
                            <select name="status" required class="form-select">
                                <option value="scheduled" ${event?.status === 'scheduled' ? 'selected' : ''}>Agendado</option>
                                <option value="confirmed" ${event?.status === 'confirmed' ? 'selected' : ''}>Confirmado</option>
                                <option value="in_progress" ${event?.status === 'in_progress' ? 'selected' : ''}>Em andamento</option>
                                <option value="completed" ${event?.status === 'completed' ? 'selected' : ''}>Concluído</option>
                                <option value="cancelled" ${event?.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Início *</label>
                            <input type="time" name="start_time" required 
                                   value="${start.toTimeString().slice(0, 5)}" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fim *</label>
                            <input type="time" name="end_time" required 
                                   value="${end.toTimeString().slice(0, 5)}" class="form-input">
                        </div>
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Descrição</label>
                            <textarea name="description" rows="3" class="form-input"
                                      placeholder="Detalhes do atendimento">${event?.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Cor</label>
                            <input type="color" name="color" 
                                   value="${event?.color || '#3b82f6'}" class="form-input">
                        </div>
                    </div>
                </form>
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').classList.remove('active')" 
                            class="btn btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" form="scheduleForm" class="btn btn-primary">
                        ${event ? 'Atualizar' : 'Salvar'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async saveSchedule() {
        const formData = new FormData(document.getElementById('scheduleForm'));
        const data = Object.fromEntries(formData);

        const startDateTime = new Date(`${data.date}T${data.start_time}:00`);
        const endDateTime = new Date(`${data.date}T${data.end_time}:00`);

        const patientMatch = this.patientsCache.find(p => p.id === (data.patient_id || null));

        const payload = {
            title: data.title,
            patient_name: patientMatch ? patientMatch.full_name : '',
            patient_id: patientMatch ? patientMatch.id : null,
            start_datetime: startDateTime.toISOString(),
            end_datetime: endDateTime.toISOString(),
            status: data.status,
            description: data.description || '',
            color: data.color || '#3b82f6'
        };

        try {
            const supabase = window.authManager?.supabase;
            const user = window.authManager?.getCurrentUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            if (this.currentEvent) {
                const { error } = await supabase
                    .from('schedule')
                    .update(payload)
                    .eq('id', this.currentEvent.id)
                    .eq('user_id', user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('schedule')
                    .insert([{
                        ...payload,
                        user_id: user.id
                    }]);
                if (error) throw error;
            }
            window.authManager.showSuccess(
                this.currentEvent ? 'Compromisso atualizado com sucesso!' : 'Compromisso criado com sucesso!'
            );
            this.currentEvent = null;
            this.loadSchedule();
            document.querySelector('.modal.active').remove();
        } catch (error) {
            console.error('Erro ao salvar compromisso:', error);
            this.showError('Erro ao salvar compromisso. Tente novamente.');
        }
    }

    editSchedule(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            this.currentEvent = event;
            this.showScheduleForm(event);
        }
    }

    changeMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }

    getEventsForDate(date) {
        return this.events.filter(event => {
            const eventDate = new Date(event.start_datetime);
            return eventDate.toDateString() === date.toDateString();
        });
    }

    getEventsForDateRange(startDate, endDate) {
        return this.events.filter(event => {
            const eventDate = new Date(event.start_datetime);
            return eventDate >= startDate && eventDate <= endDate;
        });
    }

    formatDate(date, type = 'full') {
        if (type === 'month') {
            return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        }
        return date.toLocaleDateString('pt-BR');
    }

    showError(message) {
        window.authManager.showError(message);
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
            console.error('Erro ao carregar pacientes para agenda:', error);
            this.patientsCache = [];
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

// Inicializar gerenciador de agenda
document.addEventListener('DOMContentLoaded', () => {
    window.scheduleManager = new ScheduleManager();
});

