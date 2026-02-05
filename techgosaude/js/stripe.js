// Stripe checkout helper (Cloudflare Worker or other backend)
window.startStripeCheckout = async function startStripeCheckout() {
    const config = window.stripeConfig || {};
    if (!config.priceId) {
        window.authManager?.showError('Price ID do Stripe nao configurado.');
        return;
    }
    if (!config.checkoutBaseUrl) {
        window.authManager?.showError('URL do backend de pagamento nao configurada.');
        return;
    }

    const supabase = window.authManager?.supabase;
    if (!supabase) {
        window.authManager?.showError('Supabase nao configurado.');
        return;
    }

    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (!accessToken) {
        window.authManager?.showError('Sessao expirada. Faça login novamente.');
        return;
    }

    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const successUrl = `${window.location.origin}${basePath}dashboard.html?checkout=success#dashboard`;
    const cancelUrl = `${window.location.origin}${basePath}dashboard.html?checkout=cancel#dashboard`;

    const res = await fetch(`${config.checkoutBaseUrl}/create-checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            priceId: config.priceId,
            successUrl,
            cancelUrl
        })
    });

    if (!res.ok) {
        const text = await res.text();
        window.authManager?.showError('Erro ao iniciar pagamento.');
        console.error('Stripe checkout error:', text);
        return;
    }

    const payload = await res.json();
    if (payload?.url) {
        window.location.href = payload.url;
    } else {
        window.authManager?.showError('URL de checkout nao recebida.');
    }
};

