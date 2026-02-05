const MAX_EXAM_SIZE_MB = 10;
// Gerenciador de pacientes
class PatientsManager {
    constructor() {
        this.patients = [];
        this.currentPatient = null;
        this.currentPatientDetails = null;
        this.examsBucket = 'exams';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadPatients();
        this.loadPatientDetailPage();
        this.bindRefreshEvents();
        this.initSyncChannel();
    }

    bindRefreshEvents() {
        window.addEventListener('focus', () => this.loadPatients());
        window.addEventListener('storage', (e) => {
            if (e.key === 'patients_updated') {
                this.loadPatients();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadPatients();
            }
        });
    }

    initSyncChannel() {
        if (!('BroadcastChannel' in window)) return;
        this.patientsChannel = new BroadcastChannel('patients_sync');
        this.patientsChannel.addEventListener('message', () => {
            this.loadPatients();
        });
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

    bindEvents() {
        // Botão de adicionar paciente
        document.addEventListener('click', (e) => {
            if (e.target.closest('#addPatientBtn')) {
                this.showPatientForm();
            }
            if (e.target.closest('#importPatientsBtn')) {
                this.showImportModal();
            }
            if (e.target.closest('#downloadImportTemplate')) {
                this.downloadImportTemplate();
            }
        });

        // Formulário de paciente
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'patientForm') {
                e.preventDefault();
                this.savePatient();
            }
        });

        // Busca de pacientes
        document.addEventListener('input', (e) => {
            if (e.target.id === 'patientSearch') {
                this.searchPatients(e.target.value);
            }
        });

        // Tabs e ações no modal do paciente
        document.addEventListener('click', (e) => {
            const tabButton = e.target.closest('[data-tab]');
            if (tabButton) {
                this.switchPatientTab(tabButton);
                return;
            }

            const deleteBtn = e.target.closest('[data-delete-patient]');
            if (deleteBtn) {
                const patientId = deleteBtn.getAttribute('data-delete-patient');
                this.confirmDeletePatient(patientId);
                return;
            }

            const downloadExamBtn = e.target.closest('[data-download-exam]');
            if (downloadExamBtn) {
                const patientId = downloadExamBtn.getAttribute('data-patient-id');
                const examId = downloadExamBtn.getAttribute('data-download-exam');
                this.downloadExam(patientId, examId);
                return;
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.id === 'anamnesisForm') {
                e.preventDefault();
                this.saveAnamnesis();
            }
            if (e.target.id === 'evolutionForm') {
                e.preventDefault();
                this.addEvolution();
            }
            if (e.target.id === 'patientAppointmentForm') {
                e.preventDefault();
                this.addPatientAppointment();
            }
            if (e.target.id === 'interventionForm') {
                e.preventDefault();
                this.saveInterventionPlan();
            }
            if (e.target.id === 'deletePatientForm') {
                e.preventDefault();
                this.deletePatient();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'examFileInput') {
                this.addExamFile(e);
            }
            if (e.target.id === 'importPatientsFile') {
                this.handleImportFile(e);
            }
        });
    }

    async loadPatients() {
        try {
            const { supabase, user } = await this.getSupabaseAndUser();
            if (!supabase || !user) {
                this.patients = [];
                this.renderPatients();
                return;
            }

            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.patients = data || [];
            this.renderPatients();
        } catch (error) {
            console.error('Erro ao carregar pacientes:', error);
            this.showError('Erro ao carregar pacientes');
        }
    }

    getPatientsHeadingHtml() {
        const view = document.body?.dataset?.patientView || 'patients';
        const config = {
            patients: {
                title: 'Pacientes',
                subtitle: 'Gerencie seus pacientes e seus dados'
            },
            intervention: {
                title: 'Plano de Intervencao',
                subtitle: 'Estruture objetivos e condutas do paciente'
            },
            anamnesis: {
                title: 'Anamnese',
                subtitle: 'Registre e consulte anamneses dos pacientes'
            },
            evolution: {
                title: 'Evolucoes',
                subtitle: 'Acompanhe a evolucao clinica dos pacientes'
            },
            exams: {
                title: 'Exames',
                subtitle: 'Centralize os exames e anexos dos pacientes'
            }
        };
        const current = config[view] || config.patients;
        return `
            <h1 class="text-3xl font-bold text-gray-900">${current.title}</h1>
            <p class="text-gray-600 mt-1">${current.subtitle}</p>
        `;
    }

    getPatientsEmptyMessage() {
        const view = document.body?.dataset?.patientView || 'patients';
        if (view === 'intervention') return 'Selecione um paciente para criar o plano de intervencao';
        if (view === 'anamnesis') return 'Selecione um paciente para iniciar a anamnese';
        if (view === 'evolution') return 'Selecione um paciente para registrar evolucoes';
        if (view === 'exams') return 'Envie exames vinculados a um paciente';
        return 'Comece adicionando seu primeiro paciente';
    }

    getCurrentView() {
        return document.body?.dataset?.patientView || 'patients';
    }

    getPrimaryActionLabel() {
        const view = this.getCurrentView();
        if (view === 'intervention') return 'Plano de intervencao';
        if (view === 'anamnesis') return 'Abrir anamnese';
        if (view === 'evolution') return 'Registrar evolucao';
        if (view === 'exams') return 'Gerenciar exames';
        return 'Ver';
    }

    getViewHintText() {
        const view = this.getCurrentView();
        if (view === 'intervention') return 'Selecione um paciente para montar o plano de intervencao.';
        if (view === 'anamnesis') return 'Selecione um paciente para registrar a anamnese.';
        if (view === 'evolution') return 'Selecione um paciente para registrar evolucoes.';
        if (view === 'exams') return 'Selecione um paciente para importar exames.';
        return '';
    }


renderPatients() {
        const container = document.getElementById('patients');
        if (!container) return;

        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="mb-8">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div class="mb-4 sm:mb-0">
                            ${this.getPatientsHeadingHtml()}
                        </div>
                        <div class="flex flex-wrap gap-3">
                            ${this.getCurrentView() === 'patients' ? `
                                <button id="importPatientsBtn" class="btn btn-outline">
                                    <i class="fas fa-file-import mr-2"></i>Importar XLSX
                                </button>
                            ` : ''}
                            <button id="addPatientBtn" class="btn btn-primary">
                                <i class="fas fa-plus mr-2"></i>${this.getCurrentView() === 'patients' ? 'Adicionar Paciente' : 'Cadastrar Paciente'}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Barra de busca -->
                <div class="mb-6">
                    <div class="relative">
                        <input type="text" id="patientSearch" placeholder="Buscar pacientes..." 
                               class="form-input pl-10">
                        <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    </div>
                </div>
                ${this.getCurrentView() !== 'patients' ? `
                    <div class="mb-6 bg-primary-50 border border-primary-100 rounded-lg p-4 text-sm text-gray-700">
                        ${this.getViewHintText()}
                    </div>
                ` : ''}

                <!-- Lista de pacientes -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${this.patients.map(patient => this.renderPatientCard(patient)).join('')}
                </div>

                ${this.patients.length === 0 ? `
                    <div class="text-center py-12">
                        <i class="fas fa-users text-6xl text-gray-300 mb-4"></i>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">Nenhum paciente encontrado</h3>
                        <p class="text-gray-600">${this.getPatientsEmptyMessage()}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderPatientCard(patient) {
        const age = this.calculateAge(patient.birth_date);
        const statusBadge = patient.is_active ? 
            '<span class="badge badge-success">Ativo</span>' : 
            '<span class="badge badge-danger">Inativo</span>';

        return `
            <div class="card p-6">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center">
                        <div class="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-primary-600 text-xl"></i>
                        </div>
                        <div class="ml-4">
                            <h3 class="font-semibold text-gray-900">${patient.full_name}</h3>
                            <p class="text-sm text-gray-600">${age} anos</p>
                        </div>
                    </div>
                    ${statusBadge}
                </div>

                <div class="space-y-2 mb-4">
                    <div class="flex items-center text-sm text-gray-600">
                        <i class="fas fa-phone mr-2"></i>
                        ${patient.phone || 'Não informado'}
                    </div>
                    <div class="flex items-center text-sm text-gray-600">
                        <i class="fas fa-map-marker-alt mr-2"></i>
                        ${patient.neighborhood || 'Não informado'}
                    </div>
                    <div class="flex items-center text-sm text-gray-600">
                        <i class="fas fa-calendar mr-2"></i>
                        Cadastrado em ${window.app.formatDate(patient.created_at)}
                    </div>
                </div>

                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                        ${this.getCurrentView() === 'patients' ? `
                            <button onclick="window.patientsManager.viewPatient('${patient.id}')" class="btn btn-outline text-sm">
                                <i class="fas fa-eye mr-1"></i>Ver
                            </button>
                            <button onclick="window.patientsManager.editPatient('${patient.id}')" class="btn btn-outline text-sm">
                                <i class="fas fa-edit mr-1"></i>Editar
                            </button>
                            <button data-delete-patient="${patient.id}" class="btn btn-outline text-sm">
                                <i class="fas fa-trash mr-1"></i>Excluir
                            </button>
                        ` : `
                            <button onclick="window.patientsManager.viewPatient('${patient.id}')" class="btn btn-primary text-sm">
                                ${this.getPrimaryActionLabel()}
                            </button>
                            <button onclick="window.patientsManager.editPatient('${patient.id}')" class="btn btn-outline text-sm">
                                Editar
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    showPatientForm(patient = null) {
        this.currentPatient = patient;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-4xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">
                        ${patient ? 'Editar Paciente' : 'Novo Paciente'}
                    </h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="patientForm" class="modal-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Informa&ccedil;&otilde;es Pessoais -->
                        <div class="md:col-span-2">
                            <h3 class="text-lg font-medium text-gray-900 mb-4">Informa&ccedil;&otilde;es Pessoais</h3>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Nome Completo *</label>
                            <input type="text" name="full_name" required 
                                   value="${patient?.full_name || ''}" class="form-input">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Data de Nascimento *</label>
                            <input type="date" name="birth_date" required 
                                   value="${patient?.birth_date ? patient.birth_date.split('T')[0] : ''}" 
                                   class="form-input">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Sexo *</label>
                            <select name="gender" required class="form-select">
                                <option value="">Selecione...</option>
                                <option value="M" ${patient?.gender === 'M' ? 'selected' : ''}>Masculino</option>
                                <option value="F" ${patient?.gender === 'F' ? 'selected' : ''}>Feminino</option>
                                <option value="O" ${patient?.gender === 'O' ? 'selected' : ''}>Outro</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">CPF</label>
                            <input type="text" name="cpf" value="${patient?.cpf || ''}" 
                                   class="form-input" placeholder="000.000.000-00">
                        </div>

                        <!-- Contato -->
                        <div class="md:col-span-2 mt-6">
                            <h3 class="text-lg font-medium text-gray-900 mb-4">Contato</h3>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Telefone Principal *</label>
                            <input type="tel" name="phone" required 
                                   value="${patient?.phone || ''}" class="form-input" 
                                   placeholder="(00) 00000-0000">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Telefone Secundário</label>
                            <input type="tel" name="phone_secondary" 
                                   value="${patient?.phone_secondary || ''}" class="form-input" 
                                   placeholder="(00) 00000-0000">
                        </div>
                        
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Email</label>
                            <input type="email" name="email" value="${patient?.email || ''}" 
                                   class="form-input" placeholder="email@exemplo.com">
                        </div>

                        <!-- Endereço -->
                        <div class="md:col-span-2 mt-6">
                            <h3 class="text-lg font-medium text-gray-900 mb-4">Endereço para Atendimento</h3>
                        </div>
                        
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Endereço Completo *</label>
                            <input type="text" name="address" required 
                                   value="${patient?.address || ''}" class="form-input" 
                                   placeholder="Rua, número, complemento">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Bairro *</label>
                            <input type="text" name="neighborhood" required 
                                   value="${patient?.neighborhood || ''}" class="form-input">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Cidade *</label>
                            <input type="text" name="city" required 
                                   value="${patient?.city || ''}" class="form-input">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Estado *</label>
                            <input type="text" name="state" required 
                                   value="${patient?.state || ''}" class="form-input" placeholder="UF">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">CEP</label>
                            <input type="text" name="zip_code" value="${patient?.zip_code || ''}" 
                                   class="form-input" placeholder="00000-000">
                        </div>
                        
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Ponto de Refer&ecirc;ncia</label>
                            <input type="text" name="reference_point" 
                                   value="${patient?.reference_point || ''}" class="form-input">
                        </div>

                        <!-- Informa&ccedil;&otilde;es M&eacute;dicas -->
                        <div class="md:col-span-2 mt-6">
                            <h3 class="text-lg font-medium text-gray-900 mb-4">Informa&ccedil;&otilde;es M&eacute;dicas</h3>
                        </div>
                        
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Alergias</label>
                            <textarea name="allergies" rows="3" class="form-input" 
                                      placeholder="Liste as alergias do paciente">${patient?.allergies || ''}</textarea>
                        </div>
                        
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Medicações em Uso</label>
                            <textarea name="medications" rows="3" class="form-input" 
                                      placeholder="Liste as medicações que o paciente está tomando">${patient?.medications || ''}</textarea>
                        </div>
                        
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Observações Gerais</label>
                            <textarea name="general_notes" rows="3" class="form-input" 
                                      placeholder="Outras informações importantes sobre o paciente">${patient?.general_notes || ''}</textarea>
                        </div>
                    </div>
                </form>
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').classList.remove('active')" 
                            class="btn btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" form="patientForm" class="btn btn-primary">
                        ${patient ? 'Atualizar' : 'Salvar'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const evolutionDate = document.getElementById('evolutionDate');
        if (evolutionDate && !evolutionDate.value) {
            const today = new Date().toISOString().split('T')[0];
            evolutionDate.value = today;
        }
    }

    async savePatient() {
        const formData = new FormData(document.getElementById('patientForm'));
        const patientData = Object.fromEntries(formData);
        
        const currentUser = window.authManager.getCurrentUser();
        
        // Converter data de nascimento
        if (patientData.birth_date) {
            patientData.birth_date = new Date(patientData.birth_date).toISOString().split('T')[0];
        }
        
        try {
            const { supabase, user } = await this.getSupabaseAndUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            if (this.currentPatient) {
                const { error } = await supabase
                    .from('patients')
                    .update({
                        ...patientData
                    })
                    .eq('id', this.currentPatient.id)
                    .eq('user_id', user.id);
                if (error) throw error;
            } else {
                const planLimit = window.authManager.getPlanPatientLimit();
                if (this.patients.length >= planLimit) {
                    window.authManager.showUpgradeModal();
                    return;
                }
                const { error } = await supabase
                    .from('patients')
                    .insert([{
                        ...patientData,
                        user_id: user.id,
                        is_active: true
                    }]);
                if (error) throw error;
            }

            window.authManager.showSuccess(
                this.currentPatient ? 'Paciente atualizado com sucesso!' : 'Paciente criado com sucesso!'
            );
            this.loadPatients();
            localStorage.setItem('patients_updated', Date.now().toString());
            if (this.patientsChannel) {
                this.patientsChannel.postMessage({ type: 'patients_updated', at: Date.now() });
            }
            if (window.scheduleManager && window.scheduleManager.loadPatientsCache) {
                window.scheduleManager.loadPatientsCache();
            }
            const form = document.getElementById('patientForm');
            const modal = form ? form.closest('.modal') : document.querySelector('.modal.active');
            if (modal) modal.remove();
        } catch (error) {
            console.error('Erro ao salvar paciente:', error);
            this.showError('Erro ao salvar paciente. Tente novamente.');
        }
    }

    viewPatient(patientId) {
        const patient = this.patients.find(p => p.id === patientId);
        if (!patient) return;

        this.currentPatient = patient;
        const view = this.getCurrentView();
        if (view === 'patients') {
            window.location.href = `paciente.html?id=${patient.id}`;
            return;
        }
        this.showPatientDetails(patient);
    }

    editPatient(patientId) {
        const patient = this.patients.find(p => p.id === patientId);
        if (!patient) return;

        this.showPatientForm(patient);
    }

    async showPatientDetails(patient) {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            this.showError('Supabase não configurado.');
            return;
        }

        const loadingModal = document.createElement('div');
        loadingModal.className = 'modal active';
        loadingModal.innerHTML = `
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Carregando...</h2>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray-600">Aguarde um momento.</p>
                </div>
            </div>
        `;
        document.body.appendChild(loadingModal);

        try {
            this.currentPatientDetails = await this.fetchPatientDetails(patient);
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            this.showError('Erro ao carregar detalhes do paciente.');
            loadingModal.remove();
            return;
        }

        loadingModal.remove();
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-5xl">
                <div class="modal-header">
                    <div>
                        <h2 class="text-xl font-bold text-gray-900">${patient.full_name}</h2>
                        <p class="text-sm text-gray-600">${this.calculateAge(patient.birth_date)} anos</p>
                    </div>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${this.renderPatientDetailsContent(patient)}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.applyDefaultTab(modal);
        this.ensureDefaultDates();
    }

    switchPatientTab(tabButton) {
        const tab = tabButton.getAttribute('data-tab');
        const root = tabButton.closest('.patient-details') || tabButton.closest('.modal');
        if (!root) return;

        root.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        root.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

        tabButton.classList.add('active');
        const panel = root.querySelector(`[data-panel="${tab}"]`);
        if (panel) panel.classList.add('active');
    }

    async loadPatientDetailPage() {
        const container = document.getElementById('patientDetailPage');
        if (!container) return;

        const params = new URLSearchParams(window.location.search);
        const patientId = params.get('id');
        if (!patientId) {
            container.innerHTML = '<div class="empty-state">Paciente nao encontrado.</div>';
            return;
        }

        const { supabase, user } = await this.getSupabaseAndUser();
        if (!supabase || !user) {
            container.innerHTML = '<div class="empty-state">Supabase nao configurado.</div>';
            return;
        }

        container.innerHTML = `
            <div class="section-card p-6">
                <div class="text-sm text-gray-600">Carregando paciente...</div>
            </div>
        `;

        const { data: patient, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error || !patient) {
            container.innerHTML = '<div class="empty-state">Paciente nao encontrado.</div>';
            return;
        }

        this.currentPatient = patient;
        try {
            this.currentPatientDetails = await this.fetchPatientDetails(patient);
        } catch (err) {
            console.error('Erro ao carregar detalhes:', err);
            container.innerHTML = '<div class="empty-state">Erro ao carregar detalhes do paciente.</div>';
            return;
        }

        container.innerHTML = `
            <div class="section-card p-6">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <a href="pacientes.html" class="text-sm text-gray-500 hover:text-gray-700">Voltar para pacientes</a>
                        <h1 class="text-2xl font-bold text-gray-900 mt-2">${patient.full_name}</h1>
                        <p class="text-sm text-gray-600">${this.calculateAge(patient.birth_date)} anos</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button class="btn btn-outline" onclick="window.patientsManager.editPatient('${patient.id}')">Editar</button>
                        <button class="btn btn-primary" onclick="window.patientsManager.openCurrentPatientModal()">Abrir detalhes</button>
                    </div>
                </div>
                <div class="patient-details">
                    ${this.renderPatientDetailsContent(patient)}
                </div>
            </div>
        `;

        this.applyDefaultTab(container);
        this.ensureDefaultDates();
    }

    async fetchPatientDetails(patient) {
        const { supabase, user } = await this.getSupabaseAndUser();
        if (!supabase || !user) {
            throw new Error('Supabase nao configurado.');
        }

        const [anamnesisRes, evolutionsRes, examsRes, appointmentsRes, interventionRes] = await Promise.all([
            supabase.from('anamnesis').select('*').eq('patient_id', patient.id).eq('user_id', user.id).maybeSingle(),
            supabase.from('evolutions').select('*').eq('patient_id', patient.id).eq('user_id', user.id).order('date', { ascending: false }),
            supabase.from('exams').select('*').eq('patient_id', patient.id).eq('user_id', user.id).order('uploaded_at', { ascending: false }),
            supabase.from('schedule').select('id,title,start_datetime,end_datetime,status,description').eq('patient_id', patient.id).eq('user_id', user.id).order('start_datetime', { ascending: false }),
            supabase.from('intervention_plans').select('*').eq('patient_id', patient.id).eq('user_id', user.id).order('created_at', { ascending: false })
        ]);

        if (anamnesisRes.error || evolutionsRes.error || examsRes.error || appointmentsRes.error || interventionRes.error) {
            throw new Error('Erro ao carregar detalhes do paciente');
        }

        return {
            anamnesis: anamnesisRes.data || null,
            evolutions: evolutionsRes.data || [],
            exams: examsRes.data || [],
            appointments: appointmentsRes.data || [],
            interventions: interventionRes.data || []
        };
    }

    renderPatientDetailsContent(patient) {
        return `
            <div class="patient-details">
                <div class="tabs mb-4">
                    <button class="tab-button active" data-tab="info">Dados</button>
                    <button class="tab-button" data-tab="anamnesis">Anamnese</button>
                    <button class="tab-button" data-tab="exams">Exames</button>
                    <button class="tab-button" data-tab="evolution">Evolucao</button>
                    <button class="tab-button" data-tab="appointments">Atendimentos</button>
                    <button class="tab-button" data-tab="intervention">Plano</button>
                </div>

                <div class="tab-panel active" data-panel="info">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 class="text-lg font-medium text-gray-900 mb-2">Contato</h3>
                            <p class="text-sm text-gray-700">Telefone: ${patient.phone || 'Nao informado'}</p>
                            <p class="text-sm text-gray-700">Email: ${patient.email || 'Nao informado'}</p>
                            <p class="text-sm text-gray-700">Bairro: ${patient.neighborhood || 'Nao informado'}</p>
                            <p class="text-sm text-gray-700">Cidade: ${patient.city || 'Nao informado'}</p>
                        </div>
                        <div>
                            <h3 class="text-lg font-medium text-gray-900 mb-2">Endereco</h3>
                            <p class="text-sm text-gray-700">${patient.address || 'Nao informado'}</p>
                            <p class="text-sm text-gray-700">CEP: ${patient.zip_code || 'Nao informado'}</p>
                            <p class="text-sm text-gray-700">Referencia: ${patient.reference_point || 'Nao informado'}</p>
                        </div>
                    </div>
                </div>

                <div class="tab-panel" data-panel="anamnesis">
                    <form id="anamnesisForm" class="space-y-4">
                        <input type="hidden" id="anamnesisPatientId" value="${patient.id}">
                        <div class="form-group">
                            <label class="form-label">Anamnese</label>
                            <textarea id="anamnesisText" rows="8" class="form-input"
                                      placeholder="Descreva a anamnese do paciente">${this.currentPatientDetails?.anamnesis?.content || ''}</textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Salvar Anamnese</button>
                    </form>
                </div>

                <div class="tab-panel" data-panel="exams">
                    <div class="space-y-4">
                        <div class="form-group">
                            <label class="form-label">Importar exame</label>
                            <input type="file" id="examFileInput" class="form-input" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" />
                            <input type="hidden" id="examPatientId" value="${patient.id}">
                        </div>
                        <p class="text-xs text-gray-500">Tipos aceitos: PDF, JPG, PNG, DOC. Tamanho maximo 10MB.</p>
                        <div id="examList">
                            ${this.renderExamList(this.currentPatientDetails?.exams || [])}
                        </div>
                    </div>
                </div>

                <div class="tab-panel" data-panel="evolution">
                    <div class="space-y-6">
                        <form id="evolutionForm" class="space-y-4">
                            <input type="hidden" id="evolutionPatientId" value="${patient.id}">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="form-group">
                                    <label class="form-label">Data</label>
                                    <input type="date" id="evolutionDate" required class="form-input">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Procedimentos</label>
                                    <input type="text" id="evolutionProcedures" required class="form-input"
                                           placeholder="Ex.: mobilizacao, alongamento...">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Resultados</label>
                                <textarea id="evolutionResults" rows="3" required class="form-input"
                                          placeholder="Descreva os resultados do atendimento"></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary">Adicionar Evolucao</button>
                        </form>

                        <div id="evolutionList">
                            ${this.renderEvolutionList(this.currentPatientDetails?.evolutions || [])}
                        </div>
                    </div>
                </div>

                <div class="tab-panel" data-panel="appointments">
                    <div class="space-y-6">
                        <form id="patientAppointmentForm" class="space-y-4">
                            <input type="hidden" id="appointmentPatientId" value="${patient.id}">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="form-group md:col-span-2">
                                    <label class="form-label">Titulo *</label>
                                    <input type="text" name="title" required class="form-input" placeholder="Ex.: Atendimento fisioterapia">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Data *</label>
                                    <input type="date" name="date" required class="form-input">
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
                            <button type="submit" class="btn btn-primary">Salvar atendimento</button>
                        </form>

                        <div id="patientAppointmentsList">
                            ${this.renderAppointmentList(this.currentPatientDetails?.appointments || [])}
                        </div>
                    </div>
                </div>

                <div class="tab-panel" data-panel="intervention">
                    <div class="space-y-6">
                        <form id="interventionForm" class="space-y-4">
                            <input type="hidden" id="interventionPatientId" value="${patient.id}">
                            <div class="form-group">
                                <label class="form-label">Objetivo principal *</label>
                                <input type="text" name="objective" required class="form-input" placeholder="Ex.: Reduzir dor lombar">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Metas</label>
                                <textarea name="goals" rows="3" class="form-input" placeholder="Metas clinicas e funcionais"></textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Procedimentos</label>
                                <textarea name="procedures" rows="3" class="form-input" placeholder="Condutas planejadas"></textarea>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="form-group">
                                    <label class="form-label">Frequencia</label>
                                    <input type="text" name="frequency" class="form-input" placeholder="Ex.: 2x por semana">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Inicio</label>
                                    <input type="date" name="start_date" class="form-input">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Observacoes</label>
                                <textarea name="notes" rows="3" class="form-input" placeholder="Observacoes gerais"></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary">Salvar plano</button>
                        </form>

                        <div id="interventionList">
                            ${this.renderInterventionList(this.currentPatientDetails?.interventions || [])}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    applyDefaultTab(scope) {
        const defaultTab = document.body?.dataset?.patientDefaultTab;
        if (!defaultTab) return;
        const tabBtn = scope.querySelector('[data-tab="' + defaultTab + '"]');
        if (tabBtn) {
            this.switchPatientTab(tabBtn);
        }
    }

    ensureDefaultDates() {
        const evolutionDate = document.getElementById('evolutionDate');
        if (evolutionDate && !evolutionDate.value) {
            const today = new Date().toISOString().split('T')[0];
            evolutionDate.value = today;
        }
        const appointmentDate = document.querySelector('#patientAppointmentForm [name="date"]');
        if (appointmentDate && !appointmentDate.value) {
            const today = new Date().toISOString().split('T')[0];
            appointmentDate.value = today;
        }
    }

    openCurrentPatientModal() {
        if (!this.currentPatient) return;
        this.showPatientDetails(this.currentPatient);
    }

    renderExamList(exams) {
        if (exams.length === 0) {
            return '<p class="text-sm text-gray-500">Nenhum exame enviado.</p>';
        }

        return exams.map((exam) => `
            <div class="file-row">
                <div>
                    <div class="text-sm font-medium text-gray-900">${exam.file_name}</div>
                    <div class="text-xs text-gray-500">${exam.file_type || 'arquivo'} . ${this.formatFileSize(exam.file_size || 0)} . ${exam.uploaded_at ? window.app.formatDate(exam.uploaded_at) : '-'}</div>
                </div>
                <button class="btn btn-outline btn-sm" data-download-exam="${exam.id}" data-patient-id="${exam.patient_id}">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `).join('');
    }

    renderEvolutionList(evolutions) {
        if (evolutions.length === 0) {
            return '<p class="text-sm text-gray-500">Nenhuma evolução registrada.</p>';
        }

        return evolutions.map((ev) => `
            <div class="card p-4 mb-3">
                <div class="text-sm text-gray-500">${window.app.formatDate(ev.date)}</div>
                <div class="text-sm font-medium text-gray-900">Procedimentos: ${ev.procedures}</div>
                <div class="text-sm text-gray-700 mt-1">Resultados: ${ev.results}</div>
            </div>
        `).join('');
    }

    renderAppointmentList(appointments) {
        if (!appointments.length) {
            return '<p class="text-sm text-gray-500">Nenhum atendimento registrado.</p>';
        }

        return appointments.map((apt) => {
            const date = apt.start_datetime ? new Date(apt.start_datetime) : null;
            const dateLabel = date ? date.toLocaleDateString('pt-BR') : '-';
            const timeLabel = date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="card p-4 mb-3">
                    <div class="text-sm text-gray-500">${dateLabel} ${timeLabel}</div>
                    <div class="text-sm font-medium text-gray-900">${apt.title || 'Atendimento'}</div>
                    <div class="text-xs text-gray-500 mt-1">${apt.status || 'scheduled'}</div>
                    ${apt.description ? `<div class="text-sm text-gray-700 mt-2">${apt.description}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    renderInterventionList(plans) {
        if (!plans.length) {
            return '<p class="text-sm text-gray-500">Nenhum plano cadastrado.</p>';
        }

        return plans.map((plan) => `
            <div class="card p-4 mb-3">
                <div class="text-sm text-gray-500">${plan.created_at ? window.app.formatDate(plan.created_at) : ''}</div>
                <div class="text-sm font-medium text-gray-900">${plan.objective || 'Plano de intervencao'}</div>
                ${plan.goals ? `<div class="text-sm text-gray-700 mt-1">Metas: ${plan.goals}</div>` : ''}
                ${plan.procedures ? `<div class="text-sm text-gray-700 mt-1">Procedimentos: ${plan.procedures}</div>` : ''}
                ${plan.frequency ? `<div class="text-sm text-gray-700 mt-1">Frequencia: ${plan.frequency}</div>` : ''}
                ${plan.notes ? `<div class="text-sm text-gray-700 mt-1">Observacoes: ${plan.notes}</div>` : ''}
            </div>
        `).join('');
    }

    async saveAnamnesis() {
        const patientId = document.getElementById('anamnesisPatientId').value;
        const text = document.getElementById('anamnesisText').value.trim();
        if (!text) {
            this.showError('Preencha a anamnese antes de salvar.');
            return;
        }

        try {
            const { supabase, user } = await this.getSupabaseAndUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            const { data, error } = await supabase
                .from('anamnesis')
                .upsert({
                    patient_id: patientId,
                    user_id: user.id,
                    content: text,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            this.currentPatientDetails.anamnesis = data;
            window.authManager.showSuccess('Anamnese salva com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar anamnese:', error);
            this.showError('Erro ao salvar anamnese.');
        }
    }

    async addExamFile(event) {
        const input = event.target;
        const file = input.files && input.files[0];
        if (!file) return;
        const maxBytes = MAX_EXAM_SIZE_MB * 1024 * 1024;
        if (file.size > maxBytes) {
            this.showError('Arquivo muito grande. Maximo 10MB.');
            input.value = '';
            return;
        }

        const patientId = document.getElementById('examPatientId').value;
        try {
            const { supabase, user } = await this.getSupabaseAndUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            const filePath = `${user.id}/${patientId}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase
                .storage
                .from(this.examsBucket)
                .upload(filePath, file, { upsert: false });
            if (uploadError) throw uploadError;

            const { data, error } = await supabase
                .from('exams')
                .insert([{
                    patient_id: patientId,
                    user_id: user.id,
                    file_name: file.name,
                    file_path: filePath,
                    file_type: file.type,
                    file_size: file.size
                }])
                .select()
                .single();

            if (error) throw error;

            this.currentPatientDetails.exams = this.currentPatientDetails.exams || [];
            this.currentPatientDetails.exams.unshift(data);
            const list = document.getElementById('examList');
            if (list) list.innerHTML = this.renderExamList(this.currentPatientDetails.exams);
            input.value = '';
            window.authManager.showSuccess('Exame importado com sucesso!');
        } catch (error) {
            console.error('Erro ao importar exame:', error);
            this.showError('Erro ao importar exame.');
        }
    }

    async downloadExam(patientId, examId) {
        try {
            const { supabase, user } = await this.getSupabaseAndUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            const { data: exam, error } = await supabase
                .from('exams')
                .select('*')
                .eq('id', examId)
                .eq('patient_id', patientId)
                .eq('user_id', user.id)
                .single();
            if (error) throw error;

            const { data: signed, error: signedError } = await supabase
                .storage
                .from(this.examsBucket)
                .createSignedUrl(exam.file_path, 60);
            if (signedError) throw signedError;

            const link = document.createElement('a');
            link.href = signed.signedUrl;
            link.download = exam.file_name;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Erro ao baixar exame:', error);
            this.showError('Erro ao baixar exame.');
        }
    }

    async addEvolution() {
        const patientId = document.getElementById('evolutionPatientId').value;
        const date = document.getElementById('evolutionDate').value;
        const procedures = document.getElementById('evolutionProcedures').value.trim();
        const results = document.getElementById('evolutionResults').value.trim();

        if (!date || !procedures || !results) {
            this.showError('Preencha todos os campos da evolução.');
            return;
        }

        try {
            const supabase = window.authManager?.supabase;
            const user = window.authManager?.getCurrentUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            const { data, error } = await supabase
                .from('evolutions')
                .insert([{
                    patient_id: patientId,
                    user_id: user.id,
                    date,
                    procedures,
                    results
                }])
                .select()
                .single();
            if (error) throw error;

            this.currentPatientDetails.evolutions = this.currentPatientDetails.evolutions || [];
            this.currentPatientDetails.evolutions.unshift(data);
            const list = document.getElementById('evolutionList');
            if (list) list.innerHTML = this.renderEvolutionList(this.currentPatientDetails.evolutions);

            document.getElementById('evolutionDate').value = '';
            document.getElementById('evolutionProcedures').value = '';
            document.getElementById('evolutionResults').value = '';
            window.authManager.showSuccess('Evolução adicionada com sucesso!');
        } catch (error) {
            console.error('Erro ao adicionar evolução:', error);
            this.showError('Erro ao adicionar evolução.');
        }
    }

    async addPatientAppointment() {
        const form = document.getElementById('patientAppointmentForm');
        if (!form) return;

        const { supabase, user } = await this.getSupabaseAndUser();
        if (!supabase || !user) {
            this.showError('Supabase nao configurado.');
            return;
        }

        const data = Object.fromEntries(new FormData(form));
        const patientId = document.getElementById('appointmentPatientId')?.value;
        if (!patientId || !this.currentPatient) {
            this.showError('Paciente nao encontrado.');
            return;
        }

        const startDateTime = new Date(`${data.date}T${data.start_time}:00`);
        const endDateTime = new Date(`${data.date}T${data.end_time}:00`);

        const payload = {
            title: data.title,
            patient_name: this.currentPatient.full_name,
            patient_id: patientId,
            start_datetime: startDateTime.toISOString(),
            end_datetime: endDateTime.toISOString(),
            status: data.status,
            description: data.description || '',
            color: '#3b82f6'
        };

        try {
            const { data: inserted, error } = await supabase
                .from('schedule')
                .insert([{ ...payload, user_id: user.id }])
                .select()
                .single();
            if (error) throw error;

            this.currentPatientDetails.appointments = this.currentPatientDetails.appointments || [];
            this.currentPatientDetails.appointments.unshift(inserted);
            const list = document.getElementById('patientAppointmentsList');
            if (list) list.innerHTML = this.renderAppointmentList(this.currentPatientDetails.appointments);

            form.reset();
            this.ensureDefaultDates();
            window.authManager?.showSuccess('Atendimento salvo.');
        } catch (error) {
            console.error('Erro ao salvar atendimento:', error);
            this.showError('Erro ao salvar atendimento.');
        }
    }

    async saveInterventionPlan() {
        const form = document.getElementById('interventionForm');
        if (!form) return;

        const { supabase, user } = await this.getSupabaseAndUser();
        if (!supabase || !user) {
            this.showError('Supabase nao configurado.');
            return;
        }

        const data = Object.fromEntries(new FormData(form));
        const patientId = document.getElementById('interventionPatientId')?.value;
        if (!patientId) {
            this.showError('Paciente nao encontrado.');
            return;
        }

        try {
            const { data: inserted, error } = await supabase
                .from('intervention_plans')
                .insert([{
                    user_id: user.id,
                    patient_id: patientId,
                    objective: data.objective,
                    goals: data.goals || '',
                    procedures: data.procedures || '',
                    frequency: data.frequency || '',
                    start_date: data.start_date || null,
                    notes: data.notes || ''
                }])
                .select()
                .single();
            if (error) throw error;

            this.currentPatientDetails.interventions = this.currentPatientDetails.interventions || [];
            this.currentPatientDetails.interventions.unshift(inserted);
            const list = document.getElementById('interventionList');
            if (list) list.innerHTML = this.renderInterventionList(this.currentPatientDetails.interventions);

            form.reset();
            window.authManager?.showSuccess('Plano salvo.');
        } catch (error) {
            console.error('Erro ao salvar plano:', error);
            this.showError('Erro ao salvar plano.');
        }
    }

    confirmDeletePatient(patientId) {
        const patient = this.patients.find(p => p.id === patientId);
        if (!patient) return;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Excluir Paciente</h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="deletePatientForm" class="modal-body space-y-4">
                    <input type="hidden" id="deletePatientId" value="${patient.id}">
                    <p class="text-sm text-gray-700">
                        Para confirmar, digite o nome completo do paciente:
                        <strong>${patient.full_name}</strong>
                    </p>
                    <input type="text" id="deletePatientName" class="form-input" placeholder="Nome completo">
                </form>
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').classList.remove('active')" 
                            class="btn btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" form="deletePatientForm" class="btn btn-danger">
                        Excluir
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const evolutionDate = document.getElementById('evolutionDate');
        if (evolutionDate && !evolutionDate.value) {
            const today = new Date().toISOString().split('T')[0];
            evolutionDate.value = today;
        }
    }

    async deletePatient() {
        const patientId = document.getElementById('deletePatientId').value;
        const nameInput = document.getElementById('deletePatientName').value.trim();

        try {
            const supabase = window.authManager?.supabase;
            const user = window.authManager?.getCurrentUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            const { data: patient, error } = await supabase
                .from('patients')
                .select('*')
                .eq('id', patientId)
                .eq('user_id', user.id)
                .single();
            if (error) throw error;

            if (nameInput !== patient.full_name) {
                this.showError('O nome digitado não confere.');
                return;
            }

            const now = new Date().toISOString();
            const { data: upcoming, error: upcomingError } = await supabase
                .from('schedule')
                .select('id')
                .eq('user_id', user.id)
                .eq('patient_id', patient.id)
                .gte('start_datetime', now);
            if (upcomingError) throw upcomingError;
            const hasUpcoming = (upcoming || []).length > 0;

            if (hasUpcoming) {
                this.showError('Esse paciente tem compromissos futuros. Remova-os antes de excluir.');
                return;
            }

            const { error: deleteError } = await supabase
                .from('patients')
                .delete()
                .eq('id', patientId)
                .eq('user_id', user.id);
            if (deleteError) throw deleteError;
            this.loadPatients();
            if (window.scheduleManager && window.scheduleManager.loadPatientsCache) {
                window.scheduleManager.loadPatientsCache();
            }
            document.querySelector('.modal.active').remove();
            window.authManager.showSuccess('Paciente excluído com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir paciente:', error);
            this.showError('Erro ao excluir paciente.');
        }
    }

    searchPatients(query) {
        if (!query) {
            this.renderPatients();
            return;
        }

        const filtered = this.patients.filter(patient => 
            patient.full_name.toLowerCase().includes(query.toLowerCase()) ||
            patient.phone?.includes(query) ||
            patient.neighborhood?.toLowerCase().includes(query.toLowerCase())
        );

        // Re-renderizar com pacientes filtrados
        const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
        if (container) {
            container.innerHTML = filtered.map(patient => this.renderPatientCard(patient)).join('');
        }
    }

    calculateAge(birthDate) {
        if (!birthDate) return 'N/A';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    showError(message) {
        window.authManager.showError(message);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    }

    showImportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">Importar pacientes (XLSX)</h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="text-sm text-gray-600">
                        Importe todos os campos do paciente a partir de uma planilha XLSX.
                        Use o modelo de importacao para garantir as colunas corretas.
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button id="downloadImportTemplate" class="btn btn-outline">
                            <i class="fas fa-download mr-2"></i>Baixar modelo
                        </button>
                        <label class="btn btn-primary cursor-pointer">
                            <input type="file" id="importPatientsFile" class="hidden" accept=".xlsx,.xls">
                            <i class="fas fa-upload mr-2"></i>Selecionar arquivo
                        </label>
                    </div>
                    <div class="text-xs text-gray-500">
                        Dica: voce pode abrir o modelo no Excel, preencher e salvar como XLSX.
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    downloadImportTemplate() {
        window.location.href = 'templates/modelo_importacao_pacientes.csv';
    }

    async handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!window.XLSX) {
            this.showError('Biblioteca XLSX nao encontrada. Adicione o arquivo vendor/xlsx/xlsx.full.min.js.');
            return;
        }
        try {
            const data = await file.arrayBuffer();
            const workbook = window.XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (!rows.length) {
                this.showError('A planilha esta vazia.');
                return;
            }
            await this.importPatientsRows(rows);
        } catch (error) {
            console.error('Erro ao importar:', error);
            this.showError('Erro ao importar planilha. Verifique o formato.');
        } finally {
            event.target.value = '';
        }
    }

    normalizeHeader(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    mapRowToPatient(row) {
        const normalized = {};
        Object.keys(row).forEach(key => {
            normalized[this.normalizeHeader(key)] = row[key];
        });

        const map = {
            nome: 'full_name',
            nomecompleto: 'full_name',
            fullname: 'full_name',
            datanascimento: 'birth_date',
            nascimento: 'birth_date',
            datadenascimento: 'birth_date',
            sexo: 'gender',
            genero: 'gender',
            telefone: 'phone',
            telefoneprincipal: 'phone',
            telefone2: 'phone_secondary',
            telefonesecundario: 'phone_secondary',
            email: 'email',
            endereco: 'address',
            bairro: 'neighborhood',
            cidade: 'city',
            estado: 'state',
            cep: 'zip_code',
            referencia: 'reference_point',
            cpf: 'cpf',
            alergias: 'allergies',
            medicacoes: 'medications',
            observacoes: 'general_notes'
        };

        const patient = {};
        Object.keys(map).forEach(key => {
            if (normalized[key] !== undefined) {
                patient[map[key]] = normalized[key];
            }
        });

        return patient;
    }

    async importPatientsRows(rows) {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            this.showError('Supabase nao configurado.');
            return;
        }

        const mapped = rows.map(row => this.mapRowToPatient(row));
        const requiredFields = ['full_name', 'birth_date', 'gender', 'phone', 'address', 'neighborhood', 'city', 'state'];
        const validPatients = [];
        const invalidRows = [];

        mapped.forEach((patient, index) => {
            const missing = requiredFields.filter(field => !patient[field]);
            if (missing.length) {
                invalidRows.push({ index: index + 2, missing });
                return;
            }
            validPatients.push({
                ...patient,
                user_id: user.id,
                is_active: true
            });
        });

        if (!validPatients.length) {
            this.showError('Nenhum paciente valido encontrado para importar.');
            return;
        }

        const planLimit = window.authManager.getPlanPatientLimit();
        const availableSlots = Math.max(planLimit - this.patients.length, 0);
        if (availableSlots === 0) {
            window.authManager.showUpgradeModal();
            return;
        }

        const toInsert = validPatients.slice(0, availableSlots);
        if (validPatients.length > availableSlots) {
            window.authManager.showError('Seu plano permite importar apenas ate o limite atual de pacientes.');
        }

        const { error } = await supabase.from('patients').insert(toInsert);
        if (error) {
            console.error('Erro ao importar pacientes:', error);
            this.showError('Erro ao importar pacientes. Verifique os dados.');
            return;
        }

        if (invalidRows.length) {
            console.warn('Linhas invalidas:', invalidRows);
        }

        window.authManager.showSuccess(`Importacao concluida: ${toInsert.length} pacientes adicionados.`);
        this.loadPatients();
        document.querySelector('.modal.active')?.remove();
    }
}

// Inicializar gerenciador de pacientes
document.addEventListener('DOMContentLoaded', () => {
    window.patientsManager = new PatientsManager();
});


















