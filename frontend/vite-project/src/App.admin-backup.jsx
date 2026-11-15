import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { usePageView } from "./tracking";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const DISTRICTS = [
  "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib",
  "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar",
  "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga",
  "Pathankot", "Patiala", "Rupnagar (Ropar)",
  "Sahibzada Ajit Singh Nagar (Mohali)", "Sangrur",
  "Shaheed Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran",
];

const CATEGORIES = [
  "IT & Software", "Government Jobs", "Teaching", "Healthcare",
  "Manufacturing", "Banking & Finance", "Agriculture",
  "Retail & Sales", "Construction", "Other",
];

const EDUCATION_LEVELS = [
  ["", "Not specified"],
  ["below_10th", "Below 10th"],
  ["10th", "10th"],
  ["12th", "12th"],
  ["iti", "ITI"],
  ["diploma", "Diploma"],
  ["graduate", "Graduate"],
  ["postgraduate", "Postgraduate"],
  ["doctorate", "Doctorate"],
  ["other", "Other"],
];

const APPLICATION_STATUSES = [
  "Applied", "Under Review", "Shortlisted", "Accepted", "Placed", "Rejected",
];

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const formatPercent = (value) =>
  `${Number(value || 0).toFixed(2)}%`;

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
};

const formatSalary = (min, max) => {
  const format = (value) => `₹${Number(value).toLocaleString("en-IN")}`;
  if (min == null && max == null) return "Not specified";
  if (min != null && max != null) return `${format(min)} – ${format(max)}`;
  return min != null ? `From ${format(min)}` : `Up to ${format(max)}`;
};

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = Array.isArray(data.details)
      ? data.details.map((item) => item.message).join(" ")
      : "";
    throw new Error(details || data.error || "Request failed.");
  }

  return data;
}

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
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

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
          <p>Sign in to access the administration dashboard.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            placeholder="Enter admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
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

const EMPTY_JOB = {
  title: "",
  company: "",
  description: "",
  location: "",
  salary_min: "",
  salary_max: "",
  experience_required: "",
  education_required: "",
  category: "",
  status: "open",
  skillIds: "",
};

function JobForm({ initialJob, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_JOB,
    ...(initialJob || {}),
    salary_min: initialJob?.salary_min ?? "",
    salary_max: initialJob?.salary_max ?? "",
    experience_required: initialJob?.experience_required ?? "",
    skillIds: (initialJob?.skills || [])
      .map((skill) => skill.skill_id)
      .join(", "),
  }));
  const [error, setError] = useState("");

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function submit(e) {
    e.preventDefault();
    setError("");

    const skillIds = form.skillIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map(Number);

    if (skillIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      setError("Skill IDs must be positive whole numbers, separated by commas.");
      return;
    }

    if (new Set(skillIds).size !== skillIds.length) {
      setError("Each skill ID can only be entered once.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      company: form.company.trim(),
      description: form.description.trim() || null,
      location: form.location || null,
      salary_min: form.salary_min === "" ? null : Number(form.salary_min),
      salary_max: form.salary_max === "" ? null : Number(form.salary_max),
      experience_required:
        form.experience_required === "" ? null : Number(form.experience_required),
      education_required: form.education_required || null,
      category: form.category || null,
      status: form.status,
      skills: skillIds.map((skill_id) => ({ skill_id, importance: 3 })),
    };

    if (payload.salary_min != null && (
      !Number.isInteger(payload.salary_min) || payload.salary_min < 0
    )) {
      setError("Minimum salary must be a non-negative whole number.");
      return;
    }

    if (payload.salary_max != null && (
      !Number.isInteger(payload.salary_max) || payload.salary_max < 0
    )) {
      setError("Maximum salary must be a non-negative whole number.");
      return;
    }

    if (
      payload.salary_min != null &&
      payload.salary_max != null &&
      payload.salary_min > payload.salary_max
    ) {
      setError("Minimum salary cannot exceed maximum salary.");
      return;
    }

    if (
      payload.experience_required != null &&
      (payload.experience_required < 0 || payload.experience_required > 60)
    ) {
      setError("Experience must be between 0 and 60 years.");
      return;
    }

    onSave(payload).catch((err) => setError(err.message));
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-heading">
        <div>
          <h3>{initialJob ? "Edit job listing" : "Create a new job"}</h3>
          <p>Enter the job details below. Fields marked * are required.</p>
        </div>
      </div>

      <div className="admin-form-grid">
        <label>
          Job title *
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            minLength={3}
            maxLength={150}
            required
          />
        </label>

        <label>
          Company *
          <input
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
            minLength={2}
            maxLength={150}
            required
          />
        </label>

        <label>
          District
          <select value={form.location} onChange={(e) => update("location", e.target.value)}>
            <option value="">Select district</option>
            {DISTRICTS.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </label>

        <label>
          Job category
          <select value={form.category} onChange={(e) => update("category", e.target.value)}>
            <option value="">Select category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          Minimum salary (₹)
          <input
            type="number"
            min="0"
            step="1"
            value={form.salary_min}
            onChange={(e) => update("salary_min", e.target.value)}
          />
        </label>

        <label>
          Maximum salary (₹)
          <input
            type="number"
            min="0"
            step="1"
            value={form.salary_max}
            onChange={(e) => update("salary_max", e.target.value)}
          />
        </label>

        <label>
          Required experience (years)
          <input
            type="number"
            min="0"
            max="60"
            step="0.1"
            value={form.experience_required}
            onChange={(e) => update("experience_required", e.target.value)}
          />
        </label>

        <label>
          Education requirement
          <select
            value={form.education_required}
            onChange={(e) => update("education_required", e.target.value)}
          >
            {EDUCATION_LEVELS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          Listing status
          <select value={form.status} onChange={(e) => update("status", e.target.value)}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label>
          Skill IDs (comma-separated)
          <input
            value={form.skillIds}
            onChange={(e) => update("skillIds", e.target.value)}
            placeholder="Example: 1, 4, 8"
          />
          <small>Use existing skill IDs from your database. Importance defaults to 3.</small>
        </label>

        <label className="admin-form-full">
          Job description
          <textarea
            rows={5}
            maxLength={5000}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Describe the role, responsibilities and requirements..."
          />
        </label>
      </div>

      {error && <div className="data-error">{error}</div>}

      <div className="admin-form-actions">
        <button className="admin-primary-button" type="submit" disabled={saving}>
          {saving ? "Saving..." : initialJob ? "Save changes" : "Create job"}
        </button>
        <button className="admin-secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function JobsManager({ token }) {
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formJob, setFormJob] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadJobs = useCallback(async () => {

    try {
      const params = new URLSearchParams({ status: statusFilter, limit: "50" });
      if (search.trim()) params.set("search", search.trim());

      const result = await api(`/admin/jobs?${params}`, { token });
      setJobs(result.jobs || []);
    } catch (err) {
      setError(err.message);
    } finally {
    setLoading(false);
    }
  }, [statusFilter, search, token]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    loadJobs();
  }, [loadJobs]);

  async function saveJob(payload) {
    setSaving(true);
    setError("");
    try {
      if (formJob?.id) {
        await api(`/admin/jobs/${formJob.id}`, {
          token,
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Job updated successfully.");
      } else {
        await api("/admin/jobs", {
          token,
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Job created successfully.");
      }
      setFormJob(null);
      setCreating(false);
      await loadJobs();
      } finally {
        setSaving(false);
      }
  }

  async function toggleJobStatus(job) {
    const nextStatus = job.status === "open" ? "closed" : "open";
    if (!window.confirm(`Are you sure you want to ${nextStatus} this job?`)) return;

    setError("");
    setNotice("");
    try {
      await api(`/admin/jobs/${job.id}`, {
        token,
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(`Job ${nextStatus} successfully.`);
      await loadJobs();
    } catch (err) {
      setError(err.message);
    }
  }

  if (creating || formJob) {
    return (
      <div className="admin-management">
        <JobForm
          initialJob={formJob}
          onSave={saveJob}
          onCancel={() => { setFormJob(null); setCreating(false); }}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="admin-management-toolbar">
        <div>
          <h2>Job listings</h2>
          <p>Create and manage employment opportunities on the platform.</p>
        </div>
        <button
          className="admin-primary-button"
          onClick={() => { setFormJob(null); setCreating(true); setNotice(""); }}
        >
          + Create job
        </button>
      </div>

      {notice && <div className="admin-notice">{notice}</div>}
      {error && <div className="data-error">{error}</div>}

      <div className="admin-table-filters">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job title, company or description..."
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All jobs</option>
          <option value="open">Open jobs</option>
          <option value="closed">Closed jobs</option>
        </select>
      </div>

      {loading ? (
        <div className="data-message">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">No jobs found.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Location</th>
                <th>Salary</th>
                <th>Status</th>
                <th>Posted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong>{job.title}</strong>
                    <small>{job.company}</small>
                    <small>{job.category || "Uncategorised"}</small>
                  </td>
                  <td>{job.location || "—"}</td>
                  <td>{formatSalary(job.salary_min, job.salary_max)}</td>
                  <td>
                    <span className={`admin-status ${job.status}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>{formatDate(job.created_at)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <button
                        className="admin-small-button"
                        onClick={async () => {
                          setError("");
                          setNotice("");

                          try {
                            const result = await api(`/admin/jobs/${job.id}`, { token });
                            setFormJob(result.job);
                            setCreating(false);
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="admin-small-button"
                        onClick={() => toggleJobStatus(job)}
                      >
                        {job.status === "open" ? "Close" : "Reopen"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-table-note">
        Showing up to 50 jobs. Jobs are closed rather than deleted to preserve application records.
      </p>
    </div>
  );
}

function ApplicationsManager({ token }) {
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadApplications = useCallback(async () => {

    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);

      const result = await api(`/admin/applications?${params}`, { token });
      setApplications(result.applications || []);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, token]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    loadApplications();
  }, [loadApplications]);

  async function updateStatus(application, status) {
    setError("");
    setNotice("");
    setUpdatingId(application.id);

    try {
      const result = await api(`/admin/applications/${application.id}/status`, {
        token,
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      setNotice(`Application #${application.id} updated to ${status}.`);
      if (selected?.id === application.id) {
        setSelected(result.application);
      }
      await loadApplications();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="admin-management">
      <div className="admin-management-toolbar">
        <div>
          <h2>Candidate applications</h2>
          <p>Review applications and manage their recruitment status.</p>
        </div>
        <button className="admin-secondary-button" onClick={loadApplications}>
          Refresh
        </button>
      </div>

      {notice && <div className="admin-notice">{notice}</div>}
      {error && <div className="data-error">{error}</div>}

      <div className="admin-table-filters">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All application statuses</option>
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="data-message">Loading applications...</div>
      ) : applications.length === 0 ? (
        <div className="empty-state">No applications found.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-applications-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job</th>
                <th>Applied on</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <strong>{application.candidate?.name || "Candidate"}</strong>
                    <small>{application.candidate?.email || "—"}</small>
                    <small>Application #{application.id}</small>
                  </td>
                  <td>
                    <strong>{application.job?.title || "Job unavailable"}</strong>
                    <small>{application.job?.company || "—"}</small>
                  </td>
                  <td>{formatDate(application.applied_at)}</td>
                  <td>
                    <span className={`admin-status ${application.status.toLowerCase().replaceAll(" ", "-")}`}>
                      {application.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-table-actions">
                      <button
                        className="admin-small-button"
                        onClick={() => setSelected(application)}
                      >
                        Details
                      </button>
                      <select
                        aria-label={`Update status for application ${application.id}`}
                        value={application.status}
                        disabled={
                          updatingId === application.id ||
                          application.status === "Placed" ||
                          application.status === "Rejected"
                        }
                        onChange={(e) => updateStatus(application, e.target.value)}
                      >
                        {APPLICATION_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && (
        <div className="admin-pagination">
          <span>
            {pagination.total} total applications · Page {pagination.page} of {pagination.total_pages}
          </span>
          <div>
            <button
              className="admin-secondary-button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <button
              className="admin-secondary-button"
              disabled={page >= pagination.total_pages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="admin-modal-close" onClick={() => setSelected(null)}>
              ×
            </button>
            <h2 id="application-modal-title">Application #{selected.id}</h2>
            <div className="admin-detail-grid">
              <div><small>Candidate</small><strong>{selected.candidate?.name || "—"}</strong></div>
              <div><small>Email</small><strong>{selected.candidate?.email || "—"}</strong></div>
              <div><small>Job title</small><strong>{selected.job?.title || "—"}</strong></div>
              <div><small>Company</small><strong>{selected.job?.company || "—"}</strong></div>
              <div><small>District</small><strong>{selected.job?.location || "—"}</strong></div>
              <div><small>Category</small><strong>{selected.job?.category || "—"}</strong></div>
              <div><small>Applied on</small><strong>{formatDate(selected.applied_at)}</strong></div>
              <div><small>Last updated</small><strong>{formatDate(selected.updated_at)}</strong></div>
              <div><small>Current status</small><strong>{selected.status}</strong></div>
              <div><small>Recommendation ID</small><strong>{selected.recommendation_id ?? "—"}</strong></div>
            </div>
            <button className="admin-primary-button" onClick={() => setSelected(null)}>
              Close details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [filters, setFilters] = useState({
    startDate: "", endDate: "", source: "", device: "",
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = sessionStorage.getItem("adminToken");
  const managementTab = ["Jobs", "Applications"].includes(activeTab);

  usePageView("dashboard", { section: activeTab });

  useEffect(() => {
    if (managementTab) return;

    async function fetchAnalytics() {
      setLoading(true);
      setError("");
      setData(null);

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
        const result = await api(`/analytics/${endpoint}?${params}`, { token });
        setData(result);
      } catch (err) {
        setError(err.message || "Unable to connect to analytics API.");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
    }, [activeTab, filters, managementTab, token]);

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters() {
    setFilters({ startDate: "", endDate: "", source: "", device: "" });
  }

  function renderOverview() {
    const summary = data?.summary || {};
    return (
      <>
        <section className="stats-grid">
          <MetricCard title="Daily Active Users" value={formatNumber(summary.totalDau)} subtitle="Total across selected daily records" color="blue" />
          <MetricCard title="Registrations" value={formatNumber(summary.totalRegistrations)} subtitle="Registered users" color="green" />
          <MetricCard title="Applications" value={formatNumber(summary.totalApplications)} subtitle="Submitted applications" color="purple" />
          <MetricCard title="Recommendation CTR" value={formatPercent(summary.averageRecommendationCtr)} subtitle="Click-through rate" color="orange" />
        </section>
        <section className="analytics-grid">
          <DataPanel title="Daily Active Users" description="Daily active user trend" items={data?.dailyActiveUsers} labelKey="date" valueKey="users" />
          <div className="panel">
            <h3>Platform Summary</h3>
            <p className="description">Performance for the selected filters</p>
            <div className="summary-row"><span>Total registrations</span><strong>{formatNumber(summary.totalRegistrations)}</strong></div>
            <div className="summary-row"><span>Total applications</span><strong>{formatNumber(summary.totalApplications)}</strong></div>
            <div className="summary-row"><span>Daily active users</span><strong>{formatNumber(summary.totalDau)}</strong></div>
            <div className="summary-row"><span>Recommendation CTR</span><strong>{formatPercent(summary.averageRecommendationCtr)}</strong></div>
          </div>
        </section>
      </>
    );
  }

  function renderAcquisition() {
    return (
      <>
        <section className="stats-grid">
          <MetricCard title="Total Registrations" value={formatNumber(data?.totalRegistrations)} subtitle="New user registrations" color="blue" />
        </section>
        <section className="analytics-grid">
          <DataPanel title="Registrations by Source" description="Where users discovered the platform" items={data?.bySource} labelKey="name" valueKey="registrations" />
          <DataPanel title="Registrations by Campaign" description="Campaign performance" items={data?.byCampaign} labelKey="name" valueKey="registrations" />
          <DataPanel title="Registrations by Device" description="Devices used during registration" items={data?.byDevice} labelKey="name" valueKey="registrations" />
        </section>
      </>
    );
  }

  function renderConversion() {
    return (
      <>
        <section className="stats-grid">
          <MetricCard title="Total Applications" value={formatNumber(data?.totalApplications)} subtitle="Applications in selected period" color="purple" />
        </section>
        <section className="analytics-grid">
          <DataPanel title="Application Conversion Funnel" description="Applications grouped by current status" items={data?.funnel} labelKey="status" valueKey="count" percentageKey="percentage" />
          <div className="panel">
            <h3>Funnel Breakdown</h3>
            <p className="description">Application status distribution</p>
            {(data?.funnel || []).length === 0 ? (
              <p className="empty-state">No conversion data available.</p>
            ) : data.funnel.map((item) => (
              <div className="summary-row" key={item.status}>
                <span>{item.status}</span>
                <strong>{formatNumber(item.count)} ({formatPercent(item.percentage)})</strong>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderRecommendations() {
    return (
      <section className="stats-grid">
        <MetricCard title="Impressions" value={formatNumber(data?.impressions)} subtitle="Recommendations displayed" color="blue" />
        <MetricCard title="Clicks" value={formatNumber(data?.clicks)} subtitle="Recommendation clicks" color="green" />
        <MetricCard title="Applications" value={formatNumber(data?.applied)} subtitle="Recommendation applications" color="purple" />
        <MetricCard title="Click-through Rate" value={formatPercent(data?.ctr)} subtitle="Clicks divided by impressions" color="orange" />
      </section>
    );
  }

  const analyticsTabs = ["Overview", "Acquisition", "Conversion", "Recommendations"];
  const adminTabs = ["Jobs", "Applications"];

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2>🇮🇳 PGRKAM</h2>
        <p className="sidebar-subtitle">Employment Analytics</p>
        <nav>
          <div className="admin-nav-label">ANALYTICS</div>
          {analyticsTabs.map((item) => (
            <button
              key={item}
              className={activeTab === item ? "nav-item active" : "nav-item"}
              onClick={() => { setActiveTab(item); setError(""); }}
            >
              {item}
            </button>
          ))}
          <div className="admin-nav-label admin-nav-spaced">MANAGEMENT</div>
          {adminTabs.map((item) => (
            <button
              key={item}
              className={activeTab === item ? "nav-item active" : "nav-item"}
              onClick={() => { setActiveTab(item); setError(""); }}
            >
              {item}
            </button>
          ))}
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
            <p>PGRKAM Administration Portal</p>
          </div>
          <div className="admin-section">
            <div className="admin">👤 {user.name || user.email}</div>
            <button className="logout-button" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {!managementTab && (
          <section className="filter-panel">
            <div className="filter-field">
              <label htmlFor="startDate">Start date</label>
              <input id="startDate" type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)} />
            </div>
            <div className="filter-field">
              <label htmlFor="endDate">End date</label>
              <input id="endDate" type="date" min={filters.startDate || undefined} value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)} />
            </div>
            <div className="filter-field">
              <label htmlFor="source">Registration source</label>
              <select id="source" value={filters.source} onChange={(e) => updateFilter("source", e.target.value)}>
                <option value="">All sources</option>
                {["google", "facebook", "instagram", "direct", "referral", "whatsapp", "youtube"].map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="device">Device</label>
              <select id="device" value={filters.device} onChange={(e) => updateFilter("device", e.target.value)}>
                <option value="">All devices</option>
                {["mobile", "desktop", "tablet"].map((device) => <option key={device} value={device}>{device}</option>)}
              </select>
            </div>
            <button className="clear-filter-button" onClick={clearFilters}>Clear filters</button>
          </section>
        )}

        {loading && !managementTab && <div className="data-message">Loading analytics data...</div>}
        {error && !managementTab && <div className="data-error">{error}</div>}

        {!managementTab && !loading && !error && data && (
          <>
            {activeTab === "Overview" && renderOverview()}
            {activeTab === "Acquisition" && renderAcquisition()}
            {activeTab === "Conversion" && renderConversion()}
            {activeTab === "Recommendations" && renderRecommendations()}
          </>
        )}

        {activeTab === "Jobs" && <JobsManager token={token} />}
        {activeTab === "Applications" && <ApplicationsManager token={token} />}

        <footer>© 2026 PGRKAM | Punjab Government Employment Analytics</footer>
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
        const result = await api("/auth/me", { token });
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
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
