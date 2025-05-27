import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Image, User, LogOut, Bot, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { supabase } from './supabase';

console.log('ENV URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('ENV KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY)
console.log('ENV KEY timestamp check:', import.meta.env.VITE_SUPABASE_ANON_KEY?.includes('1748356305'))

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

  // Send message function - connects to your n8n webhook
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

    // Prepare JSON payload with conversation history for n8n
    const payload = {
      message: messageText,
      conversationHistory: messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      userId: user.id,
      userEmail: user.email,
      action: messageType,
      timestamp: new Date().toISOString(),
      conversationId: currentConversationId
    };

    try {
      // Send to your n8n production webhook
      const response = await fetch('http://localhost:5678/webhook/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const aiResponse = await response.json();
      
      // Add AI response to chat
      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponse.message || "Got a response from n8n!",
        sender: 'ai',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Save AI message to database
      await saveMessage(aiMessage.text, 'ai');
      
      setIsLoading(false);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble connecting right now. Please try again.",
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
      sendMessage(`📎 Uploaded file: ${fileName} (${fileSize} MB)`, 'upload_file');
    }
    event.target.value = '';
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AI Chat Assistant</h1>
            <p className="text-gray-600 mt-2">
              {isSignUp ? 'Create your account' : 'Sign in to start chatting'}
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={loginForm.name}
                  onChange={(e) => setLoginForm({...loginForm, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
            >
              {isLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
          </form>
          
          <div className="text-center mt-4">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-indigo-600 hover:text-indigo-700 text-sm"
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
    <div className="h-screen bg-gray-50 flex">
      {/* Sidebar for conversations */}
      <div className={`bg-white border-r flex flex-col transition-all duration-300 ${showSidebar ? 'w-80 md:w-80' : 'w-0 overflow-hidden'} ${showSidebar ? 'fixed md:relative inset-y-0 left-0 z-50 md:z-auto' : ''}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <button
            onClick={createNewConversation}
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 mr-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => setShowSidebar(false)}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 md:hidden"
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
                currentConversationId === conv.id ? 'bg-indigo-100' : 'hover:bg-gray-100'
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
                  <MessageSquare className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm truncate">{conv.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(conv.updated_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <MessageSquare className="w-6 h-6" />
            </button>
            <div className="bg-indigo-100 w-10 h-10 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
              <p className="text-sm text-gray-500">Connected to your n8n backend</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{user.user_metadata?.name || user.email.split('@')[0]}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 transition-colors"
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
                    ? 'bg-indigo-600 text-white'
                    : message.isError
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-white text-gray-800 shadow-sm border'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                <p className={`text-xs mt-2 ${
                  message.sender === 'user' ? 'text-indigo-200' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border rounded-2xl px-4 py-3 max-w-xs">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t px-6 py-4">
          <div className="flex items-end space-x-3">
            {/* File Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2"
              title="Upload file"
            >
              <Upload className="w-5 h-5" />
            </button>
            
            {/* Image Generation */}
            <button
              onClick={handleImageGeneration}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none max-h-32"
                rows="1"
              />
            </div>
            
            {/* Send Button */}
            <button
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
              className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-2 text-center">
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