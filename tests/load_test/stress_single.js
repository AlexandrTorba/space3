const WebSocket = require('ws');
const protobuf = require('protobufjs');
const path = require('path');

const NUM_USERS = 100;
const MATCH_ID = 'stress_single_do';
const WS_BASE_URL = 'wss://antigravity-edge-backend.achitora.workers.dev/bughouse/';

async function run() {
    const root = await protobuf.load(path.join(__dirname, 'chess.proto'));

    let connected = 0;
    let errors = 0;
    let closed = 0;
    let messagesReceived = 0;

    console.log(`🚀 Starting single-DO stress test with ${NUM_USERS} users in match "${MATCH_ID}"...`);

    const clients = [];

    for (let i = 0; i < NUM_USERS; i++) {
        const url = WS_BASE_URL + MATCH_ID;
        const ws = new WebSocket(url);
        clients.push(ws);

        ws.on('open', () => { connected++; });
        ws.on('message', () => { messagesReceived++; });
        ws.on('error', (err) => { errors++; });
        ws.on('close', () => { closed++; });

        if (i % 10 === 0) await new Promise(r => setTimeout(r, 20));
    }

    const start = Date.now();
    const interval = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        process.stdout.write(`\r[${elapsed.toFixed(1)}s] Connected: ${connected} | Errors: ${errors} | Closed: ${closed} | Total Msg: ${messagesReceived}    `);
        
        if ((connected + errors + closed >= NUM_USERS) && elapsed > 20) {
            clearInterval(interval);
            console.log('\n--- STRESS TEST RESULTS ---');
            console.log(`✅ SUCCESS: ${(connected / NUM_USERS * 100).toFixed(1)}%`);
            console.log(`💬 TOTAL MESSAGES: ${messagesReceived}`);
            process.exit(0);
        }
    }, 1000);
}

run().catch(console.error);
