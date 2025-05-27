require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors'); // Import cors
const pdfParse = require('pdf-parse'); // Import pdf-parse
const app = express();
const port = 3001;

app.use(express.json());
app.use(cors()); // Use cors middleware

// DeepSeek API Key from environment variables
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

app.get('/', (req, res) => {
  res.send('Gua Backend is running!');
});

app.post('/chat', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DeepSeek API key not configured on backend.' });
  }

  try {
    const { messages } = req.body;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    res.json(data); // Send DeepSeek's response back to frontend

  } catch (error) {
    console.error('Error proxying message to DeepSeek:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for file uploads
app.post('/upload-document', express.raw({ type: ['application/pdf', 'text/plain'], limit: '10mb' }), async (req, res) => {
  try {
    const contentType = req.headers['content-type'];
    let extractedText = '';

    if (contentType === 'application/pdf') {
      const data = await pdfParse(req.body);
      extractedText = data.text;
    } else if (contentType === 'text/plain') {
      extractedText = req.body.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type.' });
    }

    // For now, just send back a confirmation and the first 500 chars
    console.log('Extracted text length:', extractedText.length);
    res.json({
      message: 'File processed successfully!',
      extractedText: extractedText
    });

  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({ error: 'Failed to process document: ' + error.message });
  }
});

app.listen(port, () => {
  console.log(`Gua Backend listening at http://localhost:${port}`);
});