import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 3002;
const MAP_SIZE = 2200;

// Shared state
const players = {};
let worldObjects = [];

// Object Types definitions to generate them on server
const OBJECT_CONFIG = {
  TRASH: { size: 12, score: 5, growth: 0.8 },
  BENCH: { size: 16, score: 10, growth: 1.2 },
  TREE: { size: 24, score: 20, growth: 2.0 },
  CAR: { size: 36, score: 45, growth: 3.5 },
  BUS: { size: 55, score: 80, growth: 5.0 },
  SHOP: { size: 75, score: 150, growth: 7.5 },
  RESTAURANT: { size: 105, score: 250, growth: 10.0 },
  SKYSCRAPER: { size: 145, score: 400, growth: 15.0 },
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getSafeSpawn(size) {
  let x, z;
  do {
    x = rand(size + 50, MAP_SIZE - size - 50);
    z = rand(size + 50, MAP_SIZE - size - 50);
  } while (Math.hypot(x - MAP_SIZE / 2, z - MAP_SIZE / 2) < 300);
  return { x, z };
}

// Generate shared world objects once on start
function initWorldObjects() {
  worldObjects = [];
  let idCounter = 0;
  Object.keys(OBJECT_CONFIG).forEach(typeId => {
    const config = OBJECT_CONFIG[typeId];
    let count = 45;
    if (config.size > 14) count = 35;
    if (config.size > 20) count = 30;
    if (config.size > 30) count = 20;
    if (config.size > 50) count = 12;
    if (config.size > 70) count = 8;
    if (config.size > 100) count = 5;

    for (let i = 0; i < count; i++) {
      const spawn = getSafeSpawn(config.size);
      worldObjects.push({
        id: idCounter++,
        typeId,
        x: spawn.x,
        z: spawn.z,
        isEaten: false,
        swallowProgress: 0,
        eaterId: null
      });
    }
  });
  console.log(`Generated ${worldObjects.length} shared world objects`);
}

initWorldObjects();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Send current players list and world objects to the new player
  socket.emit('init', {
    playerId: socket.id,
    players,
    objects: worldObjects
  });

  // Handle player join
  socket.on('join', (data) => {
    players[socket.id] = {
      id: socket.id,
      name: data.name || `Player_${socket.id.substring(0, 4)}`,
      skin: data.skin || 'NEON',
      trail: data.trail || 'sparks',
      x: rand(200, MAP_SIZE - 200),
      z: rand(200, MAP_SIZE - 200),
      radius: 24,
      score: 0,
      isAlive: true,
      vx: 0,
      vz: 0
    };
    
    // Broadcast player joined to everyone
    io.emit('playerJoined', players[socket.id]);
  });

  // Handle position / movement update from player
  socket.on('update', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].z = data.z;
      players[socket.id].radius = data.radius;
      players[socket.id].score = data.score;
      players[socket.id].vx = data.vx;
      players[socket.id].vz = data.vz;
      players[socket.id].isAlive = data.isAlive;
      
      // Broadcast update to other players
      socket.broadcast.emit('playerUpdated', {
        id: socket.id,
        ...data
      });
    }
  });

  // Handle eating an object
  socket.on('eatObject', (data) => {
    const { objectId } = data;
    const obj = worldObjects.find(o => o.id === objectId);
    if (obj && !obj.isEaten) {
      obj.isEaten = true;
      obj.eaterId = socket.id;

      // Broadcast eat event to sync visuals
      io.emit('objectEaten', {
        objectId,
        eaterId: socket.id,
        x: players[socket.id]?.x,
        z: players[socket.id]?.z
      });

      // Schedule respawn
      setTimeout(() => {
        const config = OBJECT_CONFIG[obj.typeId];
        const spawn = getSafeSpawn(config.size);
        obj.x = spawn.x;
        obj.z = spawn.z;
        obj.isEaten = false;
        obj.eaterId = null;

        io.emit('objectRespawned', {
          objectId,
          x: spawn.x,
          z: spawn.z
        });
      }, 5000);
    }
  });

  // Handle eating another player
  socket.on('eatPlayer', (data) => {
    const { targetId } = data;
    if (players[targetId] && players[targetId].isAlive && players[socket.id]) {
      players[targetId].isAlive = false;
      
      // Reward the eating player
      players[socket.id].score += 450;
      
      io.emit('playerEaten', {
        targetId,
        eaterId: socket.id
      });
      
      console.log(`Player ${socket.id} ate player ${targetId}`);
    }
  });

  // Handle player respawn
  socket.on('respawn', () => {
    if (players[socket.id]) {
      players[socket.id].isAlive = true;
      players[socket.id].x = rand(200, MAP_SIZE - 200);
      players[socket.id].z = rand(200, MAP_SIZE - 200);
      players[socket.id].radius = 24;
      players[socket.id].score = 0;
      players[socket.id].vx = 0;
      players[socket.id].vz = 0;
      
      io.emit('playerRespawned', players[socket.id]);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.io multiplayer server listening on port ${PORT}`);
});
