const express = require('express');
const protect = require('../../../../dry/middlewares/protection/auth.middleware').protect;

function createConversationsRouter(ConversationsModel, ConversationMessagesModel) {
  const router = express.Router();
  router.use(protect);
  
  router.get('/', async (req, res) => {
    const convs = await ConversationsModel.find({ deletedAt: null, userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    
    const formattedConvs = convs.map(conv => ({
      id: conv._id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));
    res.json(formattedConvs);
  });

  router.post('/', async (req, res) => {
    const { title } = req.body;
    const doc = new ConversationsModel({
      userId: req.user._id,
      title: title || 'Nouvelle conversation'
    });
    await doc.save();
    
    const formattedConv = {
      id: doc._id,
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    res.json(formattedConv);
  });

  router.get('/:id/messages', async (req, res) => {
    const messages = await ConversationMessagesModel.find({ 
      conversationId: req.params.id, 
      deletedAt: null,
      userId: req.user._id
    }).sort({ createdAt: 1 }).lean();
    
    const formattedMessages = messages.map(m => {
      let parsedContent = m.content;
      if (parsedContent && (parsedContent.startsWith('[') || parsedContent.startsWith('{'))) {
        try {
          const temp = JSON.parse(parsedContent);
          if (!temp.success && temp.message) {
            parsedContent = temp.message;
          } else {
            parsedContent = temp;
          }
        } catch (e) {
        }
      }
      const msg = {
        role: m.role,
        content: parsedContent
      };
      if (m.toolCalls) {
        try { msg.tool_calls = typeof m.toolCalls === 'string' ? JSON.parse(m.toolCalls) : m.toolCalls; } catch {}
      }
      if (m.toolCallId) {
        msg.tool_call_id = m.toolCallId;
      }
      if (m.files) {
        try { msg.files = typeof m.files === 'string' ? JSON.parse(m.files) : m.files; } catch {}
      }
      if (m.meta) {
        try { msg.meta = typeof m.meta === 'string' ? JSON.parse(m.meta) : m.meta; } catch {}
      }
      return msg;
    });
    
    res.json(formattedMessages);
  });

  router.post('/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { role, content, tool_calls, tool_call_id, files, meta } = req.body;
    
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    const doc = new ConversationMessagesModel({
      userId: req.user._id,
      conversationId: id,
      role,
      content: contentStr,
      toolCalls: tool_calls ? JSON.stringify(tool_calls) : null,
      toolCallId: tool_call_id || null,
      files: files ? JSON.stringify(files) : null,
      meta: meta ? JSON.stringify(meta) : null,
    });
    await doc.save();
    
    await ConversationsModel.findOneAndUpdate({ _id: id, userId: req.user._id }, { updatedAt: new Date() });
    
    res.json({ success: true });
  });

  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    
    const doc = await ConversationsModel.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { 
        title: title || 'Nouvelle conversation',
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!doc) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }
    
    const formattedConv = {
      id: doc._id,
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    res.json(formattedConv);
  });

  router.delete('/:id', async (req, res) => {
    await ConversationsModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { deletedAt: new Date() }
    );
    res.json({ success: true });
  });

  return router;
}

module.exports = { createConversationsRouter };
