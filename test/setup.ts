// test/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 60000, // Amplía el límite interno de 10s a 60s
    },
  });
  const uri = mongo.getUri();

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto_testing_123';

  await mongoose.connect(uri);
}, 60000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});