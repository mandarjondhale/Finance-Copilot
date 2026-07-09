"use client";
import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cr(v) {
  if (v == null) return "—";
  if (v >= 100000) return `₹${(v/100000).toFixed(1)}L Cr`;
  if (v >= 1000)   return `₹${(v/1000).toFixed(1)}K Cr`;
  return `₹${v.toFixed(1)} Cr`;
}

function pct(v, decimals = 1) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function num(v, decimals = 2) {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function changeColor(v) {
  if (v == null) return "text-gray-500";
  return v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "text-gray-500";
}

// ── Small UI pieces ───────────────────────────────────────────────────────────

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Metric({ label, value, sub, color }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-sm font-bold ${color || "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ScoreBar({ label, score, max, color }) {
  const pctWidth = Math.round((score / max) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{score}/{max}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pctWidth}%`, transition: "width 0.6s ease" }}
        />
      </div>
    </div>
  );
}

function Flag({ text, type }) {
  return (
    <div className={`flex gap-2 items-start text-xs py-1.5 px-3 rounded-lg mb-1
      ${type === "good" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
      <span>{type === "good" ? "✓" : "⚠"}</span>
      <span>{text}</span>
    </div>
  );
}

function Check({ label, passed }) {
  return (
    <div className="flex items-center gap-2 text-xs py-1">
      <span className={passed ? "text-emerald-500" : "text-red-400"}>{passed ? "✓" : "✗"}</span>
      <span className={passed ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </div>
  );
}

// ── Authentication Screen ─────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [mode,     setMode]     = useState("login");   // "login" | "signup"
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [verifyMsg, setVerifyMsg] = useState(""); // <-- New state for email message

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (mode === "signup" && !name.trim()) return;
    setLoading(true); setError(""); setVerifyMsg("");

    const endpoint = mode === "signup"
      ? `${API}/api/auth/signup`
      : `${API}/api/auth/login`;

    try {
      const res  = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Something went wrong");

      // --- THE NEW VERIFICATION LOGIC ---
      if (mode === "signup") {
        setVerifyMsg("Account created! Please check your email for the verification link, then log in.");
        setMode("login"); // Switch back to login mode so they can sign in after clicking the link
        setPassword("");  // Clear the password field for security
        return;           // Stop here! Do not log them in yet.
      }

      // If they are logging in normally, proceed:
      localStorage.setItem("fc_user",  JSON.stringify(json.data));
      localStorage.setItem("fc_token", json.token || "");
      onLogin(json.data);
      
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center w-full py-8">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">Sign in to track your portfolio</p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {["login","signup"].map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(""); setVerifyMsg(""); }}
              className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors
                ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Full name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Mandar Jondhale"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"/>
          </div>
          
          {/* Validation Messages */}
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>}
          {verifyMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2">{verifyMsg}</div>}
          
          <button type="submit" disabled={loading}
            className="w-full bg-teal-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors mt-1">
            {loading ? "Please wait…" : mode === "login" ? "Log in →" : "Create account →"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          {mode === "login" ? "No account? " : "Already have one? "}
          <button type="button" onClick={() => { setMode(mode==="login"?"signup":"login"); setError(""); setVerifyMsg(""); }}
            className="text-teal-600 hover:underline font-medium">
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Interactive Charts ────────────────────────────────────────────────────────

function StockPriceChart({ history }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current || !history) return;
    const Chart = require("chart.js/auto");
    
    const sortedDates = Object.keys(history).sort();
    const dataPoints = sortedDates.map(d => history[d]);
    
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: sortedDates.map(d => {
          const dateObj = new Date(d);
          return dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        }),
        datasets: [{
          label: "Price (₹)",
          data: dataPoints,
          borderColor: "#0f766e",
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 5,
          tension: 0.2,
          fill: "origin",
          backgroundColor: "rgba(15, 118, 110, 0.05)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } }
        }
      }
    });
    return () => chart.destroy();
  }, [history]);

  return (
    <div className="w-full h-64 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-3">30-Day Price Trend</span>
      <div className="w-full h-48">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function MFNavChart({ history }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current || !history) return;
    const Chart = require("chart.js/auto");
    
    const sortedDates = Object.keys(history).sort((a, b) => {
      const partsA = a.split("-");
      const partsB = b.split("-");
      const dateA = new Date(partsA[2], partsA[1]-1, partsA[0]);
      const dateB = new Date(partsB[2], partsB[1]-1, partsB[0]);
      return dateA - dateB;
    });
    const dataPoints = sortedDates.map(d => history[d]);
    
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: sortedDates,
        datasets: [{
          label: "NAV (₹)",
          data: dataPoints,
          borderColor: "#0284c7",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.2,
          fill: true,
          backgroundColor: "rgba(2, 132, 199, 0.05)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
          y: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } }
        }
      }
    });
    return () => chart.destroy();
  }, [history]);

  return (
    <div className="w-full h-64 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-3">NAV Performance History</span>
      <div className="w-full h-48">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function PortfolioHistoryChart({ history }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current || !history || history.length === 0) return;
    const Chart = require("chart.js/auto");
    
    const sorted = [...history].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    
    const labels = sorted.map(s => {
      const dateObj = new Date(s.snapshot_date);
      return dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    });
    const totalValues = sorted.map(s => s.total_value);
    const totalInvested = sorted.map(s => s.total_invested);
    
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total Value (₹)",
            data: totalValues,
            borderColor: "#0d9488",
            backgroundColor: "rgba(13, 148, 136, 0.05)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
          },
          {
            label: "Total Invested (₹)",
            data: totalInvested,
            borderColor: "#94a3b8",
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } }
        }
      }
    });
    return () => chart.destroy();
  }, [history]);

  if (!history || history.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 text-center text-xs text-gray-400">
        Balance snapshot history will display here once daily portfolio changes are recorded.
      </div>
    );
  }

  return (
    <div className="w-full h-64 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Portfolio Performance History</div>
      <div className="w-full h-48">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// ── Broker Connection Dialog ─────────────────────────────────────────────────

function BrokerConnectModal({ broker, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1 = Login details, 2 = OTP verification
  const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const brokerNames = {
    zerodha: "Zerodha (Kite)",
    angelone: "Angel One (SmartAPI)",
    groww: "Groww",
    upstox: "Upstox"
  };

  async function handleRequestOtp(e) {
    e.preventDefault();
    if (!clientId) return setError("Please enter your Client ID or Registered Mobile.");
    setLoading(true);
    setError("");
    
    // Simulate API request to broker gateway
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1200);
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp || otp.length < 4) return setError("Please enter a valid OTP.");
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("fc_token");
      const redirectUri = window.location.origin + "/api/portfolio/broker/callback/" + broker;
      
      // Step A: Request the Redirect/Simulation URL from FastAPI
      const loginUrlRes = await fetch(`${API}/api/portfolio/broker/login/${broker}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ redirect_uri: redirectUri })
      });
      const loginUrlJson = await loginUrlRes.json();
      if (!loginUrlRes.ok) throw new Error(loginUrlJson.detail || "Failed to fetch login URL");

      // Step B: Trigger Callback logic in backend with mock token to link account
      const callbackRes = await fetch(`${API}/api/portfolio/broker/callback/${broker}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          request_token: "mock_success_token_" + Math.random().toString(36).substring(7),
          redirect_uri: redirectUri
        })
      });
      const callbackJson = await callbackRes.json();
      if (!callbackRes.ok) throw new Error(callbackJson.detail || "Failed to link holdings");

      onSuccess(callbackJson.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 font-bold text-lg">×</button>
        
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">Connect to {brokerNames[broker]}</h3>
          <p className="text-xs text-gray-400 mt-1">Establishing a secure connection with your broker portal</p>
        </div>

        {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Client ID / Mobile Number</label>
              <input value={clientId} onChange={e => setClientId(e.target.value)}
                placeholder="e.g. AB1234 or 9876543210"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Password / PIN</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-teal-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors mt-2">
              {loading ? "Authenticating..." : "Verify & Send OTP →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Verification OTP</label>
              <input value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP code"
                className="w-full text-center tracking-widest border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold" maxLength={6} required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors mt-2">
              {loading ? "Syncing Holdings..." : "Confirm & Import Holdings"}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs text-teal-600 mt-2 font-medium">← Back</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Portfolio Upload & Analysis Tab ──────────────────────────────────────────

function PortfolioTab({ user }) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeBroker, setActiveBroker] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  function MiniSparkline({ up }) {
    const ref = useRef(null);
    
    useEffect(() => {
      if (!ref.current) return;
      const Chart = require("chart.js/auto");
      const data = up ? [10,12,11,14,13,16,18,20] : [20,18,19,16,17,14,12,10];
      const chart = new Chart(ref.current, {
        type: "line",
        data: {
          labels: data.map((_,i)=>i),
          datasets: [{
            data,
            borderColor: up ? "#10b981" : "#ef4444",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.4,
          }],
        },
        options: {
          responsive: false,
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } },
        },
      });
      return () => chart.destroy();
    }, [up]);

    return <canvas ref={ref} width={50} height={24} className="shrink-0 ml-2" />;
  }

  useEffect(() => {
    async function fetchHistory() {
      const token = localStorage.getItem("fc_token");
      if (!token) return;
      try {
        const res = await fetch(`${API}/api/portfolio/history`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setHistoryData(json.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch portfolio history:", err);
      }
    }
    if (data) {
      fetchHistory();
    }
  }, [data]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("fc_token");
      const res = await fetch(`${API}/api/portfolio/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Upload failed");
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const brokers = [
    { id: "zerodha", name: "Zerodha Kite", desc: "Connect Kite account to import your stock holdings", color: "from-orange-500 to-red-600", logo: "Z" },
    { id: "angelone", name: "Angel One", desc: "Connect Angel One account using SmartAPI gateway", color: "from-blue-500 to-indigo-600", logo: "A" },
    { id: "groww", name: "Groww", desc: "Connect Groww account using registered credentials", color: "from-emerald-400 to-teal-600", logo: "G" },
    { id: "upstox", name: "Upstox", desc: "Connect Upstox account to sync holdings securely", color: "from-purple-500 to-indigo-700", logo: "U" }
  ];

  if (!data) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Connect Stock Broker Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {brokers.map(b => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center text-white font-bold text-lg mb-3 shadow-sm`}>
                    {b.logo}
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{b.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{b.desc}</p>
                </div>
                <button onClick={() => setActiveBroker(b.id)}
                  className="mt-4 w-full bg-gray-50 border border-gray-200 hover:border-teal-600 hover:bg-teal-50 text-gray-700 hover:text-teal-700 font-medium py-2 rounded-xl text-xs transition-colors">
                  Link Account
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Or</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <Card title="Upload Holdings CSV File">
          <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-4">
            <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer" />
            <button type="submit" disabled={loading || !file}
              className="w-full sm:w-auto bg-teal-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap transition-colors">
              {loading ? "Analyzing..." : "Upload & Analyze"}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            Upload the standard holdings CSV exported from Zerodha Kite, Groww, Angel One, or Upstox. Column headers are automatically recognized.
          </p>
          {error && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">⚠ {error}</div>}
        </Card>

        {activeBroker && (
          <BrokerConnectModal
            broker={activeBroker}
            onClose={() => setActiveBroker(null)}
            onSuccess={(holdingsData) => {
              setData(holdingsData);
              setActiveBroker(null);
            }}
          />
        )}
      </div>
    );
  }

  const { stocks, analysis } = data;
  const totalInvested = stocks.reduce((sum, row) => sum + row.invested, 0);
  const totalValue = stocks.reduce((sum, row) => sum + row.current_value, 0);
  const totalPnL = totalValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const sortedSectors = Object.entries(analysis.sectors || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Header Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Metric label="Total Invested" value={`₹${totalInvested.toFixed(2)}`} />
        <Metric label="Current Value" value={`₹${totalValue.toFixed(2)}`} />
        <Metric label="Overall P&L" value={`${totalPnL >= 0 ? '+' : ''}₹${totalPnL.toFixed(2)} (${totalPnLPct.toFixed(2)}%)`}
                color={totalPnL >= 0 ? "text-emerald-600" : "text-red-500"} />
      </div>

      {/* Historical Performance Chart */}
      {historyData.length > 0 && (
        <PortfolioHistoryChart history={historyData} />
      )}

      {/* 2. Deep Analysis */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Portfolio Health">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Weighted P/E Ratio</span>
                <span className="font-bold text-gray-900">{analysis.avg_pe}</span>
              </div>
              <div className="text-xs text-gray-400">
                {analysis.avg_pe > 30 ? "⚠ High Valuation (Expensive)" : analysis.avg_pe > 15 ? "✓ Fair Valuation" : "✓ Low Valuation (Value)"}
              </div>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <ScoreBar 
                label="Avg Piotroski F-Score (Fundamental Quality)" 
                score={analysis.avg_fscore} max={9} 
                color={analysis.avg_fscore >= 7 ? "bg-emerald-500" : analysis.avg_fscore >= 4 ? "bg-amber-400" : "bg-red-400"} 
              />
              <div className="text-xs text-gray-400 text-right mt-1 font-medium">Score of 8-9 indicates strong fundamentals.</div>
            </div>
          </div>
        </Card>

        <Card title="Sector Diversification">
          <div className="space-y-2.5">
            {sortedSectors.map(([sector, pct]) => (
              <div key={sector}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{sector}</span>
                  <span className="text-gray-500">{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 3. The Ledger */}
      <Card title="Your Holdings">
        <div className="flex flex-col gap-1">
          {stocks.map(row => {
            const initials = row.ticker.substring(0, 2).toUpperCase();
            const isUp = row.pnl_pct >= 0;

            return (
              <div key={row.ticker} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0
                  ${isUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {initials}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{row.ticker}</div>
                  <div className="text-xs text-gray-400">
                    {row.shares || '-'} shares · avg ₹{row.buy_price ? row.buy_price.toFixed(2) : '-'} · {row.sector}
                  </div>
                </div>
                
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-gray-900">₹{row.current_value.toFixed(2)}</div>
                  <div className={`text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isUp ? '+' : ''}{row.pnl_pct.toFixed(1)}%
                  </div>
                </div>
                
                <MiniSparkline up={isUp} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="text-center">
        <button onClick={() => setData(null)} className="text-sm font-medium text-teal-600 hover:text-teal-700">
          Disconnect Portfolio / Change Broker
        </button>
      </div>
    </div>
  );

}

// ── Main analysis dashboard ───────────────────────────────────────────────────

function StockDashboard({ data }) {
  const { company_name, ticker, price, fundamentals: fin, technicals: tech, piotroski, verdict } = data;
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [subTab, setSubTab] = useState("overview"); // "overview" | "financials" | "technicals" | "ai"

  async function loadAiSummary() {
    setAiLoading(true);
    try {
      const res  = await fetch(`${API}/api/stock/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, analysis_data: data }),
      });
      const json = await res.json();
      setAiSummary(json.summary || json.note);
    } catch { setAiSummary("AI summary unavailable."); }
    finally { setAiLoading(false); }
  }

  const overallColor =
    verdict.overall.includes("Strong Buy") ? "bg-emerald-500" :
    verdict.overall.includes("Moderate")   ? "bg-teal-500" :
    verdict.overall.includes("Neutral")    ? "bg-gray-400" :
    verdict.overall.includes("Caution")    ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Stock Main Header Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{company_name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{ticker} · {fin.sector || "—"} · {fin.industry || "—"}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">₹{price.current_price}</div>
            <div className={`text-sm font-medium mt-0.5 ${changeColor(price.change_1d_pct)}`}>
              {pct(price.change_1d_pct)} today
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-gray-100">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-white text-xs font-bold ${overallColor} shadow-sm`}>
            {verdict.overall}
          </div>
          <div className="flex gap-1.5 ml-auto">
            {["1D", "1M", "6M", "1Y"].map((label, idx) => {
              const vals = [price.change_1d_pct, price.change_1m_pct, price.change_6m_pct, price.change_1y_pct];
              return (
                <div key={label} className="text-center px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg">
                  <span className="text-[10px] text-gray-400 font-semibold block">{label}</span>
                  <span className={`text-xs font-bold ${changeColor(vals[idx])}`}>{pct(vals[idx])}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {["overview", "financials", "technicals", "ai"].map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors capitalize
              ${subTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "ai" ? "AI Advisor" : t}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {subTab === "overview" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {price.price_history_30d && (
            <StockPriceChart history={price.price_history_30d} />
          )}

          {(verdict.flags.length > 0 || verdict.warnings.length > 0) && (
            <Card title="Key signals">
              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2">Strengths & Opportunities</h4>
                  {verdict.flags.length > 0 ? verdict.flags.map((f, i) => <Flag key={i} text={f} type="good" />) : <p className="text-xs text-gray-400">No positive flags detected.</p>}
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2">Risk Alerts & Warnings</h4>
                  {verdict.warnings.length > 0 ? verdict.warnings.map((w, i) => <Flag key={i} text={w} type="warn" />) : <p className="text-xs text-gray-400">No warning flags detected.</p>}
                </div>
              </div>
            </Card>
          )}

          {fin.description && (
            <Card title="Business Summary">
              <p className="text-xs text-gray-500 leading-relaxed">{fin.description}...</p>
            </Card>
          )}
        </div>
      )}

      {subTab === "financials" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Valuation Metrics">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="P/E (TTM)" value={num(fin.pe_ratio, 1)} sub="Price / Earnings" />
                <Metric label="Forward P/E" value={num(fin.forward_pe, 1)} />
                <Metric label="P/B" value={num(fin.pb_ratio, 1)} sub="Price / Book" />
                <Metric label="EV/EBITDA" value={num(fin.ev_ebitda, 1)} />
                <Metric label="P/S" value={num(fin.ps_ratio, 1)} />
                <Metric label="PEG" value={num(fin.peg_ratio, 1)} />
              </div>
            </Card>

            <Card title="Profitability Ratios">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="ROE" value={fin.roe_pct != null ? `${fin.roe_pct}%` : "—"}
                  color={fin.roe_pct > 15 ? "text-emerald-600" : fin.roe_pct < 8 ? "text-red-500" : "text-gray-900"} />
                <Metric label="ROCE" value={fin.roce_pct != null ? `${fin.roce_pct}%` : "—"} />
                <Metric label="Net Margin" value={fin.net_margin_pct != null ? `${fin.net_margin_pct}%` : "—"} />
                <Metric label="Op Margin" value={fin.op_margin_pct != null ? `${fin.op_margin_pct}%` : "—"} />
                <Metric label="Gross Margin" value={fin.gross_margin_pct != null ? `${fin.gross_margin_pct}%` : "—"} />
                <Metric label="Free Cash Flow" value={cr(fin.free_cashflow_cr)} />
              </div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Growth Performance">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Revenue Growth YoY" value={pct(fin.revenue_growth_yoy_pct)}
                  color={changeColor(fin.revenue_growth_yoy_pct)} />
                <Metric label="Profit Growth YoY" value={pct(fin.profit_growth_yoy_pct)}
                  color={changeColor(fin.profit_growth_yoy_pct)} />
                <Metric label="EPS" value={fin.eps != null ? `₹${fin.eps.toFixed(2)}` : "—"} />
                <Metric label="Dividend Yield" value={fin.dividend_yield != null ? `${fin.dividend_yield}%` : "—"} />
              </div>
            </Card>

            <Card title="Balance Sheet Health">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Debt / Equity" value={num(fin.debt_to_equity, 2)}
                  color={fin.debt_to_equity > 1.5 ? "text-red-500" : "text-emerald-600"} />
                <Metric label="Current Ratio" value={num(fin.current_ratio, 2)}
                  color={fin.current_ratio > 1 ? "text-emerald-600" : "text-red-500"} />
                <Metric label="Quick Ratio" value={num(fin.quick_ratio, 2)} />
                <Metric label="Market Capitalization" value={cr(fin.market_cap_cr)} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {subTab === "technicals" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Card title="Technical Analysis Signals">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <ScoreBar
                  label="Technical Momentum"
                  score={tech.technical_score}
                  max={100}
                  color={tech.technical_score >= 60 ? "bg-emerald-500" : tech.technical_score >= 40 ? "bg-amber-400" : "bg-red-400"}
                />
                <div className="text-xs font-semibold text-gray-700 mt-2">{tech.technical_verdict}</div>
                <div className="mt-4 space-y-1 text-xs">
                  <Check label={`Price above 20-day Moving Average`} passed={tech.moving_averages?.above_ma20} />
                  <Check label={`Price above 50-day Moving Average`} passed={tech.moving_averages?.above_ma50} />
                  <Check label={`Price above 200-day Moving Average`} passed={tech.moving_averages?.above_ma200} />
                  <Check label="Golden Cross (Bullish MA crossover)" passed={tech.moving_averages?.golden_cross} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <span className="text-xs font-medium text-gray-500">RSI (14-day)</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{tech.rsi?.value}</span>
                    <span className={`ml-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                      tech.rsi?.signal === "oversold" ? "bg-emerald-100 text-emerald-700" :
                      tech.rsi?.signal === "overbought" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{tech.rsi?.signal}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <span className="text-xs font-medium text-gray-500">Bollinger Bands</span>
                  <span className="text-xs font-bold text-gray-700 capitalize">{tech.bollinger_bands?.signal?.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <span className="text-xs font-medium text-gray-500">MACD Crossover</span>
                  <span className={`text-xs font-bold capitalize ${tech.macd?.signal === 'bullish' ? 'text-emerald-600' : 'text-red-500'}`}>{tech.macd?.signal}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Piotroski Quality Scoring">
            <ScoreBar
              label={`Quality Score: ${piotroski.score}/9`}
              score={piotroski.score}
              max={9}
              color={piotroski.score >= 7 ? "bg-emerald-500" : piotroski.score >= 4 ? "bg-amber-400" : "bg-red-400"}
            />
            <div className="text-xs font-semibold text-gray-700 mt-2 mb-4">{piotroski.verdict}</div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
              {piotroski.checks && Object.keys(piotroski.checks).map(checkKey => (
                <Check key={checkKey} label={checkKey} passed={piotroski.checks[checkKey]} />
              ))}
            </div>
          </Card>
        </div>
      )}

      {subTab === "ai" && (
        <Card title="AI Analyst Briefing (Google Gemini)">
          {aiSummary ? (
            <p className="text-sm text-gray-700 leading-relaxed font-medium">{aiSummary}</p>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-gray-400 mb-4">Click below to synthesize financial statements and technical charts into a brief briefing.</p>
              <button onClick={loadAiSummary} disabled={aiLoading}
                className="inline-flex items-center bg-teal-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm">
                {aiLoading ? "Generating Briefing…" : "Synthesize AI Summary"}
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Mutual Fund tab ───────────────────────────────────────────────────────────

function MutualFundTab() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [mfData, setMfData]     = useState(null);
  const [loading, setLoading]   = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/mf/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      setResults(json.data || []);
    } finally { setLoading(false); }
  }

  async function loadFund(code) {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/mf/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheme_code: code }),
      });
      const json = await res.json();
      setMfData(json.data);
      setResults([]);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Search MF e.g. HDFC Flexi Cap, Parag Parikh"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        <button onClick={search} disabled={loading}
          className="bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {loading ? "…" : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
          {results.map(f => (
            <button key={f.scheme_code} onClick={() => loadFund(f.scheme_code)}
              className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 text-sm last:border-0">
              <span className="text-gray-700">{f.scheme_name}</span>
            </button>
          ))}
        </div>
      )}

      {mfData && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <Card title={mfData.scheme_name}>
            <div className="mb-2 text-xs text-gray-400">{mfData.fund_house} · {mfData.category}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Metric label="Current NAV" value={`₹${mfData.current_nav?.toFixed(4)}`} />
              <Metric label="1 Month"  value={pct(mfData.returns?.["1_month_pct"])} color={changeColor(mfData.returns?.["1_month_pct"])} />
              <Metric label="6 Month"  value={pct(mfData.returns?.["6_month_pct"])} color={changeColor(mfData.returns?.["6_month_pct"])} />
              <Metric label="1 Year"   value={pct(mfData.returns?.["1_year_pct"])} color={changeColor(mfData.returns?.["1_year_pct"])} />
            </div>
            {mfData.nav_history_monthly && (
              <div className="mt-4">
                <MFNavChart history={mfData.nav_history_monthly} />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [user, setUser]       = useState(null);
  const [tab, setTab]         = useState("stock");
  const [ticker, setTicker]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState("");

  const popular = ["RELIANCE","TCS","INFY","HDFCBANK","ITC","WIPRO","BAJFINANCE","TATAMOTORS","ASIANPAINT","SUNPHARMA"];

  useEffect(() => {
    const savedUser = localStorage.getItem("fc_user");
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } 
      catch (e) { localStorage.removeItem("fc_user"); }
    }
  }, []);

  async function analyze(t) {
    const sym = (t || ticker).trim().toUpperCase();
    if (!sym) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res  = await fetch(`${API}/api/stock/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: sym }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Failed");
      setResult(json.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3.5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-teal-500 to-teal-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <span className="font-bold text-gray-900">FinCopilot</span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">
                  Hi, {user.name || user.email.split('@')[0]}
                </span>
                <button onClick={async () => {
                  await fetch(`${API}/api/auth/logout`, { method: "POST" });
                  localStorage.removeItem("fc_user");
                  localStorage.removeItem("fc_token");
                  setUser(null);
                  setTab("stock");
                }} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                  Log out
                </button>
              </>
            ) : (
              <button onClick={() => setTab("portfolio")} 
                className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
                Log in
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Financial Research</h1>
          <p className="text-gray-500 text-sm">Full stock analysis, mutual funds, and portfolio tracking.</p>
        </div>

        <div className="flex gap-2 mb-6">
          {["stock", "mutual_fund", "portfolio"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${tab===t ? "bg-teal-600 text-white border-teal-600" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
              {t === "stock" ? "Stocks" : t === "mutual_fund" ? "Mutual Funds" : "Portfolio"}
            </button>
          ))}
        </div>

        {tab === "stock" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
              <form onSubmit={e => { e.preventDefault(); analyze(); }} className="flex gap-3">
                <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                  placeholder="Enter NSE ticker e.g. RELIANCE, TCS, INFY"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                <button type="submit" disabled={loading}
                  className="bg-teal-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  {loading ? "Analyzing…" : "Analyze →"}
                </button>
              </form>
              <div className="mt-3 flex gap-x-3 gap-y-1 flex-wrap items-center">
                <span className="text-xs text-gray-400">Try:</span>
                {popular.map(s => (
                  <button key={s} onClick={() => { setTicker(s); analyze(s); }}
                    className="text-xs text-teal-600 hover:text-teal-800 hover:underline font-medium">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">⚠ {error}</div>}

            {loading && (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-medium text-gray-700">Fetching live data and running analysis…</p>
              </div>
            )}

            {result && !loading && <StockDashboard data={result} />}
          </>
        )}

        {tab === "mutual_fund" && <MutualFundTab />}

        {tab === "portfolio" && (
          !user ? (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LoginScreen onLogin={setUser} />
            </div>
          ) : (
            <PortfolioTab user={user}/>
          )
        )}
        
        <p className="text-xs text-gray-400 text-center mt-10">
          For informational purposes only. Not investment advice. Consult a SEBI-registered advisor.
        </p>
      </div>
    </div>
  );
}