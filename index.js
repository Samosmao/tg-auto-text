const http = require("http");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { CustomFile } = require("telegram/client/uploads");
const { Logger } = require("telegram/extensions");

// ទាញយកទិន្នន័យសម្ងាត់ពី Environment Variables របស់ Render
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const sessionString = process.env.SESSION_STRING;

// បង្កើត Web Server តូចមួយដើម្បីឱ្យ Render Free ស្គាល់ Port និងមិនបិទ Service
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Telegram Auto-TXT is running smoothly!");
  })
  .listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

// បិទ Log រញ៉េរញ៉ៃរបស់ gramJS ដើម្បីឱ្យដំណើរការលឿន
const customLogger = new Logger("none");

const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
  connectionRetries: 5,
  baseLogger: customLogger,
});

const chatBuffers = new Map();

(async () => {
  await client.connect();
  const me = await client.getMe();
  const myId = me.id.toString();

  console.log(`✅ ភ្ជាប់ជោគជ័យលើ Render! គណនី៖ ${me.firstName}`);
  console.log("⚡ ប្រព័ន្ធ Auto-TXT ល្បឿនលឿនកំពុងដំណើរការ ២៤ ម៉ោង...");

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.message || message.media) return;

    const senderId = message.senderId ? message.senderId.toString() : null;
    const isMyMessage = message.out === true || senderId === myId;
    if (!isMyMessage) return;

    const peer = message.peerId;
    const chatKey = JSON.stringify(peer);
    const text = message.message;

    if (!chatBuffers.has(chatKey)) {
      chatBuffers.set(chatKey, {
        peer: peer,
        texts: [],
        messageIds: [],
        timer: null,
      });
    }

    const bufferData = chatBuffers.get(chatKey);
    bufferData.texts.push(text);
    bufferData.messageIds.push(message.id);

    if (bufferData.timer) clearTimeout(bufferData.timer);

    bufferData.timer = setTimeout(async () => {
      const fullText = bufferData.texts.join("\n");
      const idsToDelete = [...bufferData.messageIds];
      const messageCount = idsToDelete.length;
      const targetPeer = bufferData.peer;

      chatBuffers.delete(chatKey);

      if (messageCount > 1 || fullText.length > 3800) {
        try {
          const fileBuffer = Buffer.from(fullText, "utf-8");
          const customFile = new CustomFile("message.txt", fileBuffer.length, "", fileBuffer);

          await Promise.all([
            client.sendFile(targetPeer, { file: customFile }),
            client.deleteMessages(targetPeer, idsToDelete, { revoke: true }),
          ]);

          console.log(`⚡ បានបម្លែងសារចំនួន ${messageCount} ទៅជា message.txt រួចរាល់!`);
        } catch (err) {
          console.error("❌ Error:", err.message);
        }
      }
    }, 900);
  }, new NewMessage({}));
})();
