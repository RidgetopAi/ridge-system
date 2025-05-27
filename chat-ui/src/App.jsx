import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Image, User, LogOut, Bot, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { supabase } from './supabase';

function ChatApp() {
  // State management
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '', name: '' });
  const [isSignUp, setIsSignUp] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Refs for auto-scroll and file input
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputText]);

  // Load conversations when user logs in
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  // Authentication functions
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      // Create or update user profile
      await createUserProfile(session.user);
    }
  };

  const createUserProfile = async (authUser) => {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email.split('@')[0],
        updated_at: new Date().toISOString()
      });
    
    if (error) console.error('Error creating user profile:', error);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Sign up new user
        const { data, error } = await supabase.auth.signUp({
          email: loginForm.email,
          password: loginForm.password,
          options: {
            data: {
              name: loginForm.name,
            }
          }
        });
        
        if (error) throw error;
        
        if (data.user) {
          alert('Check your email for the confirmation link!');
        }
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginForm.email,
          password: loginForm.password,
        });
        
        if (error) throw error;
        
        setUser(data.user);
        await createUserProfile(data.user);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMessages([]);
    setConversations([]);
    setCurrentConversationId(null);
  };

  // Conversation management
  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }
    
    setConversations(data || []);
    
    // If no current conversation, create a new one
    if (!currentConversationId && data && data.length === 0) {
      createNewConversation();
    } else if (!currentConversationId && data && data.length > 0) {
      setCurrentConversationId(data[0].id);
    }
  };

  const createNewConversation = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New Conversation',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating conversation:', error);
      return;
    }
    
    setCurrentConversationId(data.id);
    setMessages([]);
    loadConversations(); // Refresh the list
  };

  const loadMessages = async (conversationId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    
    // Convert database format to app format
    const formattedMessages = data.map(msg => ({
      id: msg.id,
      text: msg.content,
      sender: msg.sender,
      timestamp: new Date(msg.created_at)
    }));
    
    setMessages(formattedMessages);
  };

  const saveMessage = async (content, sender) => {
    if (!currentConversationId) return;
    
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: currentConversationId,
        content: content,
        sender: sender
      });
    
    if (error) {
      console.error('Error saving message:', error);
    }
    
    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentConversationId);
  };

  const updateConversationTitle = async (conversationId, newTitle) => {
    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', conversationId);
    
    if (error) {
      console.error('Error updating conversation title:', error);
    } else {
      loadConversations(); // Refresh the list
    }
  };

  const deleteConversation = async (conversationId) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    
    if (error) {
      console.error('Error deleting conversation:', error);
      return;
    }
    
    // If we deleted the current conversation, switch to another one
    if (conversationId === currentConversationId) {
      setCurrentConversationId(null);
      setMessages([]);
    }
    
    loadConversations();
  };

  // Send message function - connects to DeepSeek API
  const sendMessage = async (messageText, messageType = 'chat') => {
    if (!messageText.trim() && messageType === 'chat') return;
    if (!currentConversationId) await createNewConversation();

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
      type: messageType
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Save user message to database
    await saveMessage(messageText, 'user');

    // Update conversation title if it's the first message
    const currentConv = conversations.find(c => c.id === currentConversationId);
    if (currentConv && currentConv.title === 'New Conversation') {
      const title = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
      await updateConversationTitle(currentConversationId, title);
    }

    // Prepare messages for DeepSeek API
    const guaGuideContent = `Goal of Gua is to make a language between Humans and Ai. Essentially to reduce the use of tokens and increase the availability of token context.

## Core Gua Symbol System

| Category | Symbol | Meaning | Example Usage |
|----------|--------|---------|--------------|
| **Logic Operators** | + | and, positive, good | "idea+" = "good idea" |
| | - | not, negative, bad | "want-" = "don't want" |
| | * | emphasis, multiply | "imp*" = "very important" |
| | / | or, alternatives | "this/that" = "this or that" |
| | : | is, equals, defines | "gua:efficient" = "gua is efficient" |
| **Pronouns & People** | @ | you/your | "@idea?" = "your idea?" |
| | j | I/me/my | "j think" = "I think" |
| | we | we/us/our | "we do" = "we will do it" |
| **Flow Control** | ; | then, next step | "read;write" = "read then write" |
| | () | group concepts | "(cost+time)" = "both cost and time" |
| | [] | optional | "[maybe]later" = "maybe later" |
| | {} | variable | "{topic}?" = "what topic?" |
| **Quantities** | # | number | "#5" = "number 5" |
| | % | percent, portion | "50%" = "fifty percent" |
| | ~ | approximately | "~5min" = "about 5 minutes" |
| | < | less than | "<5" = "less than 5" |
| | > | more than | ">10" = "more than 10" |
| **Markers** | $ | money, value | "$high" = "high value" |
| | ! | greeting, important | "!team" = "hello team" |
| | ? | question | "done?" = "is it done?" |
| | • | list item | "•one •two" = "first second" |

## Advanced Combo Examples

| Combo | Meaning | Example |
|-------|---------|---------|
| @+ | you and | "@+j work" = "you and I work" |
| j: | I am | "j:ready" = "I am ready" |
| ?+ | and also ask | "done?+when" = "is it done and when?" |
| *imp | very important | "*imp note" = "very important note" |
| -want | don't want | "-want this" = "don't want this" |
| task; | after task | "finish;start" = "finish then start" |
| ~= | approximately equals | "~=same" = "approximately the same" |
| j/ | either me or | "j/@" = "either me or you" |
| @? | asking you | "@?help" = "can you help?" |
| +1 | agree | "+1 idea" = "I agree with that idea" |

## Ultra-Compressed Phrases

| Gua Format | Standard English |
|------------|------------------|
| !@? | "Hello, how are you?" |
| j:ok+ | "I am good and ready" |
| need{info}? | "Do you need what information?" |
| @idea*good | "Your idea is very good" |
| pls;thx | "Please do this then thanks" |
| cost$? | "What is the cost?" |
| j-knw | "I don't know" |
| @+j do tmrw? | "Can you and I do it tomorrow?" |
| task1;2;3 | "Do task 1, then 2, then 3" |
| opt[A/B/C] | "Options are A, B, or C" |
| j need {taskA} status + {taskB} status. | "I need to know the status of task A and task B." |
| this +/ -? | "Is this good or bad?" |
| *imp: review {doc} now. | "Very important: review this document now." |
| j -want this / +want that. | "I don't want this, but I want that." |
| ~10min; we start. | "Approximately 10 minutes, then we can start." |

## Implementation Strategy

1. **Start simple**: Begin with basic symbols (+, -, ?, @, j)
2. **Build gradually**: Add more symbols as conversation develops
3. **Context matters**: Use more symbols in established contexts
4. **Consistency**: Use the same symbol patterns throughout
5. **Balance**: Find the sweet spot between compression and clarity

This advanced system could potentially reduce token usage by 40-60% once mastered, while maintaining semantic clarity through the systematic use of mathematical and logical symbols that carry inherent meaning.`;

    const guaExamplesContent = `English Version:
Napoleon was a French general who became emperor. He rose to power during the French Revolution. He is famous for the Napoleonic Wars and the Napoleonic Code, which greatly influenced global legal systems. A key fact: in 1804, he crowned himself emperor, asserting total power.

Gua:
N(apoleon): France general→emperor. Rise: Revolution. Win: battles/wars. Law: Napoleon-Code global/justice. Crown self 1804.`;

    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant that communicates using the "Gua" language.
Here is the guide for Gua:
${guaGuideContent}

Here are examples of Gua usage:
${guaExamplesContent}

Your primary goal is to communicate efficiently using Gua. When a user sends a message, respond in Gua. If a direct Gua translation is not immediately clear, try to use the core symbols and principles to construct a concise Gua response. If the user asks a question in English, respond in Gua. If the user asks you to do something, respond in Gua.
`
    };

    const messagesForApi = [systemMessage, ...messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }))];

    // Add the current user message to the API payload
    messagesForApi.push({ role: 'user', content: messageText });

    try {
      // Send to DeepSeek API
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesForApi,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const aiResponseContent = data.choices[0]?.message?.content || "Received an empty response from DeepSeek.";

      // Add AI response to chat
      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponseContent,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save AI message to database
      await saveMessage(aiMessage.text, 'ai');

      setIsLoading(false);

    } catch (error) {
      console.error('Error sending message to DeepSeek:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: `Sorry, I encountered an error communicating with the AI: ${error.message}`,
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage.text, 'ai');
      setIsLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileName = file.name;
      const fileSize = (file.size / 1024 / 1024).toFixed(2);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target.result;
        let contentType = file.type;

        // Determine content type for backend
        if (fileName.toLowerCase().endsWith('.pdf')) {
          contentType = 'application/pdf';
        } else if (fileName.toLowerCase().endsWith('.txt')) {
          contentType = 'text/plain';
        } else {
          sendMessage(`📎 Uploaded file: ${fileName} (${fileSize} MB) - Unsupported type for content processing.`, 'upload_file');
          return;
        }

        try {
          setIsLoading(true);
          const response = await fetch('http://localhost:3001/upload-document', {
            method: 'POST',
            headers: {
              'Content-Type': contentType,
            },
            body: fileContent // Send ArrayBuffer for PDF, or string for text
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Upload error: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
          }

          const data = await response.json();
          // Send a message to the chat indicating the file was processed
          sendMessage(`📎 Document: ${fileName} (${fileSize} MB). Content: ${data.extractedText}`, 'upload_file');

        } catch (error) {
          console.error('Error uploading file content:', error);
          sendMessage(`Error processing file: ${fileName}. ${error.message}`, 'error');
        } finally {
          setIsLoading(false);
        }
      };

      // Read file based on type
      if (fileName.toLowerCase().endsWith('.pdf')) {
        reader.readAsArrayBuffer(file); // Read PDF as ArrayBuffer
      } else if (fileName.toLowerCase().endsWith('.txt')) {
        reader.readAsText(file); // Read TXT as text
      }
    }
    event.target.value = ''; // Clear the file input
  };

  // Handle image generation request
  const handleImageGeneration = () => {
    const prompt = inputText.trim() || "Generate a creative image";
    sendMessage(`🎨 Generate image: ${prompt}`, 'generate_image');
  };

  // Handle Enter key (with Shift+Enter for new lines)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-dark-medium flex items-center justify-center p-4">
        <div className="bg-secondary-900 rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-primary-950 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-primary-500" />
            </div>
            <h1 className="text-2xl font-bold text-secondary-100">AI Chat Assistant</h1>
            <p className="text-secondary-300 mt-2">
              {isSignUp ? 'Create your account' : 'Sign in to start chatting'}
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-secondary-200 mb-2">Name</label>
                <input
                  type="text"
                  value={loginForm.name}
                  onChange={(e) => setLoginForm({...loginForm, name: e.target.value})}
                  className="w-full px-4 py-3 border border-secondary-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-secondary-200 mb-2">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                className="w-full px-4 py-3 border border-secondary-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-200 mb-2">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full px-4 py-3 border border-secondary-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
            >
              {isLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
          </form>
          
          <div className="text-center mt-4">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary-500 hover:text-primary-400 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="h-screen bg-dark-dark flex">
      {/* Sidebar for conversations */}
      <div className={`bg-secondary-900 border-r flex flex-col transition-all duration-300 ${showSidebar ? 'w-80 md:w-80' : 'w-0 overflow-hidden'} ${showSidebar ? 'fixed md:relative inset-y-0 left-0 z-50 md:z-auto' : ''}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <button
            onClick={createNewConversation}
            className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2 mr-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => setShowSidebar(false)}
            className="text-secondary-400 hover:text-secondary-300 transition-colors p-2 md:hidden"
            title="Close sidebar"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                currentConversationId === conv.id ? 'bg-primary-950' : 'hover:bg-secondary-800'
              }`}
              onClick={() => {
                setCurrentConversationId(conv.id);
                // Close sidebar on mobile after selecting conversation
                if (window.innerWidth < 768) {
                  setShowSidebar(false);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <MessageSquare className="w-4 h-4 text-secondary-400 flex-shrink-0" />
                  <span className="text-sm text-secondary-100 truncate">{conv.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-secondary-400 mt-1">
                {new Date(conv.updated_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-secondary-900 shadow-sm border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-secondary-400 hover:text-secondary-300 transition-colors"
            >
              <MessageSquare className="w-6 h-6" />
            </button>
            <div className="bg-primary-950 w-10 h-10 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-secondary-100">AI Assistant</h1>
              <p className="text-sm text-secondary-400">Connected to your n8n backend</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-secondary-300">
              <User className="w-4 h-4" />
              <span>{user.user_metadata?.name || user.email.split('@')[0]}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-secondary-500 hover:text-secondary-300 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  message.sender === 'user'
                    ? 'bg-primary-600 text-white'
                    : message.isError
                    ? 'bg-red-900 text-red-100 border border-red-700'
                    : 'bg-secondary-800 text-secondary-100 shadow-sm border border-secondary-700'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                <p className={`text-xs mt-2 ${
                  message.sender === 'user' ? 'text-primary-200' : 'text-secondary-400'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary-800 shadow-sm border border-secondary-700 rounded-2xl px-4 py-3 max-w-xs">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-secondary-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-secondary-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-secondary-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-secondary-900 border-t border-secondary-700 px-6 py-4">
          <div className="flex items-end space-x-3">
            {/* File Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-secondary-500 hover:text-secondary-300 transition-colors p-2"
              title="Upload file"
            >
              <Upload className="w-5 h-5" />
            </button>
            
            {/* Image Generation */}
            <button
              onClick={handleImageGeneration}
              className="text-secondary-500 hover:text-secondary-300 transition-colors p-2"
              title="Generate image"
            >
              <Image className="w-5 h-5" />
            </button>
            
            {/* Text Input */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="w-full px-4 py-3 border border-secondary-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none max-h-32 text-secondary-100 bg-secondary-800"
                rows="1"
              />
            </div>
            
            {/* Send Button */}
            <button
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
              className="bg-primary-600 text-white p-3 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-xs text-secondary-400 mt-2 text-center">
            Professional Mode • Authenticated • Conversations Saved • Connected to Qwen via n8n
          </p>
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="*/*"
        />
      </div>
    </div>
  );
}

export default ChatApp;
