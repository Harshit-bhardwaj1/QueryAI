import { useEffect, useRef, useState } from "react";
import "./index.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";


function App() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [copiedSQL, setCopiedSQL] = useState(null);
  const [copiedResult, setCopiedResult] = useState(null);

  const [activeConversation, setActiveConversation] =
    useState(null);

  const [editingConversation, setEditingConversation] =
    useState(null);

  const [editingTitle, setEditingTitle] = useState("");

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const profileMenuRef = useRef(null);

  // =====================================================
  // AUTHENTICATION
  // =====================================================

  const [token, setToken] = useState(
    localStorage.getItem("access_token")
  );

  const [currentUser, setCurrentUser] = useState(null);

  const [profileMenuOpen, setProfileMenuOpen] =
    useState(false);

  const [profileModalOpen, setProfileModalOpen] =
    useState(false);

  const [authMode, setAuthMode] = useState("login");

  const [authLoading, setAuthLoading] = useState(false);

  const [authError, setAuthError] = useState("");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  function logout() {
    localStorage.removeItem("access_token");
    setToken(null);
    setCurrentUser(null);
    setProfileMenuOpen(false);
    setProfileModalOpen(false);
    setConversations([]);
    setMessages([]);
    setActiveConversation(null);
    setQuestion("");
  }

  async function authenticatedFetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      logout();
      throw new Error("Your session has expired. Please login again.");
    }

    return response;
  }

  async function submitAuth(e) {
    e.preventDefault();

    setAuthError("");

    const email = authForm.email.trim();
    const password = authForm.password;

    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }

    if (authMode === "signup" && !authForm.name.trim()) {
      setAuthError("Name is required.");
      return;
    }

    setAuthLoading(true);

    try {
      const endpoint =
        authMode === "login"
          ? `${API_URL}/auth/login`
          : `${API_URL}/auth/signup`;

      const body =
        authMode === "login"
          ? {
              email,
              password
            }
          : {
              name: authForm.name.trim(),
              email,
              password
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Authentication failed."
        );
      }

      localStorage.setItem(
        "access_token",
        data.access_token
      );

      setToken(data.access_token);
      setCurrentUser(data.user);
      setAuthForm({
        name: "",
        email: "",
        password: ""
      });
      setAuthError("");
    } catch (error) {
      setAuthError(
        error.message || "Unable to connect to the backend."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadCurrentUser() {
    if (!token) return;

    try {
      const response = await authenticatedFetch(
        `${API_URL}/auth/me`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load user."
        );
      }

      setCurrentUser(data.user);
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  }


  /* ==================================================
     THEME
  ================================================== */

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    localStorage.setItem(
      "theme",
      theme
    );
  }, [theme]);


  /* ==================================================
     LOAD HISTORY
  ================================================== */

  useEffect(() => {
    if (token) {
      loadCurrentUser();
      loadConversations();
    }
  }, [token]);


  /* ==================================================
     AUTO SCROLL
  ================================================== */

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({
          behavior: "smooth"
        });
      }, 50);
    }
  }, [messages, loading]);


  /* ==================================================
     PROFILE MENU
  ================================================== */

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    function handleOutsideClick(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [profileMenuOpen]);


  useEffect(() => {
    if (
      !profileMenuOpen &&
      !profileModalOpen
    ) {
      return;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setProfileModalOpen(false);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [profileMenuOpen, profileModalOpen]);


  /* ==================================================
     LOAD CONVERSATIONS
  ================================================== */

  async function loadConversations() {
    try {
      const response = await authenticatedFetch(
        `${API_URL}/conversations`
      );

      const data = await response.json();

      if (response.ok) {
        setConversations(
          data.conversations || []
        );
      }

    } catch (error) {
      console.error(
        "Failed to load conversations:",
        error
      );
    }
  }


  /* ==================================================
     LOAD SINGLE CONVERSATION
  ================================================== */

  async function loadConversation(
    conversationId
  ) {
    if (loading) return;

    try {
      const response = await authenticatedFetch(
        `${API_URL}/conversations/${conversationId}`
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          data.detail ||
          "Conversation not found"
        );
        return;
      }

      const conversation =
        data.conversation;

      setActiveConversation(
        conversation
      );

      const loadedMessages = [];

      loadedMessages.push({
        type: "user",
        content:
          conversation.original_question
      });


      /* ----------------------------------------------
         CLARIFICATION HISTORY
      ---------------------------------------------- */

      if (
        conversation.clarification_question
      ) {
        let clarificationOptions =
          conversation.options || [];

        if (typeof clarificationOptions === "string") {
          try {
            clarificationOptions = JSON.parse(clarificationOptions);
          } catch (error) {
            clarificationOptions = [];
          }
        }

        if (!Array.isArray(clarificationOptions)) {
          clarificationOptions = [];
        }

        loadedMessages.push({
          type:
            "clarification_history",

          question:
            conversation.clarification_question,

          options:
            clarificationOptions,

          answer:
            conversation.user_answer
        });


        if (conversation.user_answer) {
          loadedMessages.push({
            type: "user",
            content:
              conversation.user_answer
          });
        }
      }


      /* ----------------------------------------------
         FINAL RESULT
      ---------------------------------------------- */

      if (conversation.final_sql) {
        let conversationResult =
          conversation.result || [];

        if (typeof conversationResult === "string") {
          try {
            conversationResult = JSON.parse(conversationResult);
          } catch (error) {
            conversationResult = [];
          }
        }

        if (!Array.isArray(conversationResult)) {
          conversationResult = [];
        }

        loadedMessages.push({
          type: "result",

          question:
            conversation.original_question,

          sql:
            conversation.final_sql,

          result:
            conversationResult
        });
      }


      /* ----------------------------------------------
         ERROR
      ---------------------------------------------- */

      if (
        conversation.status === "error" &&
        !conversation.final_sql
      ) {
        loadedMessages.push({
          type: "error",

          content:
            "This conversation ended with an error.",

          retryQuestion:
            conversation.original_question
        });
      }

      setMessages(
        loadedMessages
      );

    } catch (error) {
      console.error(
        "Failed to load conversation:",
        error
      );
    }
  }


  /* ==================================================
     ASK QUESTION
  ================================================== */

  async function askQuestion(
    customQuestion = null
  ) {
    const currentQuestion =
      (
        customQuestion !== null
          ? customQuestion
          : question
      ).trim();

    if (
      !currentQuestion ||
      loading
    ) {
      return;
    }


    setMessages((prev) => [
      ...prev,

      {
        type: "user",
        content: currentQuestion
      }
    ]);

    setQuestion("");
    setLoading(true);


    try {
      const response = await authenticatedFetch(
        `${API_URL}/ask`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            question:
              currentQuestion
          })
        }
      );


      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Unable to process your question."
        );
      }


      /* ----------------------------------------------
         CLARIFICATION
      ---------------------------------------------- */

      if (
        data.status ===
        "clarification_required"
      ) {
        setActiveConversation({
          conversation_id:
            data.conversation_id
        });

        setMessages((prev) => [
          ...prev,

          {
            type: "clarification",

            conversationId:
              data.conversation_id,

            question:
              data.clarification_question,

            options:
              data.options || []
          }
        ]);

        await loadConversations();

        return;
      }


      /* ----------------------------------------------
         SUCCESS
      ---------------------------------------------- */

      if (
        data.status === "completed"
      ) {
        setActiveConversation({
          conversation_id:
            data.conversation_id
        });

        setMessages((prev) => [
          ...prev,

          {
            type: "result",

            question:
              data.question,

            sql:
              data.sql,

            result:
              data.result || []
          }
        ]);

        await loadConversations();

        return;
      }


      /* ----------------------------------------------
         ERROR
      ---------------------------------------------- */

      setMessages((prev) => [
        ...prev,

        {
          type: "error",

          content:
            data.message ||
            error.message ||
            "Something went wrong.",

          retryQuestion:
            currentQuestion
        }
      ]);

      await loadConversations();

    } catch (error) {

      setMessages((prev) => [
        ...prev,

        {
          type: "error",

          content:
            "Unable to connect to the backend.",

          retryQuestion:
            currentQuestion
        }
      ]);

    } finally {
      setLoading(false);
    }
  }


  /* ==================================================
     CLARIFICATION
  ================================================== */

  async function submitClarification(
    conversationId,
    answer
  ) {
    setMessages((prev) => [
      ...prev,

      {
        type: "user",
        content: answer
      }
    ]);

    setLoading(true);


    try {
      const response = await authenticatedFetch(
        `${API_URL}/clarify`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            conversation_id:
              conversationId,

            answer
          })
        }
      );


      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "Unable to process clarification."
        );
      }


      if (
        data.status === "completed"
      ) {
        setActiveConversation({
          conversation_id:
            data.conversation_id
        });

        setMessages((prev) => [
          ...prev,

          {
            type: "result",

            question:
              data.question,

            sql:
              data.sql,

            result:
              data.result || []
          }
        ]);

        await loadConversations();

      } else {

        setMessages((prev) => [
          ...prev,

          {
            type: "error",

            content:
              data.message ||
              "Something went wrong.",

            retryQuestion:
              conversationId
          }
        ]);
      }

    } catch {

      setMessages((prev) => [
        ...prev,

        {
          type: "error",

          content:
            "Unable to connect to the backend."
        }
      ]);

    } finally {
      setLoading(false);
    }
  }


  /* ==================================================
     COPY SQL
  ================================================== */

  function copySQL(
    sql,
    index
  ) {
    navigator.clipboard
      .writeText(sql)
      .then(() => {

        setCopiedSQL(index);

        setTimeout(() => {
          setCopiedSQL(null);
        }, 2000);

      })
      .catch((error) => {
        console.error(
          "Failed to copy SQL:",
          error
        );
      });
  }


  /* ==================================================
     COPY RESULT
  ================================================== */

  function copyResult(
    result,
    index
  ) {
    if (
      !result ||
      result.length === 0
    ) {
      return;
    }

    const columns =
      Object.keys(result[0]);

    const header =
      columns.join("\t");

    const rows =
      result.map((row) =>
        columns
          .map((column) =>
            formatValue(
              row[column]
            )
          )
          .join("\t")
      );

    const text =
      [header, ...rows]
        .join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {

        setCopiedResult(index);

        setTimeout(() => {
          setCopiedResult(null);
        }, 2000);

      })
      .catch((error) => {
        console.error(
          "Failed to copy result:",
          error
        );
      });
  }


  /* ==================================================
     RENAME
  ================================================== */

  function startRename(
    conversation
  ) {
    setEditingConversation(
      conversation.conversation_id
    );

    setEditingTitle(
      conversation.title ||
      conversation.question ||
      ""
    );
  }


  function cancelRename() {
    setEditingConversation(null);
    setEditingTitle("");
  }


  async function saveRename(
    conversationId
  ) {
    const title =
      editingTitle.trim();

    if (!title) {
      return;
    }

    try {
      const response =
        await authenticatedFetch(
          `${API_URL}/conversations/${conversationId}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              title
            })
          }
        );

      const data =
        await response.json();


      if (
        data.status === "completed"
      ) {
        setEditingConversation(null);
        setEditingTitle("");

        await loadConversations();

        if (
          activeConversation?.conversation_id ===
          conversationId
        ) {
          setActiveConversation(
            data.conversation
          );
        }
      }

    } catch (error) {
      console.error(
        "Failed to rename conversation:",
        error
      );
    }
  }


  function handleRenameKeyDown(
    e,
    conversationId
  ) {
    if (e.key === "Enter") {
      e.preventDefault();

      saveRename(
        conversationId
      );
    }

    if (e.key === "Escape") {
      cancelRename();
    }
  }


  /* ==================================================
     DELETE
  ================================================== */

  async function deleteConversation(
    conversationId
  ) {
    const confirmed =
      window.confirm(
        "Delete this conversation?"
      );

    if (!confirmed) {
      return;
    }


    try {
      const response =
        await authenticatedFetch(
          `${API_URL}/conversations/${conversationId}`,
          {
            method: "DELETE"
          }
        );

      const data =
        await response.json();


      if (
        data.status === "completed"
      ) {
        setConversations((prev) =>
          prev.filter(
            (item) =>
              item.conversation_id !==
              conversationId
          )
        );


        if (
          activeConversation?.conversation_id ===
          conversationId
        ) {
          newChat();
        }
      }

    } catch (error) {
      console.error(
        "Failed to delete conversation:",
        error
      );
    }
  }


  /* ==================================================
     RETRY
  ================================================== */

  function retryQuestion(
    retryText
  ) {
    if (!retryText || loading) {
      return;
    }

    askQuestion(retryText);
  }


  /* ==================================================
     KEYBOARD
  ================================================== */

  function handleKeyDown(e) {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      askQuestion();
    }
  }


  /* ==================================================
     NEW CHAT
  ================================================== */

  function newChat() {
    setMessages([]);
    setQuestion("");
    setActiveConversation(null);
    setEditingConversation(null);
    setEditingTitle("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }


  /* ==================================================
     FORMAT VALUE
  ================================================== */

  function formatValue(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "NULL";
    }

    if (
      typeof value === "number"
    ) {
      return value.toLocaleString();
    }

    return String(value);
  }


  /* ==================================================
     TABLE
  ================================================== */

  function renderTable(
    result,
    messageIndex
  ) {
    if (
      !result ||
      result.length === 0
    ) {
      return (
        <div className="no-results">
          Query executed successfully,
          but no rows were returned.
        </div>
      );
    }


    const columns =
      Object.keys(result[0]);


    return (
      <>
        <div className="result-table-container">

          <table className="result-table">

            <thead>
              <tr>
                {columns.map(
                  (column) => (
                    <th key={column}>
                      {column}
                    </th>
                  )
                )}
              </tr>
            </thead>


            <tbody>
              {result.map(
                (row, rowIndex) => (
                  <tr key={rowIndex}>

                    {columns.map(
                      (column) => (
                        <td key={column}>
                          {formatValue(
                            row[column]
                          )}
                        </td>
                      )
                    )}

                  </tr>
                )
              )}
            </tbody>

          </table>

        </div>

        <div className="result-footer">

          <span>
            {result.length}{" "}
            {result.length === 1
              ? "row"
              : "rows"}
          </span>

          <button
            className="result-copy-button"
            onClick={() =>
              copyResult(
                result,
                messageIndex
              )
            }
          >
            {copiedResult ===
            messageIndex
              ? "✓ Copied"
              : "⧉ Copy result"}
          </button>

        </div>
      </>
    );
  }


  /* ==================================================
     PROFILE
  ================================================== */

  const profileName =
    currentUser?.name || "User";

  const profileEmail =
    currentUser?.email || "Email not available";

  const profileInitial =
    profileName.charAt(0).toUpperCase();

  const profileId =
    currentUser?.user_id || "Not available";

  const profileCreatedAt =
    formatProfileDate(currentUser?.created_at);


  function formatProfileDate(value) {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );
  }


  function openProfileModal() {
    setProfileMenuOpen(false);
    setProfileModalOpen(true);
  }


  function handleLogout() {
    setProfileMenuOpen(false);
    setProfileModalOpen(false);
    logout();
  }


  /* ==================================================
     RENDER
  ================================================== */

  if (!token || !currentUser) {
    return (
      <div
        className="gemini-app"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "430px",
            padding: "34px",
            borderRadius: "28px",
            background:
              "var(--surface, rgba(255,255,255,0.96))",
            boxShadow:
              "0 18px 60px rgba(0,0,0,0.12)"
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "28px"
            }}
          >
            <div
              style={{
                fontSize: "38px",
                marginBottom: "10px"
              }}
            >
              ✦
            </div>

            <div
              style={{
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.5px"
              }}
            >
              Query<span>AI</span>
            </div>

            <p
              style={{
                marginTop: "8px",
                opacity: 0.65
              }}
            >
              {authMode === "login"
                ? "Sign in to continue"
                : "Create your QueryAI account"}
            </p>
          </div>

          {authError && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "12px",
                background: "rgba(220, 70, 70, 0.10)",
                color: "inherit",
                fontSize: "14px"
              }}
            >
              {authError}
            </div>
          )}

          <form onSubmit={submitAuth}>
            {authMode === "signup" && (
              <input
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm((prev) => ({
                    ...prev,
                    name: e.target.value
                  }))
                }
                placeholder="Full name"
                autoComplete="name"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "14px 16px",
                  marginBottom: "12px",
                  borderRadius: "14px",
                  border: "1px solid var(--border, #ddd)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "15px"
                }}
              />
            )}

            <input
              type="email"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm((prev) => ({
                  ...prev,
                  email: e.target.value
                }))
              }
              placeholder="Email"
              autoComplete="email"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 16px",
                marginBottom: "12px",
                borderRadius: "14px",
                border: "1px solid var(--border, #ddd)",
                background: "transparent",
                color: "inherit",
                fontSize: "15px"
              }}
            />

            <input
              type="password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm((prev) => ({
                  ...prev,
                  password: e.target.value
                }))
              }
              placeholder="Password"
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 16px",
                marginBottom: "18px",
                borderRadius: "14px",
                border: "1px solid var(--border, #ddd)",
                background: "transparent",
                color: "inherit",
                fontSize: "15px"
              }}
            />

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "14px",
                padding: "14px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: authLoading
                  ? "default"
                  : "pointer",
                opacity: authLoading ? 0.65 : 1
              }}
            >
              {authLoading
                ? "Please wait..."
                : authMode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "14px"
            }}
          >
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === "login"
                    ? "signup"
                    : "login"
                );
                setAuthError("");
              }}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 600,
                marginLeft: "6px"
              }}
            >
              {authMode === "login"
                ? "Sign up"
                : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gemini-app">


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`sidebar ${
          sidebarOpen
            ? "open"
            : "closed"
        }`}
      >

        <div className="sidebar-top">

          <button
            className="menu-button"
            onClick={() =>
              setSidebarOpen(
                !sidebarOpen
              )
            }
            title={
              sidebarOpen
                ? "Close sidebar"
                : "Open sidebar"
            }
          >
            ☰
          </button>


          {sidebarOpen && (
            <div className="logo-text">
              Query<span>AI</span>
            </div>
          )}

        </div>


        {sidebarOpen && (
          <>

            {/* NEW CHAT */}

            <button
              className="new-chat"
              onClick={newChat}
            >
              <span className="new-chat-icon">
                ＋
              </span>

              <span>
                New chat
              </span>
            </button>


            {/* RECENT */}

            <div className="recent-title">
              Recent
            </div>


            <div className="history">

              {conversations.length === 0 ? (

                <div className="empty-history">
                  Your recent queries
                  will appear here.
                </div>

              ) : (

                conversations
                  .slice(0, 20)
                  .map((item) => {

                    const title =
                      item.title ||
                      item.question ||
                      "New conversation";


                    if (
                      editingConversation ===
                      item.conversation_id
                    ) {

                      return (
                        <div
                          className="history-edit"
                          key={
                            item.conversation_id
                          }
                        >

                          <input
                            autoFocus
                            value={
                              editingTitle
                            }
                            onChange={(e) =>
                              setEditingTitle(
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleRenameKeyDown(
                                e,
                                item.conversation_id
                              )
                            }
                            maxLength={100}
                          />

                          <div className="history-edit-actions">

                            <button
                              onClick={() =>
                                saveRename(
                                  item.conversation_id
                                )
                              }
                              title="Save"
                            >
                              ✓
                            </button>

                            <button
                              onClick={
                                cancelRename
                              }
                              title="Cancel"
                            >
                              ×
                            </button>

                          </div>

                        </div>
                      );
                    }


                    return (
                      <div
                        className={`history-item-wrap ${
                          activeConversation?.conversation_id ===
                          item.conversation_id
                            ? "active"
                            : ""
                        }`}
                        key={
                          item.conversation_id
                        }
                      >

                        <button
                          className={`history-item ${
                            activeConversation?.conversation_id ===
                            item.conversation_id
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            loadConversation(
                              item.conversation_id
                            )
                          }
                        >

                          <span className="history-icon">
                            ◌
                          </span>

                          <span className="history-question">
                            {title}
                          </span>

                        </button>


                        <div className="history-actions">

                          <button
                            onClick={(e) => {
                              e.stopPropagation();

                              startRename(
                                item
                              );
                            }}
                            title="Rename"
                          >
                            ⋯
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();

                              deleteConversation(
                                item.conversation_id
                              );
                            }}
                            title="Delete"
                          >
                            ×
                          </button>

                        </div>

                      </div>
                    );
                  })

              )}

            </div>


            {/* SIDEBAR BOTTOM */}

            <div className="sidebar-bottom">

              <div className="sidebar-item">
                <span>?</span>
                Help
              </div>

              <div className="sidebar-item">
                <span>◉</span>
                QueryAI
              </div>

            </div>

          </>
        )}

      </aside>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="main-area">


        {/* HEADER */}

        <header className="header">

          <div className="header-left">

            {!sidebarOpen && (
              <button
                className="header-menu"
                onClick={() =>
                  setSidebarOpen(true)
                }
                title="Open sidebar"
              >
                ☰
              </button>
            )}

            <button className="model-button">
              QueryAI
              <span>⌄</span>
            </button>

          </div>


          <div className="header-right">

            <button
              className="theme-toggle"
              onClick={() =>
                setTheme(
                  theme === "light"
                    ? "dark"
                    : "light"
                )
              }
              title="Toggle theme"
            >
              {theme === "light"
                ? "☾"
                : "☀"}
            </button>

            <div
              className="profile-menu-wrap"
              ref={profileMenuRef}
            >
              <button
                className={`profile ${
                  profileMenuOpen ? "active" : ""
                }`}
                title="Open profile menu"
                onClick={() =>
                  setProfileMenuOpen((open) => !open)
                }
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                {profileInitial}
              </button>

              {profileMenuOpen && (
                <div
                  className="profile-dropdown"
                  role="menu"
                >
                  <div className="profile-dropdown-head">
                    <div className="profile-dropdown-avatar">
                      {profileInitial}
                    </div>

                    <div className="profile-dropdown-user">
                      <strong>{profileName}</strong>
                      <span>{profileEmail}</span>
                    </div>
                  </div>

                  <button
                    className="profile-menu-item"
                    onClick={openProfileModal}
                    role="menuitem"
                  >
                    <span className="profile-menu-icon profile-icon"></span>
                    View profile
                  </button>

                  <button
                    className="profile-menu-item danger"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    <span className="profile-menu-icon logout-icon"></span>
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>

        </header>


        {profileModalOpen && (
          <div
            className="profile-modal-backdrop"
            onClick={() =>
              setProfileModalOpen(false)
            }
          >
            <section
              className="profile-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-title"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="profile-modal-head">
                <div className="profile-modal-avatar">
                  {profileInitial}
                </div>

                <div>
                  <h3 id="profile-title">
                    My profile
                  </h3>
                  <p>
                    Your QueryAI account details
                  </p>
                </div>

                <button
                  className="profile-modal-close"
                  onClick={() =>
                    setProfileModalOpen(false)
                  }
                  title="Close profile"
                >
                  ×
                </button>
              </div>

              <div className="profile-detail-list">
                <div className="profile-detail">
                  <span>Name</span>
                  <strong>{profileName}</strong>
                </div>

                <div className="profile-detail">
                  <span>Email</span>
                  <strong>{profileEmail}</strong>
                </div>

                <div className="profile-detail">
                  <span>User ID</span>
                  <strong>{profileId}</strong>
                </div>

                <div className="profile-detail">
                  <span>Member since</span>
                  <strong>{profileCreatedAt}</strong>
                </div>
              </div>

              <div className="profile-modal-actions">
                <button
                  className="profile-secondary-action"
                  onClick={() =>
                    setProfileModalOpen(false)
                  }
                >
                  Close
                </button>

                <button
                  className="profile-logout-action"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </section>
          </div>
        )}


        {/* CONTENT */}

        <section className="content">

          {messages.length === 0 ? (

            <div className="welcome-screen">

              <div className="gemini-mark">
                ✦
              </div>

              <h1>
                Hello, {currentUser?.name || "there"}
              </h1>

              <h2>
                What can I help you find?
              </h2>

              <p className="welcome-description">
                Ask questions about your
                database in natural language.
              </p>


              <div className="suggestions">

                <button
                  onClick={() =>
                    askQuestion(
                      "How many customers signed up in July 2026?"
                    )
                  }
                >

                  <div className="suggestion-icon">
                    ◉
                  </div>

                  <div>

                    <strong>
                      Customer analytics
                    </strong>

                    <span>
                      How many customers
                      signed up in July?
                    </span>

                  </div>

                </button>


                <button
                  onClick={() =>
                    askQuestion(
                      "Show customers with total order amount greater than 10000"
                    )
                  }
                >

                  <div className="suggestion-icon">
                    ◈
                  </div>

                  <div>

                    <strong>
                      Order analysis
                    </strong>

                    <span>
                      Customers with orders
                      above ₹10,000
                    </span>

                  </div>

                </button>


                <button
                  onClick={() =>
                    askQuestion(
                      "Show total revenue for each customer"
                    )
                  }
                >

                  <div className="suggestion-icon">
                    ◇
                  </div>

                  <div>

                    <strong>
                      Revenue analysis
                    </strong>

                    <span>
                      Show total revenue
                      for each customer
                    </span>

                  </div>

                </button>


                <button
                  onClick={() =>
                    askQuestion(
                      "Show customers who placed more than 2 orders"
                    )
                  }
                >

                  <div className="suggestion-icon">
                    △
                  </div>

                  <div>

                    <strong>
                      Order history
                    </strong>

                    <span>
                      Customers with more
                      than 2 orders
                    </span>

                  </div>

                </button>

              </div>

            </div>

          ) : (

            <div className="chat-container">

              {messages.map(
                (message, index) => (

                  <div key={index}>


                    {/* USER */}

                    {message.type ===
                      "user" && (

                      <div className="user-row">

                        <div className="user-avatar">
                          H
                        </div>

                        <div className="user-text">
                          {message.content}
                        </div>

                      </div>

                    )}


                    {/* OLD CLARIFICATION */}

                    {message.type ===
                      "clarification_history" && (

                      <div className="ai-row">

                        <div className="ai-mark">
                          ✦
                        </div>

                        <div className="ai-content">

                          <div className="ai-name">
                            QueryAI
                          </div>

                          <div className="clarification">

                            <p>
                              {message.question}
                            </p>

                            <div className="clarification-options">

                              {message.options.map(
                                (
                                  option,
                                  optionIndex
                                ) => (

                                  <button
                                    key={
                                      optionIndex
                                    }
                                    disabled
                                    className={
                                      message.answer ===
                                      option
                                        ? "selected-option"
                                        : ""
                                    }
                                  >

                                    {option}

                                    {message.answer ===
                                      option && (
                                      <span>
                                        ✓
                                      </span>
                                    )}

                                  </button>

                                )
                              )}

                            </div>

                          </div>

                        </div>

                      </div>

                    )}


                    {/* NEW CLARIFICATION */}

                    {message.type ===
                      "clarification" && (

                      <div className="ai-row">

                        <div className="ai-mark">
                          ✦
                        </div>

                        <div className="ai-content">

                          <div className="ai-name">
                            QueryAI
                          </div>

                          <div className="clarification">

                            <p>
                              {message.question}
                            </p>

                            <div className="clarification-options">

                              {message.options.map(
                                (
                                  option,
                                  optionIndex
                                ) => (

                                  <button
                                    key={
                                      optionIndex
                                    }
                                    disabled={
                                      loading
                                    }
                                    onClick={() =>
                                      submitClarification(
                                        message.conversationId,
                                        option
                                      )
                                    }
                                  >
                                    {option}
                                  </button>

                                )
                              )}

                            </div>

                          </div>

                        </div>

                      </div>

                    )}


                    {/* RESULT */}

                    {message.type ===
                      "result" && (

                      <div className="ai-row">

                        <div className="ai-mark">
                          ✦
                        </div>

                        <div className="ai-content">

                          <div className="ai-name">
                            QueryAI
                          </div>

                          <div className="answer-text">
                            Here's what I found:
                          </div>


                          {/* RESULT BOX */}

                          <div className="result-box">

                            <div className="result-box-header">

                              <div>

                                <strong>
                                  Query Result
                                </strong>

                                <span>
                                  Database response
                                </span>

                              </div>

                              <div className="success">
                                ✓ Success
                              </div>

                            </div>


                            {renderTable(
                              message.result,
                              index
                            )}

                          </div>


                          {/* SQL */}

                          <details className="sql-details">

                            <summary>

                              <span>
                                Generated SQL
                              </span>

                              <span>
                                ▾
                              </span>

                            </summary>


                            <div className="sql-content">

                              <div className="sql-top">

                                <span>
                                  PostgreSQL
                                </span>

                                <div className="sql-actions">

                                  <span>
                                    ✓ Validated
                                  </span>

                                  <button
                                    className="copy-button"
                                    onClick={(e) => {
                                      e.preventDefault();

                                      copySQL(
                                        message.sql,
                                        index
                                      );
                                    }}
                                  >
                                    {copiedSQL ===
                                    index
                                      ? "✓ Copied"
                                      : "⧉ Copy"}
                                  </button>

                                </div>

                              </div>


                              <pre>
                                {message.sql}
                              </pre>

                            </div>

                          </details>

                        </div>

                      </div>

                    )}


                    {/* ERROR */}

                    {message.type ===
                      "error" && (

                      <div className="ai-row">

                        <div className="ai-mark error-mark">
                          !
                        </div>

                        <div className="ai-content">

                          <div className="error-message">

                            <strong>
                              Unable to complete
                              the query
                            </strong>

                            <p>
                              {message.content}
                            </p>


                            {message.retryQuestion && (
                              <button
                                className="retry-button"
                                disabled={loading}
                                onClick={() =>
                                  retryQuestion(
                                    message.retryQuestion
                                  )
                                }
                              >
                                ↻ Retry
                              </button>
                            )}

                          </div>

                        </div>

                      </div>

                    )}

                  </div>

                )
              )}


              {/* LOADING */}

              {loading && (

                <div className="ai-row">

                  <div className="ai-mark">
                    ✦
                  </div>

                  <div className="ai-content">

                    <div className="ai-name">
                      QueryAI
                    </div>

                    <div className="loading-text">

                      <span></span>
                      <span></span>
                      <span></span>

                    </div>

                  </div>

                </div>

              )}

              <div
                ref={chatEndRef}
                className="chat-end"
              />

            </div>

          )}

        </section>


        {/* INPUT */}

        <div className="input-area">

          <div className="prompt-box">

            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) =>
                setQuestion(
                  e.target.value
                )
              }
              onKeyDown={handleKeyDown}
              placeholder="Ask QueryAI"
              disabled={loading}
              rows={1}
            />


            <div className="prompt-actions">

              <button
                className="add-button"
                onClick={() =>
                  inputRef.current?.focus()
                }
              >
                ＋
              </button>

              <div className="prompt-spacer"></div>

              <button
                className="send-button"
                disabled={
                  !question.trim() ||
                  loading
                }
                onClick={() =>
                  askQuestion()
                }
              >
                ↑
              </button>

            </div>

          </div>


          <div className="input-footer">
            QueryAI can make mistakes.
            Check important information.
          </div>

        </div>

      </main>

    </div>
  );
}


export default App;
