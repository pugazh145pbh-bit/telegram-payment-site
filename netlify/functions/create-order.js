const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const data = JSON.parse(event.body);
        const amount = data.amount || 100;
        const order_id = 'ORD_' + Date.now();

        const { error: dbError } = await supabase
            .from('orders')
            .insert([{ order_id: order_id, amount: amount, status: 'PENDING' }]);

        if (dbError) {
            console.error('Supabase Error:', dbError);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, order_id, qr_code: "SAMPLE_QR_OR_LINK" })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};