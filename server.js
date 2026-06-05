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

// Room-based state
const rooms = {};

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

// Generate shared world objects per room
function generateRoomObjects() {
  const objects = [];
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
      objects.push({
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
  return objects;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create multiplayer room (Host)
  socket.on('createRoom', (data) => {
    let roomCode = generateRoomCode();
    while (rooms[roomCode]) {
      roomCode = generateRoomCode();
    }

    rooms[roomCode] = {
      code: roomCode,
      hostId: socket.id,
      players: {},
      worldObjects: generateRoomObjects(),
      bots: {},
      started: false
    };

    const hostPlayer = {
      id: socket.id,
      name: data.name || `Host_${socket.id.substring(0, 4)}`,
      skin: data.skin || 'NEON',
      trail: data.trail || 'SPARKS',
      x: rand(200, MAP_SIZE - 200),
      z: rand(200, MAP_SIZE - 200),
      radius: 24,
      score: 0,
      isAlive: true,
      vx: 0,
      vz: 0,
      isHost: true
    };

    rooms[roomCode].players[socket.id] = hostPlayer;
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomCreated', {
      roomCode,
      playerId: socket.id,
      players: Object.values(rooms[roomCode].players)
    });

    console.log(`Room created: ${roomCode} by ${socket.id}`);
  });

  // Join existing room
  socket.on('joinRoom', (data) => {
    const roomCode = (data.roomCode || '').toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      socket.emit('joinRoomError', { message: 'Room not found.' });
      return;
    }

    if (room.started) {
      socket.emit('joinRoomError', { message: 'Match already started.' });
      return;
    }

    if (Object.keys(room.players).length >= 6) {
      socket.emit('joinRoomError', { message: 'Room is full (max 6 players).' });
      return;
    }

    const guestPlayer = {
      id: socket.id,
      name: data.name || `Player_${socket.id.substring(0, 4)}`,
      skin: data.skin || 'NEON',
      trail: data.trail || 'SPARKS',
      x: rand(200, MAP_SIZE - 200),
      z: rand(200, MAP_SIZE - 200),
      radius: 24,
      score: 0,
      isAlive: true,
      vx: 0,
      vz: 0,
      isHost: false
    };

    room.players[socket.id] = guestPlayer;
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('roomJoined', {
      roomCode,
      playerId: socket.id,
      players: Object.values(room.players)
    });

    // Notify other players in room
    socket.to(roomCode).emit('playerJoinedRoom', {
      players: Object.values(room.players)
    });

    console.log(`Player ${socket.id} joined room: ${roomCode}`);
  });

  // Host starts the match
  socket.on('startMatch', () => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id) {
      room.started = true;
      io.to(roomCode).emit('matchStarted', {
        objects: room.worldObjects,
        players: room.players
      });
      console.log(`Match started in room: ${roomCode}`);
    }
  });

  // Sync bot states (Host authority)
  socket.on('syncBots', (data) => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.hostId === socket.id && data.bots) {
      data.bots.forEach(bot => {
        room.bots[bot.id] = bot;
        // Broadcast bot update to guest players in room as a playerUpdated event
        socket.to(roomCode).emit('playerUpdated', {
          id: bot.id,
          name: bot.name,
          x: bot.x,
          z: bot.z,
          radius: bot.radius,
          score: bot.score,
          isAlive: bot.isAlive,
          vx: bot.vx,
          vz: bot.vz,
          skin: bot.color // Hex color treated as skin
        });
      });
    }
  });

  // Handle player update (position, scale, etc.)
  socket.on('update', (data) => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.players[socket.id]) {
      const p = room.players[socket.id];
      p.x = data.x;
      p.z = data.z;
      p.radius = data.radius;
      p.score = data.score;
      p.vx = data.vx;
      p.vz = data.vz;
      p.isAlive = data.isAlive;

      socket.to(roomCode).emit('playerUpdated', {
        id: socket.id,
        ...data
      });
    }
  });

  // Handle eating an object
  socket.on('eatObject', (data) => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      const { objectId, eaterId } = data;
      const obj = room.worldObjects.find(o => o.id === objectId);
      if (obj && !obj.isEaten) {
        obj.isEaten = true;
        obj.eaterId = eaterId;

        const isBot = eaterId.startsWith('bot_');
        const eater = isBot ? room.bots[eaterId] : room.players[eaterId];

        io.to(roomCode).emit('objectEaten', {
          objectId,
          eaterId,
          x: eater?.x || obj.x,
          z: eater?.z || obj.z
        });

        // Respawn the object after 5 seconds
        setTimeout(() => {
          const config = OBJECT_CONFIG[obj.typeId];
          const spawn = getSafeSpawn(config.size);
          obj.x = spawn.x;
          obj.z = spawn.z;
          obj.isEaten = false;
          obj.eaterId = null;

          io.to(roomCode).emit('objectRespawned', {
            objectId,
            x: spawn.x,
            z: spawn.z
          });
        }, 5000);
      }
    }
  });

  // Handle player/bot eaten
  socket.on('eatPlayer', (data) => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];
    if (room) {
      const { targetId, eaterId } = data;

      let targetAlive = false;
      if (targetId.startsWith('bot_')) {
        if (room.bots[targetId]) {
          targetAlive = room.bots[targetId].isAlive;
          room.bots[targetId].isAlive = false;
        }
      } else {
        if (room.players[targetId]) {
          targetAlive = room.players[targetId].isAlive;
          room.players[targetId].isAlive = false;
        }
      }

      if (targetAlive) {
        // Reward eater score
        if (eaterId.startsWith('bot_')) {
          if (room.bots[eaterId]) room.bots[eaterId].score += 450;
        } else {
          if (room.players[eaterId]) room.players[eaterId].score += 450;
        }

        io.to(roomCode).emit('playerEaten', {
          targetId,
          eaterId
        });

        console.log(`[Room ${roomCode}] ${eaterId} devoured ${targetId}`);
      }
    }
  });

  // Handle player respawn
  socket.on('respawn', () => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];
    if (room && room.players[socket.id]) {
      const p = room.players[socket.id];
      p.isAlive = true;
      p.x = rand(200, MAP_SIZE - 200);
      p.z = rand(200, MAP_SIZE - 200);
      p.radius = 24;
      p.score = 0;
      p.vx = 0;
      p.vz = 0;

      io.to(roomCode).emit('playerRespawned', p);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomCode = socket.roomCode;
    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      delete room.players[socket.id];
      io.to(roomCode).emit('playerDisconnected', socket.id);

      if (room.hostId === socket.id) {
        console.log(`Host disconnected, closing room: ${roomCode}`);
        io.to(roomCode).emit('roomClosed');
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit('playerJoinedRoom', {
          players: Object.values(room.players)
        });
        if (Object.keys(room.players).length === 0) {
          console.log(`Room ${roomCode} empty, deleting`);
          delete rooms[roomCode];
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Multiplayer server running on port ${PORT}`);
});
