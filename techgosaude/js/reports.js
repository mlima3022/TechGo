// Relatorios CSV
(function () {
    const exportButton = document.getElementById('exportReportsCsv');
    if (!exportButton) return;

    exportButton.addEventListener('click', async () => {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            window.authManager?.showError('Supabase nao configurado.');
            return;
        }

        try {
            const [scheduleRes, financialRes] = await Promise.all([
                supabase.from('schedule')
                    .select('title,patient_name,start_datetime,end_datetime,status,description')
                    .eq('user_id', user.id)
                    .order('start_datetime', { ascending: true }),
                supabase.from('financial')
                    .select('description,category,transaction_type,amount,transaction_date,payment_status')
                    .eq('user_id', user.id)
                    .order('transaction_date', { ascending: true })
            ]);

            if (scheduleRes.error || financialRes.error) {
                throw scheduleRes.error || financialRes.error;
            }

            const lines = [];
            lines.push('Relatorio de Atendimentos');
            lines.push('titulo,paciente,inicio,fim,status,descricao');
            (scheduleRes.data || []).forEach(item => {
                lines.push([
                    escapeCsv(item.title),
                    escapeCsv(item.patient_name || ''),
                    escapeCsv(item.start_datetime || ''),
                    escapeCsv(item.end_datetime || ''),
                    escapeCsv(item.status || ''),
                    escapeCsv(item.description || '')
                ].join(','));
            });

            lines.push('');
            lines.push('Relatorio Financeiro');
            lines.push('descricao,categoria,tipo,valor,data,status');
            (financialRes.data || []).forEach(item => {
                lines.push([
                    escapeCsv(item.description),
                    escapeCsv(item.category),
                    escapeCsv(item.transaction_type),
                    escapeCsv(item.amount),
                    escapeCsv(item.transaction_date),
                    escapeCsv(item.payment_status)
                ].join(','));
            });

            const csv = lines.join('\n');
            downloadCsv(csv, 'relatorios_techgosaude.csv');
            window.authManager?.showSuccess('Relatorio CSV gerado.');
        } catch (error) {
            console.error('Erro ao gerar CSV:', error);
            window.authManager?.showError('Erro ao gerar CSV.');
        }
    });

    function escapeCsv(value) {
        const text = value === null || value === undefined ? '' : String(value);
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return '"' + text.replace(/"/g, '""') + '"';
        }
        return text;
    }

    function downloadCsv(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }
})();
