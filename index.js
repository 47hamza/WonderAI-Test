const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.json());

// Middleware for user authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/auth/signup', async (req, res) => {
   try {
        const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { email, password: hashedPassword }
    });
    res.json({ id: user.id });
   }
   catch (e) {
       res.status(500).json({ "status": 500, "error": e.message })
   }
});

app.post('/auth/login', async (req, res) => {
   try {
        const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ userId: user.id }, process.env.SECRET_KEY);
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
   }
   catch (e) {
     res.status(500).json({ "status": 500, "error": e.message })
   }
});

app.post('/message', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
    const message = await prisma.message.create({
        data: { userId: req.user.userId, content }
    });
    res.json({ id: message.id });
    }
    catch (e) {
        res.status(500).json({ "status": 500, "error": e.message })
    }
});

app.get('/message/:id', async (req, res) => {
    try {
        const { id } = req.params;
    const message = await prisma.message.findUnique({
        where: { id: parseInt(id) },
        include: { user: true, likes: true }
    });
    res.json(message);
    }
    catch (e) {
        res.status(500).json({ "status": 500, "error": e.message })
    }
});

app.post('/message/like', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.body;
    const like = await prisma.like.create({
        data: { userId: req.user.userId, messageId }
    });
    await prisma.message.update({
        where: { id: messageId },
        data: { likeCount: { increment: 1 } }
    });
    res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ "status": 500, "error": e.message })
    }
});

// Add Comment to Message
app.post('/message/:id/comment', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
    const { content } = req.body;

    const comment = await prisma.comment.create({
        data: {
            userId: req.user.userId,
            messageId: parseInt(id),
            content
        }
    });
    res.json(comment);
    }
    catch (e) {
        res.status(500).json({ "status": 500, "error": e.message })
    }
});

// Get Comments for a Message
app.get('/message/:id/comments', async (req, res) => {
  try {
        const { id } = req.params;
    const comments = await prisma.comment.findMany({
        where: { messageId: parseInt(id) },
        include: { user: true }
    });
    res.json(comments);
  }
  catch (e) {
      res.status(500).json({ "status": 500, "error": e.message })
  }
});

// Delete Comment (with authorization check)
app.delete('/comment/:commentId', authenticateToken, async (req, res) => {
   try {
        const { commentId } = req.params;

    const comment = await prisma.comment.findUnique({ where: { id: parseInt(commentId) } });
    if (comment.userId !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.comment.delete({ where: { id: parseInt(commentId) } });
    res.json({ success: true });
   }
   catch (e) {
       res.status(500).json({ "status": 500, "error": e.message })
   }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`);
});
