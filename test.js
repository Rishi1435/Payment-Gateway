async function runTests() {
    try {
        console.log('1. Testing /health...');
        const health = await fetch('http://localhost:8000/health').then(r => r.json());
        console.log(health);

        console.log('\n2. Testing Test Merchant Seed...');
        const merchantRes = await fetch('http://localhost:8000/api/v1/test/merchant').then(r => r.json());
        console.log('Test merchant:', merchantRes);

        console.log('\n3. Creating Order...');
        const orderRes = await fetch('http://localhost:8000/api/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': merchantRes.api_key,
                'X-Api-Secret': 'secret_test_xyz789'
            },
            body: JSON.stringify({ amount: 15000, currency: 'INR', receipt: 'test_rcpt' })
        }).then(r => r.json());
        console.log('Created order:', orderRes);

        console.log('\n4. Creating Payment...');
        const payRes = await fetch('http://localhost:8000/api/v1/payments/public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderRes.id, method: 'upi', vpa: 'test@okbank' })
        }).then(r => r.json());
        console.log('Created payment:', payRes);

        console.log('\n5. Waiting for 6 seconds to check state update...');
        await new Promise(r => setTimeout(r, 6000));

        const statusRes = await fetch(`http://localhost:8000/api/v1/payments/${payRes.id}`, {
            headers: {
                'X-Api-Key': merchantRes.api_key,
                'X-Api-Secret': 'secret_test_xyz789'
            }
        }).then(r => r.json());
        console.log('Payment status after delay:', statusRes);

        console.log('\n6. Checking Authentication Error Format...');
        const authFail = await fetch('http://localhost:8000/api/v1/orders/invalid', {
            headers: { 'X-Api-Key': 'wrong', 'X-Api-Secret': 'wrong' }
        });
        console.log('Auth request status:', authFail.status);
        console.log('Auth error format:', await authFail.json());

    } catch (err) {
        console.error('API Error:', err);
    }
}

runTests();
