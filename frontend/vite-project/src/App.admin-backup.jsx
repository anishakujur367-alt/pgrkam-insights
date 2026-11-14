import { useEffect, useState } from "react";
import "./App.css";
import { usePageView } from "./tracking";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const formatPercent = (value) =>
  `${Number(value || 0).toFixed(2)}%`;

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Login failed.");
      if (data.user.role !== "admin") {
        throw new Error("Access denied. Admin accounts only.");
      }

      sessionStorage.setItem("adminToken", data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">🇮🇳 PGRKAM</div>
        <p className="login-subtitle">Punjab Government Employment Analytics</p>

        <div className="login-heading">
          <h1>Admin Login</h1>
          <p>Sign in to access the analytics dashboard.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            placeholder="Enter admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="login-error">{error}</div>}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="login-footer">Authorized personnel only</p>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <span>{title}</span>
      <h2>{value}</h2>
      <small>{subtitle}</small>
    </div>
  );
}

function DataPanel({ title, description, items, labelKey, valueKey, percentageKey }) {
  const values = items || [];
  const maximum = Math.max(
    ...values.map((item) => Number(item[valueKey] || 0)),
    1
  );

  return (
    <div className="panel">
      <h3>{title}</h3>
      {description && <p className="description">{description}</p>}

      {values.length === 0 ? (
        <p className="empty-state">No data available for these filters.</p>
      ) : (
        values.map((item, index) => {
          const value = Number(item[valueKey] || 0);
          const width = Math.max((value / maximum) * 100, value > 0 ? 2 : 0);

          return (
            <div className="district-row" key={`${item[labelKey]}-${index}`}>
              <div className="district-info">
                <span>{item[labelKey] || "Unknown"}</span>
                <strong>
                  {percentageKey
                    ? formatPercent(item[percentageKey])
                    : formatNumber(value)}
                </strong>
              </div>
              <div className="progress-bg">
                <div className="progress-fill" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    source: "",
    device: "",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  usePageView("dashboard", { section: activeTab });

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError("");
      setData(null);

      const token = sessionStorage.getItem("adminToken");
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const endpoint = {
        Overview: "overview",
        Acquisition: "acquisition",
        Conversion: "conversion",
        Recommendations: "recommendations",
      }[activeTab];

      try {
        const response = await fetch(
          `${API_URL}/analytics/${endpoint}?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load analytics.");
        }

        setData(result);
      } catch (err) {
        setError(err.message || "Unable to connect to analytics API.");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [activeTab, filters]);

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      startDate: "",
      endDate: "",
      source: "",
      device: "",
    });
  }

  function renderOverview() {
    const summary = data?.summary || {};

    return (
      <>
        <section className="stats-grid">
          <MetricCard
            title="Daily Active Users"
            value={formatNumber(summary.totalDau)}
            subtitle="Total across selected daily records"
            color="blue"
          />
          <MetricCard
            title="Registrations"
            value={formatNumber(summary.totalRegistrations)}
            subtitle="Registered users"
            color="green"
          />
          <MetricCard
            title="Applications"
            value={formatNumber(summary.totalApplications)}
            subtitle="Submitted applications"
            color="purple"
          />
          <MetricCard
            title="Recommendation CTR"
            value={formatPercent(summary.averageRecommendationCtr)}
            subtitle="Click-through rate"
            color="orange"
          />
        </section>

        <section className="analytics-grid">
          <DataPanel
            title="Daily Active Users"
            description="Daily active user trend"
            items={data?.dailyActiveUsers}
            labelKey="date"
            valueKey="users"
          />
          <div className="panel">
            <h3>Platform Summary</h3>
            <p className="description">Performance for the selected filters</p>
            <div className="summary-row">
              <span>Total registrations</span>
              <strong>{formatNumber(summary.totalRegistrations)}</strong>
            </div>
            <div className="summary-row">
              <span>Total applications</span>
              <strong>{formatNumber(summary.totalApplications)}</strong>
            </div>
            <div className="summary-row">
              <span>Daily active users</span>
              <strong>{formatNumber(summary.totalDau)}</strong>
            </div>
            <div className="summary-row">
              <span>Recommendation CTR</span>
              <strong>{formatPercent(summary.averageRecommendationCtr)}</strong>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderAcquisition() {
    return (
      <>
        <section className="stats-grid">
          <MetricCard
            title="Total Registrations"
            value={formatNumber(data?.totalRegistrations)}
            subtitle="New user registrations"
            color="blue"
          />
        </section>

        <section className="analytics-grid">
          <DataPanel
            title="Registrations by Source"
            description="Where users discovered the platform"
            items={data?.bySource}
            labelKey="name"
            valueKey="registrations"
          />
          <DataPanel
            title="Registrations by Campaign"
            description="Campaign performance"
            items={data?.byCampaign}
            labelKey="name"
            valueKey="registrations"
          />
          <DataPanel
            title="Registrations by Device"
            description="Devices used during registration"
            items={data?.byDevice}
            labelKey="name"
            valueKey="registrations"
          />
        </section>
      </>
    );
  }

  function renderConversion() {
    return (
      <>
        <section className="stats-grid">
          <MetricCard
            title="Total Applications"
            value={formatNumber(data?.totalApplications)}
            subtitle="Applications in selected period"
            color="purple"
          />
        </section>

        <section className="analytics-grid">
          <DataPanel
            title="Application Conversion Funnel"
            description="Applications grouped by current status"
            items={data?.funnel}
            labelKey="status"
            valueKey="count"
            percentageKey="percentage"
          />
          <div className="panel">
            <h3>Funnel Breakdown</h3>
            <p className="description">Application status distribution</p>
            {(data?.funnel || []).length === 0 ? (
              <p className="empty-state">No conversion data available.</p>
            ) : (
              data.funnel.map((item) => (
                <div className="summary-row" key={item.status}>
                  <span>{item.status}</span>
                  <strong>
                    {formatNumber(item.count)} ({formatPercent(item.percentage)})
                  </strong>
                </div>
              ))
            )}
          </div>
        </section>
      </>
    );
  }

  function renderRecommendations() {
    return (
      <>
        <section className="stats-grid">
          <MetricCard
            title="Impressions"
            value={formatNumber(data?.impressions)}
            subtitle="Recommendations displayed"
            color="blue"
          />
          <MetricCard
            title="Clicks"
            value={formatNumber(data?.clicks)}
            subtitle="Recommendation clicks"
            color="green"
          />
          <MetricCard
            title="Applications"
            value={formatNumber(data?.applied)}
            subtitle="Recommendation applications"
            color="purple"
          />
          <MetricCard
            title="Click-through Rate"
            value={formatPercent(data?.ctr)}
            subtitle="Clicks divided by impressions"
            color="orange"
          />
        </section>
      </>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2>🇮🇳 PGRKAM</h2>
        <p className="sidebar-subtitle">Employment Analytics</p>

        <nav>
          {["Overview", "Acquisition", "Conversion", "Recommendations"].map(
            (item) => (
              <button
                key={item}
                className={activeTab === item ? "nav-item active" : "nav-item"}
                onClick={() => setActiveTab(item)}
              >
                {item}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <p>Punjab Government</p>
          <small>Analytics Portal v1.0</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{activeTab}</h1>
            <p>Welcome to PGRKAM Analytics Dashboard</p>
          </div>

          <div className="admin-section">
            <div className="admin">👤 {user.name || user.email}</div>
            <button className="logout-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="filter-panel">
          <div className="filter-field">
            <label htmlFor="startDate">Start date</label>
            <input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilter("startDate", e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label htmlFor="endDate">End date</label>
            <input
              id="endDate"
              type="date"
              min={filters.startDate || undefined}
              value={filters.endDate}
              onChange={(e) => updateFilter("endDate", e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label htmlFor="source">Registration source</label>
            <select
              id="source"
              value={filters.source}
              onChange={(e) => updateFilter("source", e.target.value)}
            >
              <option value="">All sources</option>
              {["google", "facebook", "instagram", "direct", "referral", "whatsapp", "youtube"].map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="device">Device</label>
            <select
              id="device"
              value={filters.device}
              onChange={(e) => updateFilter("device", e.target.value)}
            >
              <option value="">All devices</option>
              {["mobile", "desktop", "tablet"].map((device) => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </div>

          <button className="clear-filter-button" onClick={clearFilters}>
            Clear filters
          </button>
        </section>

        {loading && <div className="data-message">Loading analytics data...</div>}
        {error && <div className="data-error">{error}</div>}

        {!loading && !error && data && (
          <>
            {activeTab === "Overview" && renderOverview()}
            {activeTab === "Acquisition" && renderAcquisition()}
            {activeTab === "Conversion" && renderConversion()}
            {activeTab === "Recommendations" && renderRecommendations()}
          </>
        )}

        <footer>
          © 2026 PGRKAM | Punjab Government Employment Analytics
        </footer>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const token = sessionStorage.getItem("adminToken");

      if (!token) {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Session expired");

        const result = await response.json();

        if (result.user.role !== "admin") {
          throw new Error("Admin access required");
        }

        setUser(result.user);
      } catch {
        sessionStorage.removeItem("adminToken");
        setUser(null);
      } finally {
        setChecking(false);
      }
    }

    verifySession();
  }, []);

  function handleLogout() {
    sessionStorage.removeItem("adminToken");
    setUser(null);
  }

  if (checking) {
    return <div className="auth-loading">Verifying admin session...</div>;
  }

  if (!user) {
    return <Login onLogin={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
