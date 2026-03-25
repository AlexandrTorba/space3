const WebSocket = require('ws');
const protobuf = require('protobufjs');
const path = require('path');

const NUM_USERS = 100;
const MATCH_PREFIX = 'loadtest_';
const WS_BASE_URL = 'wss://antigravity-edge-backend.achitora.workers.dev/bughouse/';

async function run() {
    const root = await protobuf.load(path.join(__dirname, 'chess.proto'));
    const BughouseStatus = root.lookupType('BughouseStatus');

    let connected = 0;
    let errors = 0;
    let closed = 0;
    let messagesReceived = 0;

    console.log(`🚀 Starting load test with ${NUM_USERS} users...`);

    const clients = [];

    for (let i = 0; i < NUM_USERS; i++) {
        const matchId = MATCH_PREFIX + i;
        const url = WS_BASE_URL + matchId;

        const ws = new WebSocket(url);
        clients.push(ws);

        ws.on('open', () => {
            connected++;
        });

        ws.on('message', (data) => {
            messagesReceived++;
        });

        ws.on('error', (err) => {
            errors++;
            console.error(`Client ${i} error: ${err.message}`);
        });

        ws.on('close', () => {
            closed++;
        });

        // Stagger connections
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 50));
    }

    const start = Date.now();
    const interval = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        process.stdout.write(`\r[${elapsed.toFixed(1)}s] Connected: ${connected} | Errors: ${errors} | Closed: ${closed} | Total Msg: ${messagesReceived}    `);
        
        if ((connected + errors + closed >= NUM_USERS) && elapsed > 20) {
            clearInterval(interval);
            console.log('\n--- FINAL RESULTS ---');
            console.log(`✅ SUCCESS: ${(connected / NUM_USERS * 100).toFixed(1)}%`);
            console.log(`❌ ERRORS: ${errors}`);
            console.log(`🚪 CLOSED: ${closed}`);
            console.log(`💬 TOTAL MESSAGES: ${messagesReceived}`);
            process.exit(0);
        }
    }, 1000);

    setTimeout(() => {
        console.log('\nTest timed out');
        process.exit(1);
    }, 120000);
}

run().catch(console.error);
