import 'dotenv/config';
import mongoose from 'mongoose';

type EventDoc = {
  _id: any;
  occurredAt: Date;
  seq?: number;
};

async function dropIndexIfExists(coll: mongoose.mongo.Collection, indexName: string) {
  try {
    await coll.dropIndex(indexName);
  } catch (err: any) {
    const code = Number(err?.code || 0);
    const msg = String(err?.message || '');
    const notFound = code === 27 || msg.toLowerCase().includes('index not found');
    if (!notFound) throw err;
  }
}

async function ensureEventStoreSeq() {
  const db = mongoose.connection.db;
  const eventStore = db.collection('event_store');
  const sequences = db.collection('event_sequences');

  const indexes = await eventStore.indexes();
  const seqIndex = indexes.find((i) => i.unique && i.key && (i.key as any).seq === 1);
  if (seqIndex?.name) {
    await dropIndexIfExists(eventStore, seqIndex.name);
  }

  const cursor = eventStore
    .find<EventDoc>({}, { projection: { _id: 1, occurredAt: 1, seq: 1 } })
    .sort({ occurredAt: 1, _id: 1 });

  let seq = 0;
  let batch: mongoose.mongo.AnyBulkWriteOperation[] = [];

  for await (const ev of cursor) {
    seq += 1;
    if (Number(ev.seq || 0) === seq) continue;
    batch.push({
      updateOne: {
        filter: { _id: ev._id },
        update: { $set: { seq } }
      }
    });
    if (batch.length >= 1000) {
      await eventStore.bulkWrite(batch, { ordered: false });
      batch = [];
    }
  }

  if (batch.length > 0) {
    await eventStore.bulkWrite(batch, { ordered: false });
  }

  await sequences.updateOne(
    { name: 'global' },
    { $set: { name: 'global', value: seq } },
    { upsert: true }
  );

  await eventStore.createIndex({ seq: 1 }, { unique: true });
  await eventStore.createIndex({ aggregateType: 1, aggregateId: 1, occurredAt: -1 });
  await eventStore.createIndex({ eventType: 1, occurredAt: -1 });
  await sequences.createIndex({ name: 1 }, { unique: true });

  return { events: seq };
}

async function main() {
  const uri = String(process.env.MONGO_URI || '').trim();
  if (!uri) {
    throw new Error('MONGO_URI is required for migrations (do not use in-memory mongo).');
  }

  await mongoose.connect(uri, {
    autoIndex: false
  });

  try {
    const res = await ensureEventStoreSeq();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, ...res }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

