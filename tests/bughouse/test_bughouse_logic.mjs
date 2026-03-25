import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import { MatchUpdateSchema } from '@antigravity/contracts';
import WebSocket from 'ws';

const matchId = `test-logic-${Date.now()}`;
const url = (role) => `ws://localhost:8787/bughouse/${matchId}?role=${role}`;

async function runTest() {
    console.log(`Testing Bughouse Backend Logic: ${matchId}`);
    
    // Connect all 4 players
    const w0WS = new WebSocket(url('w0'));
    const b0WS = new WebSocket(url('b0'));
    const w1WS = new WebSocket(url('w1'));
    const b1WS = new WebSocket(url('b1'));

    let lastStatusB1 = null;

    b1WS.on('message', (data) => {
        try {
           const update = fromBinary(MatchUpdateSchema, new Uint8Array(data));
           if (update.event.case === 'bughouse' && update.event.value.event.case === 'status') {
               lastStatusB1 = update.event.value.event.value;
           }
        } catch(e) {}
    });

    await new Promise(r => setTimeout(r, 4000));

    const sendAction = (ws, type, role) => {
        const update = create(MatchUpdateSchema, {
            event: { case: "lobby", value: { type, role, name: `Player ${role}` } }
        });
        ws.send(toBinary(MatchUpdateSchema, update));
    };

    console.log("Readying all players...");
    sendAction(w0WS, 'ready', 'w0');
    sendAction(b0WS, 'ready', 'b0');
    sendAction(w1WS, 'ready', 'w1');
    sendAction(b1WS, 'ready', 'b1');

    await new Promise(r => setTimeout(r, 2000)); // Wait for lobby processing

    const sendMove = (ws, uci) => {
        const update = create(MatchUpdateSchema, {
            event: { case: "move", value: { matchId, uci, timestamp: BigInt(Date.now()) } }
        });
        ws.send(toBinary(MatchUpdateSchema, update));
    };

    console.log("1. w0 moves e2e4");
    sendMove(w0WS, 'e2e4');
    await new Promise(r => setTimeout(r, 800));

    console.log("2. b0 moves d7d5");
    sendMove(b0WS, 'd7d5');
    await new Promise(r => setTimeout(r, 800));

    console.log("3. w0 captures d5: e4d5");
    sendMove(w0WS, 'e4d5');
    await new Promise(r => setTimeout(r, 2000));

    console.log("Checking Partner's (b1) bank...");
    if (lastStatusB1 && lastStatusB1.bank1b && lastStatusB1.bank1b.join("").includes('P')) {
        console.log("✅ SUCCESS: Partner b1 received the captured pawn!");
    } else {
        console.log("❌ FAILURE: Partner b1 did not receive the pawn.");
        console.log("Bank 1b:", lastStatusB1 ? lastStatusB1.bank1b : "No status");
    }

    [w0WS, b0WS, w1WS, b1WS].forEach(ws => ws.close());
    process.exit(0);
}

runTest().catch(console.error);
