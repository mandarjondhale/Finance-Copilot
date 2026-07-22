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
    <div className={`bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg shadow-black/10 ${className}`}>
      {title && (
        <div className="px-5 py-3 border-b border-slate-800/50 bg-slate-950/20">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Metric({ label, value, sub, color }) {
  return (
    <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800/40 hover:border-slate-700/60 transition-colors flex flex-col justify-between h-full min-h-[92px]">
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-base font-bold tracking-tight ${color || "text-slate-100"}`}>{value}</div>
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-1 leading-snug">{sub}</div>}
    </div>
  );
}

function ScoreBar({ label, score, max, color }) {
  const pctWidth = Math.round((score / max) * 100);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="font-bold text-slate-100">{score}/{max}</span>
      </div>
      <div className="h-2 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/30">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pctWidth}%` }}
        />
      </div>
    </div>
  );
}

function Flag({ text, type }) {
  return (
    <div className={`flex gap-2 items-start text-xs py-2 px-3 border rounded-xl mb-1.5 font-medium leading-relaxed
      ${type === "good" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"}`}>
      <span className="text-sm shrink-0">{type === "good" ? "✓" : "⚠"}</span>
      <span>{text}</span>
    </div>
  );
}

function Check({ label, passed }) {
  return (
    <div className="flex items-center gap-2 text-xs py-1">
      <span className={`font-bold ${passed ? "text-emerald-400" : "text-rose-400/80"}`}>{passed ? "✓" : "✗"}</span>
      <span className={passed ? "text-slate-200" : "text-slate-500"}>{label}</span>
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
    <div className="flex items-center justify-center w-full py-12">
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-8 w-full max-w-sm shadow-xl shadow-black/20">
        <div className="text-center mb-6">
          <h2 className="text-xl font-extrabold text-slate-100">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5">Sign in to track your portfolio snapshots</p>
        </div>

        <div className="flex gap-1 bg-slate-950/60 border border-slate-800/40 rounded-xl p-1 mb-6">
          {["login","signup"].map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(""); setVerifyMsg(""); }}
              className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all duration-200
                ${mode === m ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Full name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Mandar Jondhale"
                className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 transition-all"/>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 transition-all"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 transition-all"/>
          </div>
          
          {/* Validation Messages */}
          {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl px-3 py-2.5">{error}</div>}
          {verifyMsg && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl px-3 py-2.5">{verifyMsg}</div>}
          
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-teal-950/20 transition-all disabled:opacity-50 mt-2">
            {loading ? "Verifying..." : mode === "login" ? "Log in →" : "Create account →"}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-5">
          {mode === "login" ? "Need an account? " : "Have an account? "}
          <button type="button" onClick={() => { setMode(mode==="login"?"signup":"login"); setError(""); setVerifyMsg(""); }}
            className="text-teal-400 hover:text-teal-300 hover:underline font-bold">
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
          borderColor: "#06b6d4",
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 5,
          tension: 0.2,
          fill: "origin",
          backgroundColor: "rgba(6, 182, 212, 0.05)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { maxTicksLimit: 8, font: { size: 10 }, color: "#64748b" } 
          },
          y: { 
            grid: { color: "rgba(255, 255, 255, 0.05)" }, 
            ticks: { font: { size: 10 }, color: "#64748b" } 
          }
        }
      }
    });
    return () => chart.destroy();
  }, [history]);

  return (
    <div className="w-full h-64 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/10">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">30-Day Price Trend</span>
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
          borderColor: "#a855f7",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.2,
          fill: true,
          backgroundColor: "rgba(168, 85, 247, 0.05)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { maxTicksLimit: 6, font: { size: 10 }, color: "#64748b" } 
          },
          y: { 
            grid: { color: "rgba(255, 255, 255, 0.05)" }, 
            ticks: { font: { size: 10 }, color: "#64748b" } 
          }
        }
      }
    });
    return () => chart.destroy();
  }, [history]);

  return (
    <div className="w-full h-64 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/10">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">NAV Performance History</span>
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
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
          },
          {
            label: "Total Invested (₹)",
            data: totalInvested,
            borderColor: "#64748b",
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
            labels: { boxWidth: 12, font: { size: 11 }, color: "#94a3b8" }
          }
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { font: { size: 10 }, color: "#64748b" } 
          },
          y: { 
            grid: { color: "rgba(255, 255, 255, 0.05)" }, 
            ticks: { font: { size: 10 }, color: "#64748b" } 
          }
        }
      }
    });
    return () => chart.destroy();
  }, [history]);

  if (!history || history.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
        Balance snapshot history will display here once daily portfolio changes are recorded.
      </div>
    );
  }

  return (
    <div className="w-full h-64 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/10">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Portfolio Performance History</div>
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-slate-800/80 rounded-2xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 font-bold text-xl">×</button>
        
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-slate-100">Connect to {brokerNames[broker]}</h3>
          <p className="text-xs text-slate-400 mt-1">Establishing a secure connection with your broker portal</p>
        </div>

        {error && <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Client ID / Mobile Number</label>
              <input value={clientId} onChange={e => setClientId(e.target.value)}
                placeholder="e.g. AB1234 or 9876543210"
                className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 transition-all" required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Password / PIN</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 transition-all" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-teal-950/20 transition-all disabled:opacity-50 mt-2">
              {loading ? "Authenticating..." : "Verify & Send OTP →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Verification OTP</label>
              <input value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP code"
                className="w-full text-center tracking-widest bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 font-bold transition-all" maxLength={6} required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-emerald-950/20 transition-all disabled:opacity-50 mt-2">
              {loading ? "Syncing Holdings..." : "Confirm & Import Holdings"}
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs text-teal-400 hover:text-teal-300 mt-2 font-bold transition-colors">← Back</button>
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
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Connect Stock Broker Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {brokers.map(b => (
              <div key={b.id} className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-lg hover:border-slate-700/60 transition-all flex flex-col justify-between">
                <div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center text-white font-extrabold text-lg mb-3 shadow-md`}>
                    {b.logo}
                  </div>
                  <h3 className="font-extrabold text-slate-200 text-sm">{b.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{b.desc}</p>
                </div>
                <button onClick={() => setActiveBroker(b.id)}
                  className="mt-5 w-full bg-slate-950/40 border border-slate-800/60 hover:border-teal-500/50 hover:bg-teal-500/10 text-slate-300 hover:text-teal-400 font-bold py-2.5 rounded-xl text-xs transition-all">
                  Link Account
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-800/60"></div>
          <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">Or</span>
          <div className="flex-grow border-t border-slate-800/60"></div>
        </div>

        <Card title="Upload Holdings CSV File">
          <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-4">
            <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-teal-500/10 file:text-teal-400 hover:file:bg-teal-500/20 cursor-pointer" />
            <button type="submit" disabled={loading || !file}
              className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-teal-950/20 transition-all disabled:opacity-50 whitespace-nowrap">
              {loading ? "Analyzing..." : "Upload & Analyze"}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Upload the standard holdings CSV exported from Zerodha Kite, Groww, Angel One, or Upstox. Column headers are automatically recognized.
          </p>
          {error && <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">⚠ {error}</div>}
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
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-semibold">{sector}</span>
                  <span className="text-slate-500 font-bold">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/30">
                  <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 3. The Ledger */}
      <Card title="Your Holdings">
        <div className="flex flex-col gap-1.5">
          {stocks.map(row => {
            const initials = row.ticker.substring(0, 2).toUpperCase();
            const isUp = row.pnl_pct >= 0;

            return (
              <div key={row.ticker} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-850/50 transition-all border border-transparent hover:border-slate-800/40">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-sm
                  ${isUp ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  {initials}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-200 truncate">{row.ticker}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {row.shares || '-'} shares · avg ₹{row.buy_price ? row.buy_price.toFixed(2) : '-'} · {row.sector}
                  </div>
                </div>
                
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-200">₹{row.current_value.toFixed(2)}</div>
                  <div className={`text-xs font-bold mt-0.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
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
    setAiSummary(""); // Start empty so we can stream into it
    try {
      const res = await fetch(`${API}/api/stock/summarize/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, analysis_data: data }),
      });
      if (!res.ok) throw new Error("Failed to connect to AI server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          setAiSummary(buffer);
        }
      }
    } catch (e) { 
      setAiSummary("AI summary unavailable: " + e.message); 
    } finally { 
      setAiLoading(false); 
    }
  }


  const overallColor =
    verdict.overall.includes("Strong Buy") ? "bg-emerald-500 text-white" :
    verdict.overall.includes("Moderate")   ? "bg-teal-500 text-white" :
    verdict.overall.includes("Neutral")    ? "bg-slate-700 text-slate-200" :
    verdict.overall.includes("Caution")    ? "bg-amber-500 text-black" : "bg-rose-500 text-white";

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Stock Main Header Card */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl shadow-black/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-100">{company_name}</h2>
            <p className="text-xs text-slate-400 mt-1 font-semibold tracking-wide uppercase">{ticker} · {fin.sector || "—"} · {fin.industry || "—"}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold text-slate-100 tracking-tight">₹{price.current_price}</div>
            <div className={`text-xs font-bold mt-1.5 ${changeColor(price.change_1d_pct)}`}>
              {pct(price.change_1d_pct)} today
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center mt-5 pt-5 border-t border-slate-800/60">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black ${overallColor} shadow-md`}>
            {verdict.overall}
          </div>
          <div className="flex gap-1.5 ml-auto">
            {["1D", "1M", "6M", "1Y"].map((label, idx) => {
              const vals = [price.change_1d_pct, price.change_1m_pct, price.change_6m_pct, price.change_1y_pct];
              return (
                <div key={label} className="text-center px-3 py-1 bg-slate-950/40 border border-slate-800/40 rounded-xl min-w-[56px]">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">{label}</span>
                  <span className={`text-xs font-bold ${changeColor(vals[idx])}`}>{pct(vals[idx])}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* Sub-Tab Navigation */}
      <div className="flex gap-1 bg-slate-950/60 border border-slate-800/40 p-1 rounded-xl">
        {["overview", "financials", "technicals", "ai"].map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all duration-200 capitalize
              ${subTab === t 
                ? "bg-slate-800 text-slate-100 shadow-sm border border-slate-700/40" 
                : "text-slate-500 hover:text-slate-300 border border-transparent"}`}>
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
            <Card title="Valuation: Is the stock cheap or expensive?">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Valuation Multiple (P/E)" value={num(fin.pe_ratio, 1)} sub="Stock price compared to its profits. Lower usually means cheaper." />
                <Metric label="Expected Future P/E" value={num(fin.forward_pe, 1)} sub="Expected valuation multiple for the next fiscal year." />
                <Metric label="Asset Price Ratio (P/B)" value={num(fin.pb_ratio, 1)} sub="Price compared to net book assets. Important for banks." />
                <Metric label="Institutional Valuation (EV/EBITDA)" value={num(fin.ev_ebitda, 1)} sub="Standard multiple used by professional acquirers." />
                <Metric label="Sales Multiple (P/S)" value={num(fin.ps_ratio, 1)} sub="Price relative to total sales. Good for high-growth tech." />
                <Metric label="Growth-Adjusted P/E (PEG)" value={num(fin.peg_ratio, 1)} sub="Valuation adjusted for growth. Below 1 is excellent." />
              </div>
            </Card>

            <Card title="Profitability: How well does the company print money?">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Return on Net Assets (ROE)" value={fin.roe_pct != null ? `${fin.roe_pct}%` : "—"}
                  color={fin.roe_pct > 15 ? "text-emerald-400" : fin.roe_pct < 8 ? "text-rose-400" : "text-slate-100"}
                  sub="Profit generated using shareholders' money. Above 15% is great." />
                <Metric label="Capital Efficiency (ROCE)" value={fin.roce_pct != null ? `${fin.roce_pct}%` : "—"}
                  color={fin.roce_pct > 15 ? "text-emerald-400" : "text-slate-100"}
                  sub="Profit earned from total capital invested. Higher is better." />
                <Metric label="Net Profit Margin" value={fin.net_margin_pct != null ? `${fin.net_margin_pct}%` : "—"}
                  sub="The actual percentage of sales revenue kept as net profit." />
                <Metric label="Operating Margin" value={fin.op_margin_pct != null ? `${fin.op_margin_pct}%` : "—"}
                  sub="Core profitability of business operations before tax & debt costs." />
                <Metric label="Direct Profit Margin" value={fin.gross_margin_pct != null ? `${fin.gross_margin_pct}%` : "—"}
                  sub="Profitability left after direct cost of goods sold." />
                <Metric label="Free Cash Flow" value={cr(fin.free_cashflow_cr)}
                  sub="Actual cash left to spend or pay dividends. Real profit." />
              </div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Growth: How fast is the business expanding?">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Yearly Sales Growth" value={pct(fin.revenue_growth_yoy_pct)}
                  color={changeColor(fin.revenue_growth_yoy_pct)}
                  sub="Growth in total sales compared to same quarter last year." />
                <Metric label="Yearly Profit Growth" value={pct(fin.profit_growth_yoy_pct)}
                  color={changeColor(fin.profit_growth_yoy_pct)}
                  sub="Growth in net profits compared to same quarter last year." />
                <Metric label="Earnings Per Share (EPS)" value={fin.eps != null ? `₹${fin.eps.toFixed(2)}` : "—"}
                  sub="The exact portion of profit allocated to each share of stock." />
                <Metric label="Dividend Yield" value={fin.dividend_yield != null ? `${fin.dividend_yield}%` : "—"}
                  sub="Annual dividend return as a percentage of current share price." />
              </div>
            </Card>

            <Card title="Debt & Balance Sheet Safety">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Debt to Equity Ratio" value={num(fin.debt_to_equity, 2)}
                  color={fin.debt_to_equity > 1.5 ? "text-rose-400" : "text-emerald-400"}
                  sub="Borrowed money vs shareholder capital. Lower than 1.0 is safe." />
                <Metric label="Short-term Bill Safety" value={num(fin.current_ratio, 2)}
                  color={fin.current_ratio > 1 ? "text-emerald-400" : "text-rose-400"}
                  sub="Ability to pay immediate bills. Values above 1.5 are comfortable." />
                <Metric label="Immediate Cash Safety" value={num(fin.quick_ratio, 2)}
                  sub="Ability to pay bills using only cash-like quick assets." />
                <Metric label="Company Market Size" value={cr(fin.market_cap_cr)}
                  sub="Total current stock market valuation of the entire firm." />
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
          className="flex-1 bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 transition-all" />
        <button onClick={search} disabled={loading}
          className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-teal-950/20 transition-all disabled:opacity-50">
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden mb-4 shadow-lg shadow-black/10">
          {results.map(f => (
            <button key={f.scheme_code} onClick={() => loadFund(f.scheme_code)}
              className="w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-850 text-sm text-slate-300 last:border-0 transition-colors">
              <span>{f.scheme_name}</span>
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

    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sleek Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0a0f1d] border-b md:border-b-0 md:border-r border-slate-800/80 flex md:flex-col justify-between p-5 shrink-0 z-20 shadow-xl shadow-black/20">
        <div className="flex md:flex-col gap-6 w-full items-center md:items-stretch">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <span className="text-white text-sm font-black">FC</span>
            </div>
            <span className="font-extrabold text-lg text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 uppercase tracking-wider">FinCopilot</span>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex flex-col gap-2 mt-4">
            {[
              { id: "stock", label: "Stock Research", icon: "📊" },
              { id: "mutual_fund", label: "Mutual Funds", icon: "📈" },
              { id: "portfolio", label: "My Portfolio", icon: "💼" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200
                  ${tab === t.id 
                    ? "bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20 text-teal-400 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent"
                  }`}>
                <span className="text-sm">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Nav Links (visible only on mobile) */}
        <div className="flex md:hidden gap-1 bg-slate-950/60 p-1 border border-slate-800/40 rounded-xl">
          {[
            { id: "stock", label: "Stocks" },
            { id: "mutual_fund", label: "MFs" },
            { id: "portfolio", label: "Portfolio" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors
                ${tab === t.id ? "bg-slate-800 text-slate-100" : "text-slate-400"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Footer Section */}
        <div className="hidden md:flex flex-col border-t border-slate-800/60 pt-4 gap-3 mt-auto">
          {user ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-teal-400 uppercase">
                  {user.name ? user.name[0] : user.email[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-200 truncate">{user.name || "Investor"}</div>
                  <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                </div>
              </div>
              <button onClick={async () => {
                await fetch(`${API}/api/auth/logout`, { method: "POST" });
                localStorage.removeItem("fc_user");
                localStorage.removeItem("fc_token");
                setUser(null);
                setTab("stock");
              }} className="text-[10px] font-bold text-rose-400 hover:text-rose-300 text-left transition-colors flex items-center gap-1.5">
                <span>🚪</span> Log out
              </button>
            </div>
          ) : (
            <button onClick={() => setTab("portfolio")} 
              className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold py-2.5 rounded-xl border border-slate-800 transition-all text-center">
              Connect Account
            </button>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-y-auto px-6 py-8 md:p-10 w-full max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8 border-b border-slate-800/40 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 capitalize">
              {tab === "stock" ? "Stock Terminal" : tab === "mutual_fund" ? "Mutual Funds" : "My Portfolio"}
            </h1>
            <p className="text-slate-400 text-xs mt-1">Institutional-grade financial analysis powered by clean data metrics.</p>
          </div>
        </div>

        {tab === "stock" && (
          <>
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 mb-6 shadow-lg shadow-black/10">
              <form onSubmit={e => { e.preventDefault(); analyze(); }} className="flex gap-3">
                <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                  placeholder="Enter NSE ticker e.g. RELIANCE, TCS, INFY"
                  className="flex-1 bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-100 placeholder-slate-600 focus:border-teal-500/50 transition-all" />
                <button type="submit" disabled={loading}
                  className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md shadow-teal-950/20 transition-all disabled:opacity-50">
                  {loading ? "Analyzing..." : "Analyze →"}
                </button>
              </form>
              <div className="mt-4 flex gap-x-3 gap-y-1 flex-wrap items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Try:</span>
                {popular.map(s => (
                  <button key={s} onClick={() => { setTicker(s); analyze(s); }}
                    className="text-xs text-teal-400 hover:text-teal-300 font-bold transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-3 mb-4 text-sm font-medium">⚠ {error}</div>}

            {loading && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center shadow-lg shadow-black/10">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-bold text-slate-300">Fetching live financials and computing indicators...</p>
              </div>
            )}

            {result && !loading && <StockDashboard data={result} />}
          </>
        )}

        {tab === "mutual_fund" && <MutualFundTab />}

        {tab === "portfolio" && (
          !user ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LoginScreen onLogin={setUser} />
            </div>
          ) : (
            <PortfolioTab user={user}/>
          )
        )}
        
        <p className="text-[10px] text-slate-600 text-center mt-12 leading-relaxed">
          For informational purposes only. Not investment advice. Consult a SEBI-registered advisor.
        </p>
      </main>
    </div>
  );
}