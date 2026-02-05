// Gerenciador financeiro
class FinanceManager {
    constructor() {
        this.transactions = [];
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.currentTransaction = null;
        this.incomeExpenseChart = null;
        this.monthlyChart = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFinance();
    }

    bindEvents() {
        // Botão de adicionar transação
        document.addEventListener('click', (e) => {
            if (e.target.closest('#addTransactionBtn')) {
                this.showTransactionForm();
            }
        });

        // Formulário de transação
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'transactionForm') {
                e.preventDefault();
                this.saveTransaction();
            }
        });

        // Filtros
        document.addEventListener('change', (e) => {
            if (e.target.closest('#monthFilter') || e.target.closest('#yearFilter')) {
                this.currentMonth = parseInt(document.getElementById('monthFilter').value);
                this.currentYear = parseInt(document.getElementById('yearFilter').value);
                this.loadFinance();
            }
        });

        // Exportar relatórios
        document.addEventListener('click', (e) => {
            if (e.target.closest('#exportPdfBtn')) {
                this.exportReport('pdf');
            } else if (e.target.closest('#exportExcelBtn')) {
                this.exportReport('excel');
            }
        });
    }

    async loadFinance() {
        try {
            const supabase = window.authManager?.supabase;
            const user = window.authManager?.getCurrentUser();
            if (!supabase || !user) {
                this.transactions = [];
                this.renderFinance();
                return;
            }

            const start = new Date(this.currentYear, this.currentMonth, 1);
            const end = new Date(this.currentYear, this.currentMonth + 1, 0);

            const { data, error } = await supabase
                .from('financial')
                .select('*')
                .eq('user_id', user.id)
                .gte('transaction_date', start.toISOString().split('T')[0])
                .lte('transaction_date', end.toISOString().split('T')[0])
                .order('transaction_date', { ascending: false });
            if (error) throw error;
            this.transactions = data || [];
            this.renderFinance();
        } catch (error) {
            console.error('Erro ao carregar dados financeiros:', error);
            this.showError('Erro ao carregar dados financeiros');
        }
    }

    renderFinance() {
        const container = document.getElementById('finance');
        if (!container) return;

        const stats = this.calculateStats();

        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="mb-8">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div class="mb-4 sm:mb-0">
                            <h1 class="text-3xl font-bold text-gray-900">Financeiro</h1>
                            <p class="text-gray-600 mt-1">Controle financeiro da clínica</p>
                        </div>
                        <div class="flex items-center space-x-4">
                            <select id="monthFilter" class="form-select">
                                ${this.renderMonthOptions()}
                            </select>
                            <select id="yearFilter" class="form-select">
                                ${this.renderYearOptions()}
                            </select>
                            <button id="addTransactionBtn" class="btn btn-primary">
                                <i class="fas fa-plus mr-2"></i>Nova Transação
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Cards de estatísticas -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-arrow-up text-success-600"></i>
                                </div>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm font-medium text-gray-500">Receitas do Mês</p>
                                <p class="text-2xl font-bold text-gray-900">${window.app.formatCurrency(stats.income)}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-arrow-down text-danger-600"></i>
                                </div>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm font-medium text-gray-500">Despesas do Mês</p>
                                <p class="text-2xl font-bold text-gray-900">${window.app.formatCurrency(stats.expenses)}</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-chart-line text-primary-600"></i>
                                </div>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm font-medium text-gray-500">Saldo do Mês</p>
                                <p class="text-2xl font-bold ${stats.balance >= 0 ? 'text-success-600' : 'text-danger-600'}">
                                    ${window.app.formatCurrency(stats.balance)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-clock text-warning-600"></i>
                                </div>
                            </div>
                            <div class="ml-4">
                                <p class="text-sm font-medium text-gray-500">Pendente</p>
                                <p class="text-2xl font-bold text-gray-900">${window.app.formatCurrency(stats.pending)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Gráficos -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6 chart-card">
                        <h3 class="text-lg font-medium text-gray-900 mb-4">Receitas vs Despesas</h3>
                        <div class="chart-container">
                            <canvas id="incomeExpenseChart"></canvas>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6 chart-card">
                        <h3 class="text-lg font-medium text-gray-900 mb-4">Evolução Mensal</h3>
                        <div class="chart-container">
                            <canvas id="monthlyChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Lista de transações -->
                <div class="bg-white rounded-lg shadow">
                    <div class="p-6 border-b border-gray-200">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-medium text-gray-900">Transações do Mês</h3>
                            <div class="flex items-center space-x-2">
                                <button id="exportPdfBtn" class="btn btn-outline btn-sm">
                                    <i class="fas fa-file-pdf mr-1"></i>PDF
                                </button>
                                <button id="exportExcelBtn" class="btn btn-outline btn-sm">
                                    <i class="fas fa-file-excel mr-1"></i>Excel
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${this.transactions.map(transaction => this.renderTransactionRow(transaction)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.loadCharts();
    }

    renderTransactionRow(transaction) {
        const statusBadge = this.getStatusBadge(transaction.payment_status);
        const typeColor = transaction.transaction_type === 'income' ? 'text-success-600' : 'text-danger-600';
        const typeIcon = transaction.transaction_type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down';

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${window.app.formatDate(transaction.transaction_date)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${transaction.description}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    ${this.getCategoryLabel(transaction.category)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${typeColor}">
                    <i class="fas ${typeIcon} mr-1"></i>
                    ${window.app.formatCurrency(transaction.amount)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button onclick="window.financeManager.editTransaction('${transaction.id}')" 
                            class="btn btn-outline btn-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    renderMonthOptions() {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        return months.map((month, index) => 
            `<option value="${index}" ${index === this.currentMonth ? 'selected' : ''}>${month}</option>`
        ).join('');
    }

    renderYearOptions() {
        const currentYear = new Date().getFullYear();
        let options = '';
        
        for (let year = currentYear - 2; year <= currentYear + 2; year++) {
            options += `<option value="${year}" ${year === this.currentYear ? 'selected' : ''}>${year}</option>`;
        }
        
        return options;
    }

    calculateStats() {
        const income = this.transactions
            .filter(t => t.transaction_type === 'income')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const expenses = this.transactions
            .filter(t => t.transaction_type === 'expense')
            .reduce((sum, t) => sum + (t.amount || 0), 0);

        const pending = this.transactions
            .filter(t => t.payment_status === 'pending' || t.payment_status === 'partial')
            .reduce((sum, t) => sum + (t.pending_amount || t.amount || 0), 0);

        return {
            income,
            expenses,
            balance: income - expenses,
            pending
        };
    }

    loadCharts() {
        this.loadIncomeExpenseChart();
        this.loadMonthlyChart();
    }

    loadIncomeExpenseChart() {
        const ctx = document.getElementById('incomeExpenseChart');
        if (!ctx) return;

        const data = {
            labels: ['Receitas', 'Despesas'],
            datasets: [{
                data: [this.calculateStats().income, this.calculateStats().expenses],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        };

        if (this.incomeExpenseChart) {
            this.incomeExpenseChart.destroy();
        }
        this.incomeExpenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: options
        });
    }

    loadMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;

        // Dados mockados - implementar com dados reais do backend
        const data = {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
                label: 'Receitas',
                data: [2500, 3200, 2800, 4100, 3800, 4500],
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: '#10b981',
                borderWidth: 2
            }, {
                label: 'Despesas',
                data: [1200, 1500, 1300, 1800, 1600, 1900],
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderColor: '#ef4444',
                borderWidth: 2
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        };

        if (this.monthlyChart) {
            this.monthlyChart.destroy();
        }
        this.monthlyChart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: options
        });
    }

    showTransactionForm(transaction = null) {
        this.currentTransaction = transaction || null;
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content max-w-3xl">
                <div class="modal-header">
                    <h2 class="text-xl font-bold text-gray-900">
                        ${transaction ? 'Editar Transação' : 'Nova Transação'}
                    </h2>
                    <button onclick="this.closest('.modal').classList.remove('active')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="transactionForm" class="modal-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="form-group md:col-span-2">
                            <label class="form-label">Descrição *</label>
                            <input type="text" name="description" required 
                                   value="${transaction?.description || ''}" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tipo *</label>
                            <select name="transaction_type" required class="form-select">
                                <option value="income" ${transaction?.transaction_type === 'income' ? 'selected' : ''}>Receita</option>
                                <option value="expense" ${transaction?.transaction_type === 'expense' ? 'selected' : ''}>Despesa</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Categoria *</label>
                            <select name="category" required class="form-select">
                                <option value="consultation" ${transaction?.category === 'consultation' ? 'selected' : ''}>Consulta</option>
                                <option value="treatment" ${transaction?.category === 'treatment' ? 'selected' : ''}>Tratamento</option>
                                <option value="travel" ${transaction?.category === 'travel' ? 'selected' : ''}>Deslocamento</option>
                                <option value="materials" ${transaction?.category === 'materials' ? 'selected' : ''}>Materiais</option>
                                <option value="equipment" ${transaction?.category === 'equipment' ? 'selected' : ''}>Equipamentos</option>
                                <option value="other" ${transaction?.category === 'other' ? 'selected' : ''}>Outros</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Valor (R$) *</label>
                            <input type="number" name="amount" required step="0.01" min="0"
                                   value="${transaction?.amount ?? ''}" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Data *</label>
                            <input type="date" name="transaction_date" required 
                                   value="${transaction?.transaction_date ? new Date(transaction.transaction_date).toISOString().split('T')[0] : ''}" 
                                   class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status *</label>
                            <select name="payment_status" required class="form-select">
                                <option value="paid" ${transaction?.payment_status === 'paid' ? 'selected' : ''}>Pago</option>
                                <option value="pending" ${transaction?.payment_status === 'pending' ? 'selected' : ''}>Pendente</option>
                                <option value="partial" ${transaction?.payment_status === 'partial' ? 'selected' : ''}>Parcial</option>
                                <option value="cancelled" ${transaction?.payment_status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                                <option value="overdue" ${transaction?.payment_status === 'overdue' ? 'selected' : ''}>Vencido</option>
                            </select>
                        </div>
                    </div>
                </form>
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').classList.remove('active')" 
                            class="btn btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" form="transactionForm" class="btn btn-primary">
                        ${transaction ? 'Atualizar' : 'Salvar'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async saveTransaction() {
        const formData = new FormData(document.getElementById('transactionForm'));
        const data = Object.fromEntries(formData);

        const payload = {
            description: data.description,
            category: data.category,
            transaction_type: data.transaction_type,
            amount: parseFloat(data.amount),
            transaction_date: new Date(data.transaction_date).toISOString().split('T')[0],
            payment_status: data.payment_status
        };

        try {
            const supabase = window.authManager?.supabase;
            const user = window.authManager?.getCurrentUser();
            if (!supabase || !user) {
                this.showError('Supabase não configurado.');
                return;
            }

            if (this.currentTransaction) {
                const { error } = await supabase
                    .from('financial')
                    .update(payload)
                    .eq('id', this.currentTransaction.id)
                    .eq('user_id', user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('financial')
                    .insert([{
                        ...payload,
                        user_id: user.id
                    }]);
                if (error) throw error;
            }

            window.authManager.showSuccess(
                this.currentTransaction ? 'Transação atualizada com sucesso!' : 'Transação criada com sucesso!'
            );
            this.currentTransaction = null;
            this.loadFinance();
            document.querySelector('.modal.active').remove();
        } catch (error) {
            console.error('Erro ao salvar transação:', error);
            this.showError('Erro ao salvar transação. Tente novamente.');
        }
    }

    editTransaction(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (transaction) {
            this.currentTransaction = transaction;
            this.showTransactionForm(transaction);
        }
    }

    getStatusBadge(status) {
        const badges = {
            pending: '<span class="badge badge-warning">Pendente</span>',
            paid: '<span class="badge badge-success">Pago</span>',
            partial: '<span class="badge badge-warning">Parcial</span>',
            cancelled: '<span class="badge badge-danger">Cancelado</span>',
            overdue: '<span class="badge badge-danger">Vencido</span>'
        };
        return badges[status] || '<span class="badge badge-secondary">Desconhecido</span>';
    }

    getCategoryLabel(category) {
        const labels = {
            consultation: 'Consulta',
            treatment: 'Tratamento',
            travel: 'Deslocamento',
            materials: 'Materiais',
            equipment: 'Equipamentos',
            other: 'Outros'
        };
        return labels[category] || category;
    }

    exportReport(format) {
        // Implementar exportação de relatórios
        console.log('Exportar relatório:', format);
    }

    showError(message) {
        window.authManager.showError(message);
    }
}

// Inicializar gerenciador financeiro
document.addEventListener('DOMContentLoaded', () => {
    window.financeManager = new FinanceManager();
});

