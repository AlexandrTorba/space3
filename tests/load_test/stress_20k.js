const WebSocket = require('ws');
const path = require('path');

const NUM_USERS = 20000;
const MATCH_PFX = 'stress_20k_';
const WS_BASE_URL = 'wss://antigravity-edge-backend.achitora.workers.dev/bughouse/';

async function run() {
    let connected = 0;
    let errors = 0;
    let closed = 0;
    let messagesReceived = 0;

    console.log(`🔥 INTENSIVE STRESS TEST: 20,000 total connections...`);
    console.log(`Mode: Distributed across 5,000 matches (4 users each)`);

    const start = Date.now();
    
    // Logic for staggering connections: 200 per second 
    const spawnInBatches = async () => {
        for (let i = 0; i < NUM_USERS; i++) {
            const matchId = MATCH_PFX + Math.floor(i / 4);
            const url = WS_BASE_URL + matchId;

            try {
                const ws = new WebSocket(url, {
                    // Reduce memory by not keeping extra references
                    perMessageDeflate: false
                });
                
                ws.on('open', () => { connected++; });
                ws.on('message', () => { messagesReceived++; });
                ws.on('error', (err) => { 
                    errors++;
                    if (errors % 100 === 0) console.error(`\n[ERROR SAMPLE] ${err.message}`);
                });
                ws.on('close', () => { closed++; });

                // Avoid keeping references in a huge array to save RAM
                // clients.push(ws); // Don't do this for 20k
            } catch(e) { errors++; }

            if (i % 200 === 0) {
                const elapsed = (Date.now() - start) / 1000;
                process.stdout.write(`\r[${elapsed.toFixed(1)}s] Spawning... ${i}/${NUM_USERS} | Connected: ${connected} | Errors: ${errors} | Closed: ${closed} | Msg: ${messagesReceived}    `);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    };

    const monitor = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        process.stdout.write(`\r[${elapsed.toFixed(1)}s] PROGRESS: ${connected + errors + closed}/${NUM_USERS} | Connected: ${connected} | Errors: ${errors} | Closed: ${closed} | Msg: ${messagesReceived}    `);
        
        if (connected + errors + closed >= NUM_USERS && elapsed > 150) { // Give it time
            clearInterval(monitor);
            console.log('\n--- FINAL STRESS TEST RESULTS (20,000) ---');
            console.log(`✅ SUCCESS RATE: ${(connected / NUM_USERS * 100).toFixed(2)}%`);
            console.log(`💬 TOTAL MESSAGES HANDLED: ${messagesReceived}`);
            process.exit(0);
        }
    }, 2000);

    await spawnInBatches();
}

run().catch(console.error);
