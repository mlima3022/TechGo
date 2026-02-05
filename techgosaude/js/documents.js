// Documentos
class DocumentsManager {
    constructor() {
        this.bucket = 'documents';
        this.documents = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadDocuments();
    }

    bindEvents() {
        document.addEventListener('change', (e) => {
            if (e.target.id === 'documentFileInput') {
                this.uploadDocument(e.target.files[0]);
            }
        });
    }

    async loadDocuments() {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        const container = document.getElementById('documentsList');
        if (!container) return;
        if (!supabase || !user) {
            container.innerHTML = '<div class="empty-state">Supabase nao configurado.</div>';
            return;
        }

        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar documentos:', error);
            container.innerHTML = '<div class="empty-state">Erro ao carregar documentos.</div>';
            return;
        }

        this.documents = data || [];
        if (!this.documents.length) {
            container.innerHTML = '<div class="empty-state">Nenhum arquivo enviado ainda.</div>';
            return;
        }

        container.innerHTML = this.documents.map(doc => {
            return `
                <div class="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                    <div>
                        <p class="text-sm font-medium text-gray-900">${doc.file_name}</p>
                        <p class="text-xs text-gray-500">${doc.file_type || 'Arquivo'} • ${this.formatFileSize(doc.file_size || 0)}</p>
                    </div>
                    <button class="btn btn-outline btn-sm" data-download-document="${doc.id}">Baixar</button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('[data-download-document]').forEach(btn => {
            btn.addEventListener('click', () => this.downloadDocument(btn.dataset.downloadDocument));
        });
    }

    async uploadDocument(file) {
        if (!file) return;
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            window.authManager?.showError('Supabase nao configurado.');
            return;
        }

        try {
            const filePath = `${user.id}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from(this.bucket)
                .upload(filePath, file, { upsert: false });

            if (uploadError) throw uploadError;

            const { error: insertError } = await supabase
                .from('documents')
                .insert([{
                    user_id: user.id,
                    file_name: file.name,
                    file_path: filePath,
                    file_type: file.type,
                    file_size: file.size
                }]);

            if (insertError) throw insertError;

            window.authManager?.showSuccess('Documento enviado com sucesso!');
            this.loadDocuments();
        } catch (error) {
            console.error('Erro ao enviar documento:', error);
            window.authManager?.showError('Erro ao enviar documento.');
        }
    }

    async downloadDocument(documentId) {
        const supabase = window.authManager?.supabase;
        const user = window.authManager?.getCurrentUser();
        if (!supabase || !user) {
            window.authManager?.showError('Supabase nao configurado.');
            return;
        }

        const doc = this.documents.find(d => d.id === documentId);
        if (!doc) return;

        const { data, error } = await supabase.storage.from(this.bucket).download(doc.file_path);
        if (error) {
            console.error('Erro ao baixar documento:', error);
            window.authManager?.showError('Erro ao baixar documento.');
            return;
        }

        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.file_name;
        link.click();
        URL.revokeObjectURL(url);
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('documentsList')) {
        window.documentsManager = new DocumentsManager();
    }
});
