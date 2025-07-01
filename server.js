const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store family groups and their members
const familyGroups = new Map();

// Generate a unique family ID
function generateFamilyId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.post('/api/create-family', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const familyId = generateFamilyId();
  const memberId = uuidv4();
  
  familyGroups.set(familyId, {
    members: new Map(),
    createdAt: new Date()
  });

  familyGroups.get(familyId).members.set(memberId, {
    id: memberId,
    name: name,
    location: null,
    lastSeen: new Date(),
    isOnline: true
  });

  res.json({
    familyId: familyId,
    memberId: memberId,
    name: name
  });
});

app.post('/api/join-family', (req, res) => {
  const { familyId, name } = req.body;
  
  if (!familyId || !name) {
    return res.status(400).json({ error: 'Family ID and name are required' });
  }

  if (!familyGroups.has(familyId)) {
    return res.status(404).json({ error: 'Family not found' });
  }

  const memberId = uuidv4();
  const family = familyGroups.get(familyId);
  
  family.members.set(memberId, {
    id: memberId,
    name: name,
    location: null,
    lastSeen: new Date(),
    isOnline: true
  });

  res.json({
    familyId: familyId,
    memberId: memberId,
    name: name
  });
});

app.get('/api/family/:familyId/members', (req, res) => {
  const { familyId } = req.params;
  
  if (!familyGroups.has(familyId)) {
    return res.status(404).json({ error: 'Family not found' });
  }

  const family = familyGroups.get(familyId);
  const members = Array.from(family.members.values()).map(member => ({
    id: member.id,
    name: member.name,
    location: member.location,
    lastSeen: member.lastSeen,
    isOnline: member.isOnline
  }));

  res.json({ members });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join family room
  socket.on('join-family', (data) => {
    const { familyId, memberId, name } = data;
    
    if (familyGroups.has(familyId)) {
      socket.join(familyId);
      socket.familyId = familyId;
      socket.memberId = memberId;
      socket.name = name;

      // Update member status
      const family = familyGroups.get(familyId);
      if (family.members.has(memberId)) {
        family.members.get(memberId).isOnline = true;
        family.members.get(memberId).lastSeen = new Date();
      }

      // Notify other members
      socket.to(familyId).emit('member-joined', {
        id: memberId,
        name: name,
        timestamp: new Date()
      });

      // Send current members to the new member
      const members = Array.from(family.members.values()).map(member => ({
        id: member.id,
        name: member.name,
        location: member.location,
        lastSeen: member.lastSeen,
        isOnline: member.isOnline
      }));
      
      socket.emit('family-members', members);
    }
  });

  // Update location
  socket.on('update-location', (data) => {
    const { familyId, memberId, location } = data;
    
    if (familyGroups.has(familyId)) {
      const family = familyGroups.get(familyId);
      if (family.members.has(memberId)) {
        family.members.get(memberId).location = location;
        family.members.get(memberId).lastSeen = new Date();
        
        // Broadcast to other family members
        socket.to(familyId).emit('member-location-updated', {
          memberId: memberId,
          name: socket.name,
          location: location,
          timestamp: new Date()
        });
      }
    }
  });

  // Send chat message
  socket.on('send-message', (data) => {
    const { familyId, message } = data;
    
    if (familyGroups.has(familyId)) {
      socket.to(familyId).emit('new-message', {
        memberId: socket.memberId,
        name: socket.name,
        message: message,
        timestamp: new Date()
      });
    }
  });

  // Send SOS alert
  socket.on('send-sos', (data) => {
    const { familyId, location } = data;
    
    if (familyGroups.has(familyId)) {
      socket.to(familyId).emit('sos-alert', {
        memberId: socket.memberId,
        name: socket.name,
        location: location,
        timestamp: new Date()
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.familyId && socket.memberId) {
      const family = familyGroups.get(socket.familyId);
      if (family && family.members.has(socket.memberId)) {
        family.members.get(socket.memberId).isOnline = false;
        family.members.get(socket.memberId).lastSeen = new Date();
        
        // Notify other members
        socket.to(socket.familyId).emit('member-left', {
          id: socket.memberId,
          name: socket.name,
          timestamp: new Date()
        });
      }
    }
  });
});

// Clean up inactive families (older than 24 hours)
setInterval(() => {
  const now = new Date();
  for (const [familyId, family] of familyGroups.entries()) {
    const hoursSinceCreation = (now - family.createdAt) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      familyGroups.delete(familyId);
      console.log(`Cleaned up inactive family: ${familyId}`);
    }
  }
}, 60 * 60 * 1000); // Check every hour

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 LiveConnect server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to start tracking`);
}); 