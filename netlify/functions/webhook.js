const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        
        const orderId = data.client_reference_id || data.order_id;
        const paymentStatus = data.status;
        const txnId = data.transaction_id || data.payment_id;

        if (paymentStatus === 'SUCCESS' || paymentStatus === 'success') {
            await supabase
                .from('orders')
                .update({ status: 'SUCCESS', paytm_txn_id: txnId, telegram_link: 'Generated_Link_Here' })
                .match({ order_id: orderId });
        }

        return { statusCode: 200, body: JSON.stringify({ received: true }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};