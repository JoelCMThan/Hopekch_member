import { useEffect, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import useAuth from '../../hooks/useAuth';
import ragService from '../../services/ragService';
import './RagPage.css';

const CHART_COLORS = ['#6f8faf', '#7f9e87', '#9a806f', '#8c83a6', '#b28b78'];
const RAG_ARCHITECTURES = new Set(['structured', 'lpg', 'rdf']);

const loadRagSession = (key) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    return {
      messages: Array.isArray(saved?.messages) ? saved.messages : [],
      architecture: RAG_ARCHITECTURES.has(saved?.architecture) ? saved.architecture : 'structured',
      isDiscoveryCollapsed: saved?.isDiscoveryCollapsed === true,
    };
  } catch {
    return { messages: [], architecture: 'structured', isDiscoveryCollapsed: false };
  }
};

const RagChart = ({ chart }) => {
  if (!chart?.data?.length) return null;

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#ebe7e4" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10 }}
        interval={0}
        angle={chart.data.length > 4 ? -30 : 0}
        textAnchor={chart.data.length > 4 ? 'end' : 'middle'}
        height={chart.data.length > 4 ? 78 : 38}
        tickMargin={8}
      />
      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
      <Tooltip />
    </>
  );

  return (
    <div className="rag-response-chart" role="img" aria-label={chart.title}>
      <h4>{chart.title}</h4>
      <ResponsiveContainer width="100%" height={260}>
        {chart.type === 'pie' ? (
          <PieChart>
            <Pie data={chart.data} dataKey="value" nameKey="label" outerRadius={90} label>
              {chart.data.map((item, index) => <Cell key={`${item.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : chart.type === 'line' ? (
          <LineChart data={chart.data} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
            {common}
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={3} />
          </LineChart>
        ) : (
          <BarChart data={chart.data} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
            {common}
            <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[5, 5, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

const RagPage = () => {
  const { user } = useAuth();
  const sessionIdentity = [
    user?.userId ?? user?.memberId ?? 'anonymous',
    user?.email ?? 'unknown',
  ].join(':').toLowerCase();
  const sessionKey = `hope-rag-session:v2:${sessionIdentity}`;
  const [initialSession] = useState(() => loadRagSession(sessionKey));
  const [messages, setMessages] = useState(initialSession.messages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [architecture, setArchitecture] = useState(initialSession.architecture);
  const [isDiscoveryCollapsed, setIsDiscoveryCollapsed] = useState(initialSession.isDiscoveryCollapsed);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({
        messages,
        architecture,
        isDiscoveryCollapsed,
      }));
    } catch {
      // The chat remains usable if browser storage is disabled or full.
    }
  }, [architecture, isDiscoveryCollapsed, messages, sessionKey]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const question = input.trim();

    if (!question || isLoading) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: question,
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
    ]);

    setInput('');
    setIsLoading(true);
    inputRef.current?.focus();

    try {
      const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
      const response = await ragService.ask({ question, architecture, history });
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          role: 'assistant',
          content: response.answer,
          chart: response.chart,
        },
      ]);
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: error.response?.data?.message ||
            'Unable to reach the AI assistant. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (input.trim() && !isLoading) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  };

  const handleClearConversation = () => {
    setMessages([]);
  };

  return (
    <div className="rag-page">
      <aside className={`rag-discovery${isDiscoveryCollapsed ? ' rag-discovery--collapsed' : ''}`}>
        <div className="rag-discovery-header">
          <span className="material-symbols-outlined">
            explore
          </span>

          <div className="rag-discovery-heading">
            <h2>Discovery</h2>
            <p>Explore your church data with AI</p>
          </div>

          <button
            type="button"
            className="rag-discovery-toggle"
            onClick={() => setIsDiscoveryCollapsed((collapsed) => !collapsed)}
            aria-label={isDiscoveryCollapsed ? 'Expand discovery panel' : 'Collapse discovery panel'}
            aria-expanded={!isDiscoveryCollapsed}
            title={isDiscoveryCollapsed ? 'Expand discovery panel' : 'Collapse discovery panel'}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {isDiscoveryCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        <div className="rag-discovery-content">
          <div className="rag-discovery-section">
            <p className="rag-discovery-label">
              AI Assistant
            </p>

            <div className="rag-info-card">
              <span className="material-symbols-outlined">
                query_stats
              </span>

              <div>
                <h3>Ask about your data</h3>
                <p>
                  Ask questions naturally and receive
                  information based on the church data
                  available to you.
                </p>
              </div>
            </div>

            <div className="rag-info-card">
              <span className="material-symbols-outlined">
                bar_chart
              </span>

              <div>
                <h3>Generate visualisations</h3>
                <p>
                  Request charts and comparisons without
                  manually configuring analytics filters.
                </p>
              </div>
            </div>

            <div className="rag-info-card">
              <span className="material-symbols-outlined">
                account_tree
              </span>

              <div>
                <h3>Explore relationships</h3>
                <p>
                  Explore information across members, life
                  groups, units and subdistricts through the
                  connected church structure.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rag-discovery-footer">
          <div className="rag-rag-card">
            <div className="rag-rag-card-title">
              <span className="material-symbols-outlined">
                hub
              </span>
              <span>{architecture === 'lpg' ? 'LPG RAG' : architecture === 'rdf' ? 'RDF RAG' : 'Structured RAG'}</span>
            </div>

            <p>
              Responses are generated using retrieved
              information from the church management system
              and are limited by your permitted access.
            </p>
          </div>
        </div>
      </aside>

      <section className="rag-chat">
        <header className="rag-chat-header">
          <div className="rag-chat-title">
            <div className="rag-status-dot" />

            <div>
              <h1>Hope AI Assistant</h1>
              <p>Ask questions about your church data</p>
            </div>
          </div>

          <div className="rag-header-actions">
          <label className="rag-architecture-selector">
            <span>Architecture</span>
            <select value={architecture} onChange={(event) => setArchitecture(event.target.value)} disabled={isLoading}>
              <option value="structured">Structured RAG</option>
              <option value="lpg">LPG RAG</option>
              <option value="rdf">RDF RAG</option>
            </select>
          </label>
          <button
            type="button"
            className="rag-header-button"
            onClick={handleClearConversation}
            disabled={messages.length === 0}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <span className="material-symbols-outlined">
              delete
            </span>
          </button>
          </div>
        </header>

        <div className="rag-messages">
          {messages.length === 0 ? (
            <div className="rag-empty-state">
              <div className="rag-empty-icon">
                <span className="material-symbols-outlined">
                  smart_toy
                </span>
              </div>

              <h2>What would you like to know?</h2>

              <p>
                Ask a question about the church information
                available to you. You can also request a chart
                or other visual analysis of the data.
              </p>
            </div>
          ) : (
            <div className="rag-message-list">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rag-message-row ${
                    message.role === 'user'
                      ? 'rag-message-row-user'
                      : 'rag-message-row-assistant'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="rag-message-avatar rag-ai-avatar">
                      <span className="material-symbols-outlined">
                        smart_toy
                      </span>
                    </div>
                  )}

                  <div
                    className={`rag-message ${
                      message.role === 'user'
                        ? 'rag-user-message'
                        : 'rag-assistant-message'
                    }${message.chart ? ' rag-message--chart' : ''}`}
                  >
                    <p>{message.content}</p>

                    {message.chart && (
                      <RagChart chart={message.chart} />
                    )}

                    {message.table && (
                      <div className="rag-response-placeholder">
                        Table response
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="rag-message-avatar rag-user-avatar">
                      <span className="material-symbols-outlined">
                        person
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="rag-message-row rag-message-row-assistant">
                  <div className="rag-message-avatar rag-ai-avatar">
                    <span className="material-symbols-outlined">
                      smart_toy
                    </span>
                  </div>

                  <div className="rag-message rag-assistant-message rag-thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="rag-input-area">
          <form
            className="rag-input-form"
            onSubmit={handleSubmit}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Ask Hope AI anything about your church data..."
              rows="1"
              aria-label="Ask Hope AI"
            />

            <button
              type="submit"
              className="rag-send-button"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <span className="material-symbols-outlined">
                arrow_upward
              </span>
            </button>
          </form>

          <div className="rag-input-footer">
            <span className="material-symbols-outlined">
              verified_user
            </span>

            <span>
              Responses are limited to information you are
              authorised to access.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RagPage;
