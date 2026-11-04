// test/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  // 1. Levantar la instancia en memoria
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  // 2. Asignar la URI en memoria a las variables de entorno para que la app la use
  process.env.MONGO_URI = uri;

  // 3. Conectar Mongoose a esa URI temporal
  await mongoose.connect(uri);
});

afterEach(async () => {
  // Limpiar las colecciones después de cada test para mantenerlos aislados
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});