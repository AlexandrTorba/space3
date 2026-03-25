const { create, toBinary, fromBinary } = require('@bufbuild/protobuf');
const { MatchUpdateSchema } = require('@antigravity/contracts');
const WebSocket = require('ws');

const matchId = `test-logic-${Date.now()}`;
const url = (role) => `ws://localhost:8787/bughouse/${matchId}?role=${role}`;

async function runTest() {
    console.log(`Testing Bughouse Backend Logic: ${matchId}`);
    
    // Connect Two Players (Partners)
    const w0WS = new WebSocket(url('w0'));
    const b1WS = new WebSocket(url('b1'));
    // Connect One Enemy
    const b0WS = new WebSocket(url('b0'));

    let lastStatusB1 = null;

    b1WS.on('message', (data) => {
        const update = fromBinary(MatchUpdateSchema, new Uint8Array(data));
        if (update.event.case === 'bughouse' && update.event.value.event.case === 'status') {
            lastStatusB1 = update.event.value.event.value;
        }
    });

    await new Promise(r => setTimeout(r, 3000));

    const sendMove = (ws, uci) => {
        const update = create(MatchUpdateSchema, {
            event: { case: "move", value: { matchId, uci, timestamp: BigInt(Date.now()) } }
        });
        ws.send(toBinary(MatchUpdateSchema, update));
    };

    console.log("1. w0 moves e2e4");
    sendMove(w0WS, 'e2e4');
    await new Promise(r => setTimeout(r, 1000));

    console.log("2. b0 moves d7d5");
    sendMove(b0WS, 'd7d5');
    await new Promise(r => setTimeout(r, 1000));

    console.log("3. w0 captures d5: e4d5");
    sendMove(w0WS, 'e4d5');
    await new Promise(r => setTimeout(r, 2000));

    console.log("Checking Partner's (b1) bank...");
    if (lastStatusB1 && lastStatusB1.bank1b && lastStatusB1.bank1b.includes('P')) {
        console.log("✅ SUCCESS: Partner b1 received the captured pawn!");
    } else {
        console.log("❌ FAILURE: Partner b1 did not receive the pawn or bank1b is empty.");
        console.log("Bank 1b:", lastStatusB1 ? lastStatusB1.bank1b : "No status");
    }

    w0WS.close();
    b1WS.close();
    b0WS.close();
}

runTest().catch(console.error);
