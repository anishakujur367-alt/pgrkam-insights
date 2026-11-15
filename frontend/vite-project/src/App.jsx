import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { usePageView, track } from "./tracking";
import AdminApp from "./App.admin-backup.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

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
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

const money = (min, max) => {
  if (min == null && max == null) return "Salary not specified";
  const format = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  if (min != null && max != null) return `${format(min)} – ${format(max)}`;
  return min != null ? `From ${format(min)}` : `Up to ${format(max)}`;
};

function CandidateApp() {
  const trackedRecommendationImpressions = useRef(new Set());
  const [token, setToken] = useState(() => sessionStorage.getItem("candidateToken"));
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [page, setPage] = useState("home");
  const [tab, setTab] = useState("Find Jobs");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [jobSearch, setJobSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedJob, setSelectedJob] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState({});
  const [skills, setSkills] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [options, setOptions] = useState({
    districts: [], genders: [], education_levels: [], job_categories: [],
  });
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  usePageView(page === "home" ? "job-portal" : "candidate-dashboard", { section: tab });

  const loadJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "20", sort });
      if (jobSearch.trim()) params.set("search", jobSearch.trim());
      if (category) params.set("category", category);
      if (location) params.set("location", location);

      const result = await api(`/jobs?${params}`);
      setJobs(result.jobs || []);

      if (jobSearch.trim() || category || location) {
        track("job_search", {
          has_query: Boolean(jobSearch.trim()),
          category: category || null,
          location: location || null,
          sort,
        });
      }
    } catch (err) {
      setError(err.message);
    }
  }, [jobSearch, category, location, sort]);


  const loadTab = useCallback(async () => {
    setError("");

    try {
      if (tab === "Find Jobs") {
        await loadJobs();
      } else if (tab === "Recommended") {
        const result = await api("/recommendations/me", { token });
        setRecommendations(result.recommendations || []);
      } else if (tab === "Saved Jobs") {
        const result = await api("/saved-jobs", { token });
        setSavedJobs(result.saved_jobs || []);
      } else if (tab === "My Applications") {
        const result = await api("/applications?limit=50", { token });
        setApplications(result.applications || []);
      } else if (tab === "My Profile") {
        const [profileData, optionData, skillData] = await Promise.all([
          api("/profile", { token }),
          api("/options"),
          api("/skills"),
        ]);

        setProfile(profileData.profile || {});
        setSkills(profileData.skills || []);
        setOptions(optionData);
        setAllSkills(skillData.skills || []);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [tab, token, loadJobs]);

  const trackRecommendation = useCallback(async (id, eventType) => {
    try {
      await api(`/recommendations/${id}/events`, {
        token,
        method: "POST",
        body: JSON.stringify({ event_type: eventType }),
      });
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    async function initialise() {
      try {
        const [optionData, skillData] = await Promise.all([
          api("/options"),
          api("/skills"),
        ]);
        if (active) {
          setOptions(optionData);
          setAllSkills(skillData.skills || []);
        }
      } catch (err) {
        if (active) setError(err.message);
      }

      if (token) {
        try {
          const result = await api("/auth/me", { token });
          if (result.user.role !== "candidate") throw new Error("Candidate account required.");
          if (active) {
            setUser(result.user);
            setPage("dashboard");
          }
        } catch {
          sessionStorage.removeItem("candidateToken");
          if (active) {
            setToken(null);
            setUser(null);
          }
        }
      }
      if (active) setChecking(false);
    }
    initialise();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (page === "home" || (page === "dashboard" && tab === "Find Jobs")) {
      loadJobs();
    }
  }, [page, tab, loadJobs]);

  useEffect(() => {
    if (page === "dashboard" && token) loadTab();
  }, [page, tab, token, loadTab]);

  useEffect(() => {
    if (page !== "dashboard" || tab !== "Recommended" || !token) {
      return;
    }

    recommendations.forEach((rec) => {
      if (!trackedRecommendationImpressions.current.has(rec.id)) {
        trackedRecommendationImpressions.current.add(rec.id);
        trackRecommendation(rec.id, "impression");
      }
    });
  }, [page, tab, token, recommendations, trackRecommendation]);

  async function handleAuth(e) {
    e.preventDefault();
    setError("");
    try {
      const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
      const result = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(authForm),
      });
      if (result.user.role !== "candidate") throw new Error("Please use a candidate account.");
      sessionStorage.setItem("candidateToken", result.token);
      track(authMode === "register" ? "register" : "login", {
        method: "email",
      });
      setToken(result.token);
      setUser(result.user);
      setPage("dashboard");
      setTab("Find Jobs");
      setNotice(`Welcome, ${result.user.name || "candidate"}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    sessionStorage.removeItem("candidateToken");
    setToken(null);
    setUser(null);
    setPage("home");
    setTab("Find Jobs");
    setNotice("You have been signed out.");
  }

  async function saveJob(jobId) {
    try {
      await api(`/saved-jobs/${jobId}`, { token, method: "POST" });
      setNotice("Job saved.");
      if (tab === "Saved Jobs") loadTab();
    } catch (err) { setError(err.message); }
  }

  async function removeSaved(jobId) {
    try {
      await api(`/saved-jobs/${jobId}`, { token, method: "DELETE" });
      setSavedJobs((old) => old.filter((item) => item.job.id !== jobId));
      setNotice("Saved job removed.");
    } catch (err) { setError(err.message); }
  }

  async function applyJob(jobId, recommendationId = null) {
    try {
      await api("/applications", {
        token,
        method: "POST",
        body: JSON.stringify({
          job_id: jobId,
          ...(recommendationId ? { recommendation_id: recommendationId } : {}),
        }),
      });
      track("job_apply", {
        job_id: jobId,
        recommendation_id: recommendationId,
      });
      setNotice("Your application was submitted.");
      setSelectedJob(null);
      if (tab === "My Applications") loadTab();
    } catch (err) { setError(err.message); }
  }

  async function generateRecommendations() {
    try {
      const result = await api("/recommendations/generate", { token, method: "POST" });
      setRecommendations(result.recommendations || []);
      setNotice(`${result.total || 0} recommendations generated.`);
    } catch (err) { setError(err.message); }
  }

  async function withdrawApplication(id) {
    try {
      await api(`/applications/${id}`, { token, method: "DELETE" });
      setApplications((old) => old.filter((item) => item.id !== id));
      setNotice("Application withdrawn.");
    } catch (err) { setError(err.message); }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setProfileLoading(true);
    setError("");
    try {
      await api("/profile", {
        token,
        method: "PUT",
        body: JSON.stringify({
          education: profile.education || null,
          experience_years: Number(profile.experience_years || 0),
          location: profile.location || null,
          preferred_location: profile.preferred_location || null,
          preferred_category: profile.preferred_category || null,
          bio: profile.bio || null,
          gender: profile.gender || null,
          date_of_birth: profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : null,
          district: profile.district || null,
        }),
      });
      await api("/profile/skills", {
        token,
        method: "PUT",
        body: JSON.stringify({
          skills: skills.map((s) => ({
            skill_id: Number(s.skill_id ?? s.id),
            proficiency: Number(s.proficiency || 3),
          })),
        }),
      });
      setNotice("Profile saved successfully.");
      loadTab();
    } catch (err) { setError(err.message); }
    finally { setProfileLoading(false); }
  }

  function addSkill(id) {
    if (!id || skills.some((s) => Number(s.skill_id ?? s.id) === Number(id))) return;
    setSkills((old) => [...old, { skill_id: Number(id), proficiency: 3 }]);
  }

  if (window.location.pathname === "/admin") return <AdminApp />;

  if (checking) return <div className="candidate-loading">Loading PGRKAM...</div>;

  const navItems = ["Find Jobs", "Recommended", "Saved Jobs", "My Applications", "My Profile"];

  return (
    <div className="candidate-app">
      <header className="candidate-header">
        <a className="candidate-brand" href="/">🇮🇳 PGRKAM <span>Punjab Employment Portal</span></a>
        <nav>
          <a href="#jobs" onClick={(e) => { e.preventDefault(); setPage("home"); }}>Find jobs</a>
          {user ? (
            <>
              <button onClick={() => setPage("dashboard")}>My dashboard</button>
              <button className="candidate-outline" onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              <button onClick={() => { setAuthMode("login"); setPage("auth"); }}>Log in</button>
              <button className="candidate-primary" onClick={() => { setAuthMode("register"); setPage("auth"); }}>Register</button>
              <a className="candidate-admin-link" href="/admin">Admin</a>
            </>
          )}
        </nav>
      </header>

      {(notice || error) && (
        <div className={error ? "candidate-alert error" : "candidate-alert"}>
          <span>{error || notice}</span>
          <button onClick={() => { setError(""); setNotice(""); }}>×</button>
        </div>
      )}

      {page === "auth" && (
        <main className="candidate-auth-wrap">
          <form className="candidate-auth-card" onSubmit={handleAuth}>
            <p className="candidate-eyebrow">PGRKAM EMPLOYMENT PORTAL</p>
            <h1>{authMode === "register" ? "Create your account" : "Welcome back"}</h1>
            <p>Access job opportunities and manage your applications.</p>
            {authMode === "register" && (
              <label>Full name
                <input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required minLength={2} />
              </label>
            )}
            <label>Email address
              <input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required />
            </label>
            <label>Password
              <input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required minLength={8} />
            </label>
            <button className="candidate-primary candidate-full" type="submit">
              {authMode === "register" ? "Create account" : "Sign in"}
            </button>
            <p className="candidate-switch">
              {authMode === "register" ? "Already registered?" : "New to PGRKAM?"}
              <button type="button" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setError(""); }}>
                {authMode === "register" ? " Sign in" : " Create an account"}
              </button>
            </p>
            <button type="button" className="candidate-text-button" onClick={() => setPage("home")}>Back to job portal</button>
          </form>
        </main>
      )}

      {page === "home" && (
        <main>
          <section className="candidate-hero">
            <div>
              <p className="candidate-eyebrow">PUNJAB GOVERNMENT EMPLOYMENT PORTAL</p>
              <h1>Find opportunities.<br /><span>Build your future.</span></h1>
              <p>Discover employment opportunities across Punjab and take the next step in your career.</p>
              <button className="candidate-primary" onClick={() => document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" })}>Explore jobs</button>
            </div>
            <div className="candidate-hero-art" aria-hidden="true">PGRKAM<br /><span>CAREER OPPORTUNITIES</span></div>
          </section>

          <section className="candidate-public-jobs" id="jobs">
            <div className="candidate-section-heading">
              <div><p className="candidate-eyebrow">OPPORTUNITIES</p><h2>Explore open jobs</h2></div>
              <span>{jobs.length} jobs shown</span>
            </div>
            <div className="candidate-filters">
              <input placeholder="Search job title, company or keyword" value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {options.job_categories.map((v) => <option key={v}>{v}</option>)}
              </select>
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">All districts</option>
                {options.districts.map((v) => <option key={v}>{v}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="newest">Newest first</option>
                <option value="salary_desc">Highest salary</option>
              </select>
            </div>
            <div className="candidate-job-grid">
              {jobs.map((job) => (
                <article className="candidate-job-card" key={job.id}>
                  <div className="candidate-job-top"><span>{job.category}</span><small>{job.location}</small></div>
                  <h3>{job.title}</h3>
                  <p className="candidate-company">{job.company}</p>
                  <p className="candidate-salary">{money(job.salary_min, job.salary_max)}</p>
                  <p className="candidate-job-meta">{job.experience_required ?? "Not specified"} years experience · {job.education_required || "Education not specified"}</p>
                  <div className="candidate-skill-tags">{(job.skills || []).slice(0, 4).map((s) => <span key={s.skill_id}>{s.skill_name}</span>)}</div>
                  <div className="candidate-card-actions">
                    <button onClick={async () => {
                      try {
                        const result = await api(`/jobs/${job.id}`);
                        setSelectedJob(result.job);
                        track("job_view", { job_id: job.id });
                      } catch (err) { setError(err.message); }
                    }}>View details</button>
                    <button className="candidate-primary" onClick={() => user ? applyJob(job.id) : (setAuthMode("login"), setPage("auth"))}>Apply now</button>
                  </div>
                </article>
              ))}
              {jobs.length === 0 && <p className="candidate-empty">No matching jobs found. Try changing your filters.</p>}
            </div>
          </section>
        </main>
      )}

      {page === "dashboard" && user && (
        <main className="candidate-dashboard">
          <section className="candidate-welcome">
            <div><p className="candidate-eyebrow">CANDIDATE WORKSPACE</p><h1>Hello, {user.name || "Candidate"}</h1><p>Find opportunities and keep track of your career progress.</p></div>
            <span>{user.email}</span>
          </section>
          <div className="candidate-workspace">
            <aside className="candidate-sidebar">
              <p>YOUR WORKSPACE</p>
              {navItems.map((item) => (
                <button key={item} className={tab === item ? "active" : ""} onClick={() => { setTab(item); setSelectedJob(null); }}>
                  {item}
                </button>
              ))}
              <a href="/admin">Admin portal</a>
            </aside>

            <section className="candidate-main-panel">
              <div className="candidate-panel-heading">
                <div><p className="candidate-eyebrow">PGRKAM CANDIDATE</p><h2>{tab}</h2></div>
                {tab === "Recommended" && <button className="candidate-primary" onClick={generateRecommendations}>Generate recommendations</button>}
              </div>

              {tab === "Find Jobs" && (
                <>
                  <div className="candidate-filters">
                    <input placeholder="Search jobs" value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} />
                    <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{options.job_categories.map((v) => <option key={v}>{v}</option>)}</select>
                    <select value={location} onChange={(e) => setLocation(e.target.value)}><option value="">All districts</option>{options.districts.map((v) => <option key={v}>{v}</option>)}</select>
                  </div>
                  <div className="candidate-job-grid">
                    {jobs.map((job) => <article className="candidate-job-card" key={job.id}>
                      <div className="candidate-job-top"><span>{job.category}</span><small>{job.location}</small></div>
                      <h3>{job.title}</h3><p className="candidate-company">{job.company}</p>
                      <p className="candidate-salary">{money(job.salary_min, job.salary_max)}</p>
                      <div className="candidate-skill-tags">{(job.skills || []).slice(0, 4).map((s) => <span key={s.skill_id}>{s.skill_name}</span>)}</div>
                      <div className="candidate-card-actions">
                        <button onClick={() => saveJob(job.id)}>Save job</button>
                        <button className="candidate-primary" onClick={() => applyJob(job.id)}>Apply</button>
                      </div>
                    </article>)}
                  </div>
                </>
              )}

              {tab === "Recommended" && (
                <div className="candidate-list">
                  {recommendations.map((rec) => (
                    <article className="candidate-list-card" key={rec.id}>
                      <div><span className="candidate-match">{Number(rec.match_score).toFixed(1)}% match</span><h3>{rec.job.title}</h3><p>{rec.job.company} · {rec.job.location}</p><p>{money(rec.job.salary_min, rec.job.salary_max)}</p>
                        <p className="candidate-job-meta">Matched: {(rec.matched_skills || []).join(", ") || "No matched skills listed"}</p>
                      </div>
                      <div className="candidate-card-actions">
                        <button onClick={() => trackRecommendation(rec.id, "click")}>Track view</button>
                        <button className="candidate-primary" onClick={async () => { await trackRecommendation(rec.id, "click"); await applyJob(rec.job.id, rec.id); }}>Apply</button>
                      </div>
                    </article>
                  ))}
                  {recommendations.length === 0 && <p className="candidate-empty">No recommendations yet. Generate recommendations to see jobs matched to your profile.</p>}
                </div>
              )}

              {tab === "Saved Jobs" && (
                <div className="candidate-list">
                  {savedJobs.map((item) => <article className="candidate-list-card" key={item.job.id}>
                    <div><h3>{item.job.title}</h3><p>{item.job.company} · {item.job.location}</p><p>{money(item.job.salary_min, item.job.salary_max)}</p></div>
                    <div className="candidate-card-actions"><button onClick={() => removeSaved(item.job.id)}>Remove</button><button className="candidate-primary" onClick={() => applyJob(item.job.id)}>Apply</button></div>
                  </article>)}
                  {savedJobs.length === 0 && <p className="candidate-empty">You haven't saved any jobs yet.</p>}
                </div>
              )}

              {tab === "My Applications" && (
                <div className="candidate-list">
                  {applications.map((item) => <article className="candidate-list-card" key={item.id}>
                    <div><span className="candidate-status">{item.status}</span><h3>{item.job?.title || `Job #${item.job_id}`}</h3><p>{item.job?.company} · {item.job?.location}</p><small>Applied: {new Date(item.applied_at).toLocaleDateString("en-IN")}</small></div>
                    {item.status === "Applied" && <button onClick={() => withdrawApplication(item.id)}>Withdraw</button>}
                  </article>)}
                  {applications.length === 0 && <p className="candidate-empty">Your submitted applications will appear here.</p>}
                </div>
              )}

              {tab === "My Profile" && (
                <form className="candidate-profile-form" onSubmit={saveProfile}>
                  <div className="candidate-form-grid">
                    <label>Education
                      <select value={profile.education || ""} onChange={(e) => setProfile({ ...profile, education: e.target.value })}><option value="">Select education</option>{options.education_levels.map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select>
                    </label>
                    <label>Experience (years)
                      <input type="number" min="0" max="60" value={profile.experience_years ?? 0} onChange={(e) => setProfile({ ...profile, experience_years: e.target.value })} />
                    </label>
                    <label>Current location
                      <input maxLength="100" value={profile.location || ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
                    </label>
                    <label>District
                      <select value={profile.district || ""} onChange={(e) => setProfile({ ...profile, district: e.target.value })}><option value="">Select district</option>{options.districts.map((v) => <option key={v}>{v}</option>)}</select>
                    </label>
                    <label>Preferred district
                      <select value={profile.preferred_location || ""} onChange={(e) => setProfile({ ...profile, preferred_location: e.target.value })}><option value="">No preference</option>{options.districts.map((v) => <option key={v}>{v}</option>)}</select>
                    </label>
                    <label>Preferred category
                      <select value={profile.preferred_category || ""} onChange={(e) => setProfile({ ...profile, preferred_category: e.target.value })}><option value="">No preference</option>{options.job_categories.map((v) => <option key={v}>{v}</option>)}</select>
                    </label>
                    <label>Gender
                      <select value={profile.gender || ""} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}><option value="">Select</option>{options.genders.map((v) => <option key={v}>{v}</option>)}</select>
                    </label>
                    <label>Date of birth
                      <input type="date" value={profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : ""} onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })} />
                    </label>
                  </div>
                  <label>About you
                    <textarea maxLength="1000" rows="4" value={profile.bio || ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
                  </label>
                  <div className="candidate-skills-editor">
                    <h3>Your skills</h3>
                    <div className="candidate-add-skill">
                      <select id="add-skill"><option value="">Choose a skill</option>{allSkills.map((s) => <option key={s.id} value={s.id}>{s.skill_name}</option>)}</select>
                      <button type="button" onClick={() => addSkill(document.getElementById("add-skill").value)}>Add skill</button>
                    </div>
                    {skills.map((s) => {
                      const id = Number(s.skill_id ?? s.id);
                      const info = allSkills.find((x) => x.id === id);
                      return <div className="candidate-skill-edit" key={id}>
                        <span>{info?.skill_name || `Skill #${id}`}</span>
                        <select value={s.proficiency || 3} onChange={(e) => setSkills((old) => old.map((x) => Number(x.skill_id ?? x.id) === id ? { ...x, proficiency: Number(e.target.value) } : x))}>
                          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Proficiency {n}/5</option>)}
                        </select>
                        <button type="button" onClick={() => setSkills((old) => old.filter((x) => Number(x.skill_id ?? x.id) !== id))}>Remove</button>
                      </div>;
                    })}
                  </div>
                  <button className="candidate-primary" type="submit" disabled={profileLoading}>{profileLoading ? "Saving..." : "Save profile"}</button>
                </form>
              )}
            </section>
          </div>
        </main>
      )}

      {selectedJob && (
        <div className="candidate-modal-backdrop" onClick={() => setSelectedJob(null)}>
          <article className="candidate-job-modal" onClick={(e) => e.stopPropagation()}>
            <button className="candidate-modal-close" onClick={() => setSelectedJob(null)}>×</button>
            <p className="candidate-eyebrow">{selectedJob.category}</p>
            <h2>{selectedJob.title}</h2>
            <p>{selectedJob.company} · {selectedJob.location}</p>
            <h3>{money(selectedJob.salary_min, selectedJob.salary_max)}</h3>
            <p>{selectedJob.description || "No description provided."}</p>
            <p><strong>Experience:</strong> {selectedJob.experience_required ?? "Not specified"} years</p>
            <p><strong>Education:</strong> {selectedJob.education_required || "Not specified"}</p>
            <p><strong>Skills:</strong> {(selectedJob.skills || []).map((s) => s.skill_name).join(", ") || "Not specified"}</p>
            <div className="candidate-card-actions">
              <button onClick={() => user ? saveJob(selectedJob.id) : (setSelectedJob(null), setPage("auth"))}>Save job</button>
              <button className="candidate-primary" onClick={() => user ? applyJob(selectedJob.id) : (setSelectedJob(null), setPage("auth"))}>Apply now</button>
            </div>
          </article>
        </div>
      )}

      <footer className="candidate-footer">© 2026 PGRKAM · Punjab Employment Portal <a href="/admin">Admin portal</a></footer>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === "/admin") return <AdminApp />;
  return <CandidateApp />;
}
              <a
                className="candidate-primary"
                href="/unity-kiosk/index.html"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  marginLeft: "12px",
                }}
              >
                Open Unity Career Kiosk
              </a>
